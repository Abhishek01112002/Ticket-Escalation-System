## Description

<!-- Provide a concise summary of the changes introduced in this pull request. -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 💥 Breaking change (fix or feature causing existing functionality to change)
- [ ] ⚡ Performance improvement
- [ ] 🛡️ Security hardening
- [ ] 📚 Documentation update
- [ ] 🔧 Build / CI / Tooling improvement

## Architectural & Invariant Alignment

- [ ] State transitions preserve monotonic request version increments (`version = version + 1`).
- [ ] Mutation endpoints require and validate `Idempotency-Key` headers.
- [ ] Worker SLA evaluations acquire pessimistic locks (`SELECT ... FOR UPDATE OF r, a, s`).
- [ ] Audit logs remain append-only and trigger-protected.
- [ ] Multi-tenant organization scoping is enforced on all authenticated queries.

## Testing & Verification

- [ ] `npm run typecheck` passes with zero errors across all workspaces.
- [ ] `npm run build` generates clean production bundles.
- [ ] `npm run test:integration` passes.
- [ ] `npm run test:integration:workflow` passes.
- [ ] `npm run test:integration:hardening` passes (concurrency & race verification).
- [ ] `npm run test:integration:worker` passes.
- [ ] `npm run test:e2e` passes (if UI / E2E flows were modified).

## Database & Migration Notes

<!-- If introducing migrations in `packages/db/migrations`:
1. Are migrations forward-only and backwards-compatible?
2. Has `npm run db:validate` passed on a clean database?
-->
- [ ] No database changes
- [ ] Migrations included & verified with `npm run db:validate`
