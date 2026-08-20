# 🏗️ Architecture & System Design Guide

This guide explains how the Nvara Ticket Escalation System is designed in simple, easy-to-understand terms.

---

## 1. High-Level Overview

The system consists of **4 main parts**:

```text
    ┌─────────────────────────┐
    │   1. Frontend (Web)     │  <-- React 19 web app where Clients submit tickets
    │       (apps/web)        │      and Project Managers view the dashboard.
    └────────────┬────────────┘
                 │
                 │ HTTP Requests (JSON)
                 ▼
    ┌─────────────────────────┐
    │   2. Backend (API)      │  <-- Fastify server that handles business logic,
    │       (apps/api)        │      validates inputs, and saves data to the DB.
    └────────────┬────────────┘
                 │
                 │ SQL Queries
                 ▼
    ┌─────────────────────────┐         ┌─────────────────────────┐
    │   3. Database (Postgres)│ ◄───────┤   4. Background Worker  │
    │      (packages/db)      │         │      (apps/worker)      │
    └─────────────────────────┘         └─────────────────────────┘
                                        Checks every minute if any ticket
                                        passed its 24-hour deadline without
                                        being acknowledged.
```

---

## 2. Explanation of Each Folder

### 🌐 `apps/web` (Frontend Web App)
- **Tech Stack**: React 19, Vite, TypeScript, Tailwind CSS.
- **What it does**:
  - **Landing Page**: Lets you choose between the Client Portal and PM Portal.
  - **Client Portal**: A clean form where clients submit project requests with urgency levels (Flexible, Soon, Time Sensitive).
  - **Project Manager Portal**: A dashboard to view incoming tickets, assign team members, track live SLA timers, and view audit history.

### ⚙️ `apps/api` (Backend Server)
- **Tech Stack**: Node.js 22, Fastify, TypeScript, `pg` (PostgreSQL client).
- **What it does**:
  - `POST /v1/client/requests`: Saves new client tickets to the database.
  - `GET /v1/pm/requests`: Fetches the list of tickets for the PM.
  - `POST /v1/pm/requests/:id/assignments`: Assigns a team member to a ticket and starts the SLA clock.
  - `POST /v1/requests/:id/acknowledge`: The assigned member confirms they saw the ticket.
  - `POST /v1/requests/:id/start-work`: Moves status to "in_progress".
  - `POST /v1/requests/:id/resolve`: Marks ticket as completed.

### ⏰ `apps/worker` (Background SLA Worker)
- **Tech Stack**: TypeScript, Node.js.
- **What it does**:
  - Runs in the background (polls every 60 seconds).
  - Looks for active tickets where `deadline_at <= now` and the assignee hasn't acknowledged yet.
  - Automatically updates the ticket status to **`breached`** and logs an escalation event.

### 🗄️ `packages/db` (Database)
- **Tech Stack**: PostgreSQL 16.
- **What it does**:
  - Contains SQL migration files in `packages/db/migrations/`.
  - Creates the tables: `requests`, `clients`, `users`, `assignments`, `sla_records`, `escalation_events`, and `audit_events`.
  - Has a seed script (`seed.ts`) to add dummy data for local development.

### 🔧 `packages/config` (Configuration)
- Reads environment variables from `.env` and validates them to prevent configuration errors.

---

## 3. The Lifecycle of a Ticket

Here is the exact journey of a ticket from start to finish:

1. **Submission**:
   - Client fills out the form.
   - Ticket is saved with status `awaiting_acknowledgement`.
   - A unique tracking code is generated (e.g., `REQ-2026-ABCD`).

2. **PM Assignment**:
   - PM opens the ticket and selects an engineer.
   - System creates an `assignment` record and an `sla_record` with a **24-hour deadline**.

3. **Acknowledgement (Within SLA)**:
   - The assigned engineer clicks "Acknowledge".
   - The SLA timer stops.
   - Status changes to `acknowledged`.

4. **Automatic Escalation (If Missed SLA)**:
   - If 24 hours pass without acknowledgement:
   - The background worker detects the breach.
   - It marks the SLA record as `breached` and inserts an `escalation_event`.
   - The PM sees an "ESCALATED / SLA BREACHED" alert badge on their dashboard.

5. **Work in Progress & Resolution**:
   - Engineer clicks "Start Work" -> status becomes `in_progress`.
   - Engineer finishes and clicks "Resolve" -> status becomes `resolved`.

---

## 4. Key Concepts Explained Simply

- **SLA (Service Level Agreement)**: A time limit promise made to clients. In this system, the team has 24 hours to acknowledge an assigned ticket.
- **Idempotency**: A safety mechanism so that if you click "Submit" twice by accident or your internet reconnects, the system won't create duplicate tickets or double-charge actions.
- **Audit Trail**: Every single action (who created it, who was assigned, when work started) is permanently recorded in the `audit_events` table so you always know the full history.
