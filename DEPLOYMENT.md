# Nvara Media — Production Deployment & Operations Guide

This guide details the deployment, environment configuration, database operations, security hardening, and ongoing maintenance for the **Nvara Media Ticket Escalation System**.

---

## 1. System Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Public Clients &         │
                                  │   Internal Team (Browser)     │
                                  └──────────────┬────────────────┘
                                                 │ HTTPS
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │     Reverse Proxy / CDN       │
                                  │    (Nginx / Caddy / Cloud)    │
                                  └───────┬───────────────┬───────┘
                     /v1/* (API)          │               │  Static Assets (HTML/JS/CSS)
                                          ▼               ▼
                       ┌────────────────────┐   ┌───────────────────┐
                       │  Fastify API Node  │   │   Vite Frontend   │
                       │    (Port 4000)     │   │   SPA Bundle      │
                       └─────────┬──────────┘   └───────────────────┘
                                 │
                                 ├────────────────────────┐
                                 │                        │
                                 ▼                        ▼
                       ┌────────────────────┐   ┌───────────────────┐
                       │   PostgreSQL 16    │   │  Background SLA   │
                       │  Durable Storage   │◄──┤   Worker Node     │
                       └────────────────────┘   └───────────────────┘
```

The system is organized as an npm workspace monorepo consisting of:
- **`@nvara/api`**: Fastify REST API backend handling client intake, PM operations, specialist workflow, and audit logging.
- **`@nvara/web`**: React / Vite Single Page Application for public client tracker and internal operations portal.
- **`@nvara/worker`**: Autonomous background engine evaluating SLA compliance deadlines and triggering escalation events.
- **`@nvara/db`**: Database migrations, PostgreSQL triggers (including append-only audit log protection), and schema definitions.
- **`@nvara/config`**: Centralized, Zod-validated environment and security configuration.

---

## 2. Production Prerequisites

| Component | Requirement | Recommended |
|:---|:---|:---|
| **Node.js** | `>= 22.0.0` (LTS) | `v22.14.0+` |
| **Package Manager** | npm `>= 10.0.0` | npm (workspaces) |
| **PostgreSQL** | `>= 16.0` with `pgcrypto` extension | AWS RDS / Cloud SQL / Docker Postgres 16 |
| **Reverse Proxy** | TLS termination + static asset serving | Nginx / Caddy / Cloudflare |
| **SMTP Server** | Standard SMTP (Port 587/465) | SendGrid / AWS SES / Postmark |

---

## 3. Environment Configuration

### `.env` File Specification (Production)

Create `/path/to/project/.env` with strict production settings:

```env
# ── Core Server & Database ──────────────────────────────────────────────────
NODE_ENV=production
DATABASE_URL=postgres://nvara_prod_user:YourStrongPassword@db.internal:5432/nvara_production
API_PORT=4000
WEB_ORIGIN=https://operations.nvaramedia.com
LOG_LEVEL=info

# ── Security Invariants (MANDATORY IN PRODUCTION) ───────────────────────────
# DEV_AUTH_ENABLED MUST be false in production. The server will refuse to start if true.
DEV_AUTH_ENABLED=false
DEFAULT_ORGANIZATION_NAME=Nvara Media
PUBLIC_RATE_LIMIT_PER_MINUTE=60

# ── SLA & Escalation Engine ─────────────────────────────────────────────────
SLA_POLL_INTERVAL_SECONDS=60

# ── SMTP / Transactional Email (REQUIRED in Production) ──────────────────────
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=SG.your_api_key_here
EMAIL_FROM="Nvara Operations <noreply@nvaramedia.com>"
```

### Production Environment Invariants Enforced by `@nvara/config`:
1. `NODE_ENV=production` requires `DEV_AUTH_ENABLED=false` (fails startup otherwise).
2. `WEB_ORIGIN` must not point to `localhost` in production.
3. `EMAIL_HOST`, `EMAIL_USER`, and `EMAIL_PASS` are strictly required in production mode for password resets and team invitations.

---

## 4. Build & Database Deployment

### Step 1: Install Production Dependencies & Build Bundles
```bash
# Install dependencies
npm ci

# Compile all workspaces (TypeScript -> JavaScript dist)
npm run build
```

### Step 2: Run Database Migrations
PostgreSQL must have `pgcrypto` enabled. Migrations are idempotent and run sequentially:
```bash
# Execute database migrations
npm run db:migrate
```

### Step 3: Seed Initial Administrative Organization (First-time setup only)
```bash
# Seed initial organization, service domains, and roles
npm run db:seed
```

---

## 5. Process Management & Deployment Options

### Option A: Systemd Services (Linux Production VM)

#### 1. API Server (`/etc/systemd/system/nvara-api.service`)
```ini
[Unit]
Description=Nvara Media Operations API Server
After=network.target postgresql.service

[Service]
Type=simple
User=nvara
WorkingDirectory=/opt/nvara-ticket-escalation
EnvironmentFile=/opt/nvara-ticket-escalation/.env
ExecStart=/usr/bin/node apps/api/dist/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### 2. Background SLA Worker (`/etc/systemd/system/nvara-worker.service`)
```ini
[Unit]
Description=Nvara Media SLA Escalation Worker
After=network.target postgresql.service

[Service]
Type=simple
User=nvara
WorkingDirectory=/opt/nvara-ticket-escalation
EnvironmentFile=/opt/nvara-ticket-escalation/.env
ExecStart=/usr/bin/node apps/worker/dist/main.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable --now nvara-api nvara-worker
```

---

### Option B: Docker Compose Deployment

If deploying entirely via Docker, use the following `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nvara_production
      POSTGRES_USER: nvara
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nvara -d nvara_production"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    env_file: .env
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: always

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    restart: always

volumes:
  pgdata:
```

---

## 6. Frontend Web App Hosting (Nginx Configuration)

The frontend SPA bundle is built to `apps/web/dist`. Use Nginx to serve static files and proxy `/v1/` to the API server:

```nginx
server {
    listen 80;
    server_name operations.nvaramedia.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name operations.nvaramedia.com;

    ssl_certificate /etc/letsencrypt/live/operations.nvaramedia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/operations.nvaramedia.com/privkey.pem;

    root /opt/nvara-ticket-escalation/apps/web/dist;
    index index.html;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Proxy
    location /v1/ {
        proxy_pass http://127.0.0.1:4000/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SPA Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Asset Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 7. Health Checks & Verification

### 1. API Health & Readiness
```bash
curl -I http://127.0.0.1:4000/health
```

### 2. Verify Background Worker Execution
Check worker logs to ensure active polling every 60 seconds:
```bash
journalctl -u nvara-worker -f --no-tail
```
Expected output:
```text
{"level":30,"time":"2026-08-22T14:00:00.000Z","msg":"evaluating active SLA records..."}
{"level":30,"time":"2026-08-22T14:00:00.050Z","msg":"evaluated 0 breached SLAs"}
```

### 3. Verify Public Tracker Security
```bash
curl -i https://operations.nvaramedia.com/v1/track/NVARA-2026-00000000
```
Expected response:
- Status: `404 Not Found` (or `400 Bad Request` if invalid format)
- Headers: `cache-control: no-store`, `x-robots-tag: noindex, nofollow`

---

## 8. Backup & Maintenance Runbook

### Database Backups
Schedule daily PostgreSQL backups using `pg_dump`:
```bash
pg_dump -U nvara -h 127.0.0.1 -p 5432 -Fc nvara_production > /backups/nvara_backup_$(date +\%Y\%m\%d).dump
```

### Audit Log Retention Policy
Audit events in `audit_events` are append-only and immutable. Soft-deleted tickets and audit logs maintain full historic compliance records in PostgreSQL. To review compliance retention:
1. Access **Team Management** → **Audit Trail** in the PM portal.
2. Filter by category (*User Lifecycle*, *Roles & Access*, *Security & Auth*, *Workflow*).
3. Use the **Purge History** action if regulatory pruning (>30 days / >90 days) is requested.
