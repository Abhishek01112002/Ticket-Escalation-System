# 🤝 Contributing Guide

Welcome! We are excited that you want to contribute to the Nvara Ticket Management project. This guide will help you get started quickly.

---

## 🚀 How to Set Up Your Local Environment

1. **Fork and Clone the Repository**
   ```bash
   git clone https://github.com/nvara-media/nvara-request-management.git
   cd nvara-request-management
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up the Environment File**
   ```bash
   # Copy sample env
   cp .env.example .env
   ```

4. **Start Database and Run Migrations**
   ```bash
   npm run db:up
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Dev Servers**
   ```bash
   npm run dev:api       # Backend API
   npm run dev:worker    # SLA Worker
   npm run dev:web       # Frontend React App
   ```

---

## 🌿 Branching & Making Changes

1. **Create a new branch** from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes** in the appropriate folder:
   - `apps/web`: For frontend UI changes.
   - `apps/api`: For backend route / logic changes.
   - `apps/worker`: For background SLA escalation changes.
   - `packages/db`: For new database migrations.

3. **Test your code before committing**:
   ```bash
   # Check for TypeScript errors
   npm run typecheck

   # Test that builds succeed
   npm run build

   # Run integration tests
   npm run test:integration
   ```

4. **Commit and Push**:
   ```bash
   git add .
   git commit -m "feat: add my new feature"
   git push origin feat/my-new-feature
   ```

5. **Open a Pull Request** on GitHub!

---

## 💡 Helpful Tips for Beginners

- **TypeScript errors?** Run `npm run typecheck` to see where the type error is located.
- **Database issues?** You can restart fresh anytime with `npm run db:down`, `npm run db:up`, `npm run db:migrate`, and `npm run db:seed`.
- **Have questions?** Feel free to open a GitHub Discussion or issue!
