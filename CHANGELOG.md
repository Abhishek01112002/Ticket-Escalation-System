# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-08-20

### Added
- **Monorepo Architecture**: Clean workspace topology with `@nvara/api`, `@nvara/worker`, `@nvara/web`, `@nvara/db`, and `@nvara/config`.
- **Client Submission Portal**: Public client request intake with real-time validation, public reference code generation, and per-process rate limiting.
- **Project Manager Workspace**: Interactive ticket queue, attention strip, team member assignment drawer, live SLA countdown timer, escalation indicators, and audit timeline.
- **Workflow State Machine**: Transactional state transitions (`awaiting_acknowledgement` -> `acknowledged` -> `in_progress` -> `resolved`) with optimistic version concurrency checks.
- **Deterministic SLA Worker**: Background polling engine evaluating acknowledgement deadlines with pessimistic row-locking (`SELECT ... FOR UPDATE OF r, a, s`) and idempotent breach event insertion.
- **Immutable Audit Trail**: Append-only PostgreSQL audit ledger with trigger-level mutation protection (`55006`).
- **Database & Schema Package**: Ordered SQL migrations, seed fixtures, and programmatic schema validation gate (`packages/db/src/validate-gate.ts`).
- **Comprehensive Testing Suite**:
  - Integration test suites for client submission, workflow progression, concurrency hardening, and SLA worker execution.
  - End-to-end browser test suite powered by Playwright.
- **Production Containerization**: Multi-stage Dockerfiles (`Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.web`) and production orchestration with `docker-compose.production.yml`.
- **Enterprise Repository Standards**: GitHub Actions CI/CD workflows, CodeQL security scanning, Dependabot configuration, issue/PR templates, and SRE operations runbook.
