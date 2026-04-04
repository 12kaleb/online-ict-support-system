<div align="center">

</div>



This repository is organized into separate deployment-friendly app folders:

- `frontend/` for the React/Vite client
- `backend/` for the Express/Prisma API



## Run Locally

**Prerequisites:**  Node.js


1. Install backend dependencies:
   `cd backend && npm install`
2. Install frontend dependencies:
   `cd frontend && npm install`
3. Set backend environment variables in `backend/.env`:
   `DATABASE_URL` should be your PostgreSQL connection string
   `JWT_SECRET` should be a strong secret used to sign auth cookies
4. Run the backend:
   `npm run dev:backend`
5. Run the frontend:
   `npm run dev:frontend`
