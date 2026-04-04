<div align="center">

</div>



This contains everything you need to run your app locally.



## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the environment variables in `.env`:
   `DATABASE_URL` should be your Supabase session pooler URL
   `DIRECT_URL` can optionally be your Supabase direct database URL for Prisma operations
   `GEMINI_API_KEY` should be your Gemini API key
3. Run the app:
   `npm run dev`
