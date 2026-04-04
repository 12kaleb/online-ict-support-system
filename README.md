<div align="center">

</div>



This contains everything you need to run your app locally.



## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the environment variables in `.env`:
   `DATABASE_URL` should be your PostgreSQL connection string
   `DIRECT_URL` can optionally be a direct PostgreSQL connection string for Prisma operations
   `GEMINI_API_KEY` should be your Gemini API key
   `JWT_SECRET` should be a strong secret used to sign auth cookies
3. Run the app:
   `npm run dev`
