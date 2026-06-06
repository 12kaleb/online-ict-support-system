# Deployment Guide

Target hosting:

| Component | Service |
| --------- | ------- |
| Frontend  | Vercel  |
| Backend   | Render  |
| Database  | Supabase |

## 1. Supabase Database

1. Create a Supabase project.
2. Copy the PostgreSQL connection string from Supabase.
3. Use the pooled connection string for the deployed app when possible.
4. Keep the database password private. Do not commit it to the repo.

The backend expects:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="use-a-long-random-secret"
NODE_ENV="production"
```

## 2. Render Backend

Create a new Render Web Service connected to this repository.

Recommended settings:

```text
Root Directory: backend
Runtime: Node
Build Command: npm install && npm run db:generate && npm run db:push
Start Command: npm start
```

Set these Render environment variables:

```env
DATABASE_URL="your-supabase-postgres-connection-string"
JWT_SECRET="a-long-random-secret"
NODE_ENV="production"
APP_BASE_URL="https://your-vercel-app.vercel.app"
FRONTEND_ORIGIN="https://your-vercel-app.vercel.app"
```

Optional email and Telegram variables:

```env
GMAIL_CLIENT_ID=""
GMAIL_CLIENT_SECRET=""
GMAIL_REFRESH_TOKEN=""
GMAIL_FROM="ICT Support <kalebteshome94@gmail.com>"
RESEND_API_KEY=""
RESEND_FROM="ICT Support <onboarding@your-verified-domain.com>"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""
TELEGRAM_BOT_TOKEN=""
```

On Render free web services, outbound SMTP ports can time out. For production invites,
prefer `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`, Resend, or
another HTTPS email provider. Keep the SMTP variables only for local development or
hosting that allows outbound SMTP.

After Render deploys, copy the backend URL, for example:

```text
https://your-backend.onrender.com
```

## 3. Vercel Frontend

Create a new Vercel project connected to this repository.

Recommended settings:

```text
Root Directory: frontend
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
```

Set this Vercel environment variable:

```env
BACKEND_ORIGIN="https://your-backend.onrender.com"
```

Optional:

```env
NEXT_PUBLIC_SOCKET_URL=""
```

Leave `NEXT_PUBLIC_SOCKET_URL` empty unless you intentionally configure Socket.IO to connect directly to the backend. By default, the app uses the same frontend origin and the `/socket.io` rewrite.

Redeploy the frontend after setting the env var.

## 4. Final Render Env Update

After Vercel gives you the final frontend URL, update Render:

```env
APP_BASE_URL="https://your-vercel-app.vercel.app"
FRONTEND_ORIGIN="https://your-vercel-app.vercel.app"
```

Then redeploy the backend.

## 5. Verify

From the repository root:

```bash
npm run lint
```

After deployment:

1. Open the Vercel frontend URL.
2. Log in.
3. Confirm `/api/auth/me` succeeds through the frontend.
4. Create or view a ticket.
5. Check Render logs if any API request fails.

## Common Issues

- If Vercel API calls go to `localhost`, confirm `BACKEND_ORIGIN` is set in Vercel and redeploy.
- If Render fails to boot, confirm `JWT_SECRET`, `DATABASE_URL`, and `NODE_ENV` are set.
- If the database cannot connect, try Supabase's pooled connection string and confirm the password is URL-encoded.
- If browser requests are blocked by CORS, confirm Render has `APP_BASE_URL` and `FRONTEND_ORIGIN` set to the exact Vercel origin.
