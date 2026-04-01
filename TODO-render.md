# Render Deploy Fix - Prisma v6 Downgrade Plan (Approved)

**Current Issue:** Prisma v7 requires prisma.config.ts for migrate/db push, causing build fails.

**Plan:**
1. [x] Downgrade package.json: prisma to ^5.20.0 (latest stable v5, v6 not released).
2. [x] Delete prisma/prisma.config.ts (not needed for v5).
3. [x] schema.prisma no-url (Render uses DATABASE_URL).
4. [x] `npm install` complete.
5. [ ] `npx prisma generate`.
6. [ ] Delete prisma/prod.db dev.db if needed.
7. [ ] git add/commit/push.

**Followup:** New Render build succeeds with `npm ci && npx prisma generate && npx prisma db push`.

Proceeding step-by-step.

