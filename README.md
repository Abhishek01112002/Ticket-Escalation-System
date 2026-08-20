# Ticket Escalation System

A simple web application for managing client support requests and automatically escalating overdue tickets if they are not acknowledged within 24 hours.

---

## 📌 About the Project

This project helps a team manage client tickets from submission to resolution:
- **Client**: Submits a request through the web portal.
- **Project Manager (PM)**: Views all incoming tickets and assigns them to team members.
- **Team Member**: Gets assigned, acknowledges the ticket within 24 hours, works on it, and marks it resolved.
- **Auto-Escalation**: If a ticket is not acknowledged within 24 hours, the background worker automatically marks it as **SLA Breached / Escalated**.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Node.js, Fastify, TypeScript
- **Database**: PostgreSQL (via Docker)
- **Background Worker**: Node.js script for checking SLA deadlines

---

## 🚀 How to Run Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v22 recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)

---

### 2. Setup & Installation

Open terminal in the project root folder:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
copy .env.example .env

# 3. Start PostgreSQL in Docker
npm run db:up

# 4. Create database tables & load demo data
npm run db:migrate
npm run db:seed
```

---

### 3. Start the Project

Open **3 separate terminal windows** and run:

```bash
# Terminal 1: Start Backend API (runs on port 4000)
npm run dev:api

# Terminal 2: Start Background SLA Worker
npm run dev:worker

# Terminal 3: Start Frontend (runs on port 5173)
npm run dev:web
```

Now open **[http://localhost:5173](http://localhost:5173)** in your browser! 🚀

---

## 📁 Project Structure

```text
Ticket Escalation System/
├── apps/
│   ├── web/        # Frontend UI (React + Tailwind)
│   ├── api/        # Backend REST API (Fastify)
│   └── worker/     # Background SLA Escalation script
├── packages/
│   ├── db/         # Database migrations and seed data
│   └── config/     # Environment configuration
└── package.json    # Project dependencies and scripts
```

---

## 🧪 Testing

```bash
# Check TypeScript for errors
npm run typecheck

# Run backend tests
npm run test:integration
```

---

## 📜 License

MIT License
