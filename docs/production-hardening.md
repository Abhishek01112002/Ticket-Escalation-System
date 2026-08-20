# Production hardening notes

## Operational assumptions

The first deployment is sized for a small-to-medium internal team: one API deployment, one worker deployment (multiple replicas are safe because SLA escalation uses row locks and a unique idempotency key), PostgreSQL with automated backups, and a web container behind a TLS-terminating reverse proxy. Public request rate limiting in the API is intentionally per-process; a shared gateway limit is required when API replicas scale horizontally.

## Health and recovery

- `/health/live` reports process liveness and does not query PostgreSQL.
- `/health/ready` runs `SELECT 1` and returns `503 DATABASE_NOT_READY` when the dependency is unavailable.
- Worker health is represented by structured `worker started`, `SLA poll completed`, `SLA poll failed; retrying`, and `worker shutting down` logs. Poll failures do not terminate the process.
- PostgreSQL backups must include the request, assignment, SLA, escalation, idempotency, and audit tables. Restore into a disposable database before production promotion.

## Security boundaries

All PM/internal reads and mutations resolve the authenticated subject to an active user and organization. Queries scope request data by that organization; assignee selection requires an active internal-team role in the same organization. Client submission is intentionally public, but uses strict schemas, normalized contact data, a configured organization, idempotency, body limits, and a lightweight rate guard.

## Findings classification

P0: none known after the hardening pass.

P1: configure and validate the real OIDC provider before external production login; deploy a shared edge rate limiter for multiple API replicas; operate PostgreSQL backups and restore drills.

P2: add database-level append-only audit triggers and longer-running fault-injection/soak tests after launch.
