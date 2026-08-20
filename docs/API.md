# 📡 API Reference Guide

This guide describes all REST API endpoints in the Nvara Ticket Management backend in simple terms with example requests and responses.

Base URL for local development: `http://localhost:4000`

---

## 1. Public Client Endpoints

### 📝 Submit a New Ticket
- **Endpoint**: `POST /v1/client/requests`
- **Auth Required**: No (Public)
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key: <unique-uuid-or-string>` (Optional, prevents duplicate submissions)

#### Request Body Example:
```json
{
  "name": "Jane Doe",
  "company": "Acme Corp",
  "email": "jane@acme.com",
  "phone": "+1234567890",
  "serviceDomain": "web_development",
  "requirement": "Need help setting up a new landing page and fixing payment button.",
  "urgency": "soon"
}
```

*Allowed values for `urgency`: `"flexible"`, `"soon"`, `"time_sensitive"`*

#### Success Response (`201 Created`):
```json
{
  "reference": "REQ-2026-89AB12",
  "status": "awaiting_acknowledgement",
  "message": "Your request has been received. Our team will review it shortly."
}
```

---

## 2. Project Manager Endpoints

*Note: In development mode, pass the header `X-Dev-Auth-Subject: dev-pm-subject-001` to authenticate as the Project Manager.*

### 📋 List All Tickets
- **Endpoint**: `GET /v1/pm/requests`
- **Auth Header**: `X-Dev-Auth-Subject: dev-pm-subject-001`

#### Response (`200 OK`):
```json
{
  "requests": [
    {
      "id": "uuid-123",
      "reference": "REQ-2026-89AB12",
      "clientName": "Jane Doe",
      "company": "Acme Corp",
      "requirement": "Need help setting up a new landing page...",
      "urgency": "soon",
      "status": "awaiting_acknowledgement",
      "assigneeName": null,
      "slaDeadline": null,
      "isBreached": false,
      "version": 1,
      "createdAt": "2026-08-20T10:00:00Z"
    }
  ]
}
```

---

### 🔍 Get Single Ticket Details
- **Endpoint**: `GET /v1/pm/requests/:reference`
- **Auth Header**: `X-Dev-Auth-Subject: dev-pm-subject-001`

#### Response (`200 OK`):
```json
{
  "request": {
    "id": "uuid-123",
    "reference": "REQ-2026-89AB12",
    "status": "awaiting_acknowledgement",
    "client": {
      "name": "Jane Doe",
      "email": "jane@acme.com",
      "company": "Acme Corp"
    },
    "requirement": "Need help setting up a new landing page...",
    "version": 1
  }
}
```

---

### 👥 Get List of Team Members (Assignees)
- **Endpoint**: `GET /v1/pm/team-members`
- **Auth Header**: `X-Dev-Auth-Subject: dev-pm-subject-001`

#### Response (`200 OK`):
```json
{
  "teamMembers": [
    { "id": "user-uuid-1", "name": "Aarav Sharma", "email": "aarav@nvara.internal" },
    { "id": "user-uuid-2", "name": "Priya Patel", "email": "priya@nvara.internal" }
  ]
}
```

---

### 🎯 Assign a Team Member to a Ticket
- **Endpoint**: `POST /v1/pm/requests/:reference/assignments`
- **Auth Header**: `X-Dev-Auth-Subject: dev-pm-subject-001`
- **Header**: `Idempotency-Key: <unique-key>`

#### Request Body:
```json
{
  "assigneeUserId": "user-uuid-1",
  "expectedVersion": 1
}
```

#### Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Team member assigned successfully. 24h SLA timer started.",
  "request": {
    "reference": "REQ-2026-89AB12",
    "status": "awaiting_acknowledgement",
    "version": 2
  }
}
```

---

## 3. Workflow Action Endpoints (Team Members)

### ✋ 1. Acknowledge Ticket
- **Endpoint**: `POST /v1/requests/:reference/acknowledge`
- **Auth Header**: `X-Dev-Auth-Subject: dev-internal-subject-001`

#### Request Body:
```json
{
  "expectedVersion": 2
}
```

#### Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Ticket acknowledged. SLA timer stopped."
}
```

---

### 🚀 2. Start Work on Ticket
- **Endpoint**: `POST /v1/requests/:reference/start-work`
- **Auth Header**: `X-Dev-Auth-Subject: dev-internal-subject-001`

#### Request Body:
```json
{
  "expectedVersion": 3
}
```

---

### ✅ 3. Resolve Ticket
- **Endpoint**: `POST /v1/requests/:reference/resolve`
- **Auth Header**: `X-Dev-Auth-Subject: dev-internal-subject-001`

#### Request Body:
```json
{
  "expectedVersion": 4
}
```

---

## 4. Health Check Endpoints

- **`GET /health/live`**: Returns `200 OK` if the backend process is running.
- **`GET /health/ready`**: Returns `200 OK` if the backend is connected to the PostgreSQL database.
