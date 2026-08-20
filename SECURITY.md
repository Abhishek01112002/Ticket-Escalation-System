# 🔒 Security Policy

We take security seriously. If you discover a security vulnerability in this project, please follow the guidelines below.

---

## 📢 Reporting Security Issues

**Please do not report security bugs in public GitHub issues.**

To report a vulnerability:
- Send an email to `security@nvara.internal` (or reach out to the project maintainers directly).
- Describe the vulnerability and the steps needed to reproduce it.

We will review the report promptly and deploy a fix as soon as possible.

---

## 🛡️ Security Features in Nvara

1. **Strict Input Validation**: All user input from web forms is checked using Zod schemas before reaching the database.
2. **Rate Limiting**: Protects public client submission endpoints from spam.
3. **Database Safeguards**: Prevents accidental data updates on audit logs using PostgreSQL triggers.
4. **Idempotency Keys**: Protects against accidental duplicate submissions.
