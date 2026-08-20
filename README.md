# 🎫 Nvara Request Management & Ticket Escalation System

> A simple, reliable ticket management system with client submissions, project manager assignments, team workflows, and automatic SLA escalation.

---

## 📌 What is this project?

**Nvara Request Management** helps teams manage client requests from start to finish:
1. **Client Submits a Request**: A client fills out a simple form on the web portal.
2. **PM Assigns a Team Member**: The Project Manager reviews the ticket in their dashboard and assigns it to an engineer/team member.
3. **SLA Timer Starts**: Once assigned, the team member has **24 hours** to acknowledge the ticket.
4. **Auto-Escalation**: If the team member does not acknowledge in time, the background worker automatically marks it as **SLA Breached** and triggers an escalation event.
5. **Work & Resolution**: The team member starts work and resolves the ticket once completed.

---

## 🚀 Quick Start (Run in 5 Minutes)

### Prerequisites
Make sure you have installed:
- **Node.js 22+** (check with `node -v`)
- **Docker Desktop** (for running PostgreSQL database)
- **Git**

---

### Step 1: Clone the Repo & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/nvara-media/nvara-request-management.git
cd nvara-request-management

# Install dependencies for all apps and packages
npm install
```

---

### Step 2: Set Up Environment Variables

Copy the sample environment file:

```bash
# On Linux / macOS
cp .env.example .env

# On Windows (PowerShell)
copy .env.example .env
```

*(The default `.env` values work out-of-the-box for local development!)*

---

### Step 3: Start the PostgreSQL Database

```bash
# Start PostgreSQL inside Docker
npm run db:up

# Run database migrations (creates all tables)
npm run db:migrate

# Seed demo users and categories
npm run db:seed
```

---

### Step 4: Start the Applications

Open 3 terminal windows (or tabs) and run:

```bash
# Terminal 1: Start Backend API (runs at http://localhost:4000)
npm run dev:api

# Terminal 2: Start Background SLA Worker (checks for overdue tickets)
npm run dev:worker

# Terminal 3: Start Frontend Web App (runs at http://localhost:5173)
npm run dev:web
```

Now open **[http://localhost:5173](http://localhost:5173)** in your browser! 🎉

---

## 📁 Project Structure (Monorepo)

The project is organized into simple, modular folders:

```text
nvara-request-management/
├── apps/
│   ├── web/           # 🌐 Frontend UI (React 19 + Vite + Tailwind CSS)
│   ├── api/           # ⚙️ Backend REST API (Fastify + TypeScript + PostgreSQL)
│   └── worker/        # ⏰ Background Worker (checks SLA deadlines every minute)
├── packages/
│   ├── db/            # 🗄️ Database migrations, seed data, and SQL scripts
│   └── config/        # 🔧 Environment variable loader and validation
├── docs/              # 📚 Simple documentation (Architecture, API, Database)
└── tests/             # 🧪 Integration and Playwright E2E browser tests
```

---

## 🔄 How the Workflow Works

```text
  [ Client Submits ]
          │
          ▼
  [ Awaiting PM Assignment ] ──(PM assigns Member)──> [ SLA Timer Starts (24h) ]
                                                               │
                           ┌───────────────────────────────────┴─────────────────┐
                           ▼                                                     ▼
                  [ Acknowledged in Time ]                            [ Overdue (> 24h) ]
                           │                                                     │
                           ▼                                                     ▼
                  [ Work In Progress ]                                  [ SLA Breached & Escalated ]
                           │                                                     │
                           ▼                                                     ▼
                    [ Resolved ]                                        [ Late Acknowledged & Resolved ]
```

---

## 🛠️ Common Commands Cheatsheet

| Command | What it does |
|---|---|
| `npm run dev:web` | Starts the React frontend on `http://localhost:5173` |
| `npm run dev:api` | Starts the Fastify API backend on `http://localhost:4000` |
| `npm run dev:worker` | Starts the background SLA escalation worker |
| `npm run db:up` | Starts the local PostgreSQL container in Docker |
| `npm run db:down` | Stops the PostgreSQL container |
| `npm run db:migrate` | Runs SQL migrations to update database tables |
| `npm run db:seed` | Adds demo users, roles, and categories |
| `npm run typecheck` | Checks TypeScript code for any type errors |
| `npm run build` | Builds the frontend and backend for production |
| `npm run test:integration` | Runs API integration tests |
| `npm run test:e2e` | Runs Playwright browser tests |

---

## 🧪 Testing

We have simple automated tests to make sure everything works properly:

```bash
# 1. Check TypeScript code
npm run typecheck

# 2. Run backend API tests
npm run test:integration
npm run test:integration:workflow
npm run test:integration:hardening
npm run test:integration:worker

# 3. Run browser end-to-end tests (requires running database & API)
npm run test:e2e
```

---

## 📚 Simple Guides & Documentation

- **[System Architecture](docs/ARCHITECTURE.md)** — Simple explanation of how frontend, backend, database, and worker communicate.
- **[API Guide](docs/API.md)** — List of all API endpoints with sample request and response data.
- **[Database Guide](docs/DATABASE.md)** — Clear explanation of all database tables and relationships.
- **[Contributing Guide](CONTRIBUTING.md)** — Beginner-friendly guide on how to contribute and submit PRs.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
