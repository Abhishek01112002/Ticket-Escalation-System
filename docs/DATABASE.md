# 🗄️ Database & Schema Guide

This guide explains how data is organized in the PostgreSQL database for the Nvara Ticket Escalation System.

---

## 1. Simple Overview of Tables

Here is a visual map of how the tables connect with each other:

```text
  [ clients ] ───────┐
                     ▼
  [ users ] ───► [ requests ] ◄─── [ service_domains ]
                     │
                     ├────────► [ assignments ] ───► [ sla_records ] ───► [ escalation_events ]
                     │
                     └────────► [ audit_events ]
```

---

## 2. Table-by-Table Breakdown

### 1. `requests` (The Main Ticket Table)
Stores every ticket submitted by clients.
- `id` (UUID): Unique primary key.
- `public_reference` (Text): Human-friendly code shown to clients (e.g. `REQ-2026-ABCD`).
- `client_id` (UUID): Points to the `clients` table.
- `service_domain_id` (UUID): Category of the request (e.g., SEO, Design, Web).
- `requirement` (Text): The description of what the client wants.
- `urgency` (Text): `'flexible'`, `'soon'`, or `'time_sensitive'`.
- `status` (Text): `'awaiting_acknowledgement'`, `'acknowledged'`, `'in_progress'`, or `'resolved'`.
- `version` (Integer): Starts at 1. Increments every time someone updates the ticket (prevents conflicting simultaneous edits).

---

### 2. `clients`
Stores contact information for clients who submit tickets.
- `id` (UUID): Unique identifier.
- `name` (Text): Client name.
- `company` (Text): Company name.
- `email` (Text): Client email address.
- `phone_whatsapp` (Text): Phone or WhatsApp number.

---

### 3. `users` & `user_roles`
Stores team members (Project Managers, Engineers).
- `display_name` (Text): Full name (e.g., "Aarav Sharma").
- `email` (Text): Work email.
- `is_active` (Boolean): Whether the user is an active employee.
- **Roles**:
  - `project_manager`: Can review queues, assign team members, and view escalations.
  - `internal_team_member`: Assigned to tickets, acknowledges, starts work, and resolves them.

---

### 4. `assignments`
Tracks which team member is assigned to which ticket.
- `request_id` (UUID): The ticket being assigned.
- `assignee_user_id` (UUID): The team member doing the work.
- `assigned_by_user_id` (UUID): The PM who assigned them.
- `assigned_at` (Timestamp): When assignment happened.
- `ended_at` (Timestamp): If reassigned, when the previous assignment ended.

---

### 5. `sla_records`
Manages the countdown timer for each assignment.
- `assignment_id` (UUID): The assignment this timer belongs to.
- `duration_seconds` (Integer): Total allowed time (e.g. 86400 seconds = 24 hours).
- `started_at` (Timestamp): When the timer started.
- `deadline_at` (Timestamp): `started_at` + 24 hours.
- `acknowledged_at` (Timestamp): When the assignee clicked acknowledge.
- `status` (Text): `'active'`, `'acknowledged'`, `'breached'`, or `'closed'`.

---

### 6. `escalation_events`
Created automatically by the background worker if an assignee does not acknowledge before the `deadline_at`.
- `request_id` (UUID): The escalated ticket.
- `responsible_user_id` (UUID): The assignee who missed the deadline.
- `triggered_at` (Timestamp): Exact time the escalation occurred.
- `reason` (Text): E.g., `"acknowledgement_sla_breached"`.

---

### 7. `audit_events` (History Log)
A permanent, read-only history log of every single change that happens in the system.
- `event_type`: `'request_created'`, `'assigned'`, `'acknowledged'`, `'work_started'`, `'resolved'`, `'sla_breached'`.
- `actor_type`: `'client'`, `'user'`, or `'system'`.
- `occurred_at`: Exact timestamp.

---

## 3. How to Run Migrations

Database tables are created and updated using SQL migration files:

```bash
# 1. Run migrations
npm run db:migrate

# 2. Add demo test data
npm run db:seed
```

All migration files are located in `packages/db/migrations/`:
- `0001_initial.sql`: Creates all main tables, indexes, and foreign keys.
- `0002_audit_immutability.sql`: Adds a database trigger to protect the audit log from accidental edits or deletes.
