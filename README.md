# Online ICT Support System

A web based help desk and IT operations system for organizations. Staff can report and track technical issues, while technicians and managers handle tickets, equipment, maintenance, approvals, and service reporting.

The application is split into two deployable services: a Next.js frontend and an Express API backed by PostgreSQL. The frontend proxies `/api/*` and `/socket.io/*` requests to the backend.

## Features

- **Support tickets:** create, assign, update, comment on, and track tickets by status, priority, category, and service deadline.
- **Service operations:** technician workflows, ticket history, approvals, SLA monitoring and escalation, delayed-ticket reasons, and user feedback.
- **Asset inventory:** manage equipment and consumables, track assignments and usage, submit requests, and keep asset history.
- **Maintenance:** schedule maintenance, assign technicians, record parts, and follow maintenance status.
- **Administration:** role-based access for staff, technicians, managers, and administrators; user invitations; account management; allowed-email controls; and audit logs.
- **Notifications and communication:** in-app notifications, real-time updates over Socket.IO, optional invitation email delivery, and optional Telegram linking and notifications.
- **Dashboards and reports:** ticket activity and operational summaries, including technician reports.
- **User experience:** English and Amharic translations, light and dark themes, and location details for tickets.

## Technology

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript, Socket.IO
- Database: PostgreSQL with Prisma ORM
- Deployment guide: Vercel (frontend), Render (backend), and Supabase (PostgreSQL)

## Repository layout

```text
backend/      Express API, Prisma schema, and database seed scripts
frontend/     Next.js web application
DEPLOYMENT.md Production deployment instructions
```

## Requirements

- Node.js 20 or later and npm
- PostgreSQL database

## Run locally

1. Install dependencies from the repository root:

   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

2. Create `backend/.env` (or copy `backend/.env.example`) and configure at least:

   ```dotenv
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ict_support"
   APP_BASE_URL="http://localhost:3001"
   FRONTEND_ORIGIN="http://localhost:3001"
   JWT_SECRET="replace-with-a-long-random-secret"
   ```

   Use a unique, randomly generated `JWT_SECRET` outside local development. Keep real secrets in environment files or your hosting provider's secret manager; do not commit them.

3. Create the database tables and generate the Prisma client:

   ```bash
   npm run db:generate
   npm run db:push
   ```

4. Start the frontend and backend together:

   ```bash
   npm run dev
   ```

   The frontend runs at [http://localhost:3001](http://localhost:3001). The backend listens on port `3000` by default, and the frontend proxies API and Socket.IO requests to `http://localhost:3000`.

To start a service on its own, run `npm run dev:frontend` or `npm run dev:backend` from the repository root.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `JWT_SECRET` | Yes | Secret used to sign authentication tokens and cookies. Set a strong, unique value. |
| `APP_BASE_URL` | Recommended | Public frontend URL used when building invitation and profile links. |
| `FRONTEND_ORIGIN` | Recommended | Frontend origin allowed to call the API. |
| `PORT` | No | API port; defaults to `3000`. |
| `NODE_ENV` | No | Set to `production` for production deployments. |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM` | No | Gmail API delivery for invitation email. |
| `RESEND_API_KEY`, `RESEND_FROM` | No | Resend email delivery. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | SMTP email delivery. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID`, `TELEGRAM_BOT_USERNAME` | No | Optional Telegram notifications and account linking. |

Email and Telegram integrations are optional. Configure them only when you want those integrations enabled. See [`backend/.env.example`](backend/.env.example) for the complete backend template.

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `BACKEND_ORIGIN` | For deployment | Backend base URL used by Next.js rewrites, for example `https://your-api.example.com`. For local development it defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_SOCKET_URL` | No | Optional Socket.IO URL override. Leave unset to use the frontend origin and its `/socket.io` proxy. |

## Database and sample users

The Prisma schema is in `backend/prisma/schema.prisma`. After configuring `DATABASE_URL`, use the root scripts to generate the Prisma client and synchronize the schema. `npm run db:push` uses Prisma's schema push workflow; review database changes carefully before running it against an existing production database.

Optional seed commands:

```bash
npm run seed:users   # Create or update the configured seed accounts
npm --prefix backend run seed  # Seed demo records
```

Seed passwords are read from environment variables defined in [`backend/prisma/seed-data.ts`](backend/prisma/seed-data.ts), with `SEED_DEFAULT_PASSWORD` as a fallback. Configure them before running the seed scripts, and do not use demo credentials in production.

## Available commands

Run these from the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | Run the backend and frontend together. |
| `npm run dev:backend` | Run the Express API. |
| `npm run dev:frontend` | Run the Next.js frontend. |
| `npm run lint` | Run TypeScript checks for both services (`tsc --noEmit`). |
| `npm run build:frontend` | Build the frontend for production. |
| `npm run start:frontend` | Start the built frontend. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:push` | Synchronize the Prisma schema to the configured database. |

## Deployment

The deployment guide covers the recommended Vercel + Render + Supabase setup, required environment variables, email provider options, and post-deployment checks. Follow [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full instructions.

At minimum, configure `BACKEND_ORIGIN` in the frontend's build environment, and configure `DATABASE_URL`, `JWT_SECRET`, `APP_BASE_URL`, and `FRONTEND_ORIGIN` on the backend. Build and start the frontend and backend using the service-specific settings described in the deployment guide.

## Security

- Never commit `.env` files, database credentials, JWT secrets, or email and bot tokens.
- Use HTTPS in production and set `FRONTEND_ORIGIN` to the exact deployed frontend origin.
- Use a strong, unique `JWT_SECRET` and rotate it if it has been exposed.
- Give production services only the credentials and permissions they need.

## Contributing

Changes are welcome. Please keep frontend and backend configuration in their respective folders, avoid committing generated secrets or local environment files, and run `npm run lint` before submitting a change.
