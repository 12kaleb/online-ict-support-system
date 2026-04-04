import { execSync } from "child_process";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set. Use your Supabase session pooler connection string before running this script.");
  process.exit(1);
}

try {
  console.log("⏳ Pushing schema to Supabase...");
  execSync(`npx prisma db push --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
  console.log("✅ Schema pushed successfully!");

  console.log("⏳ Seeding database...");
  execSync(`npx tsx prisma/reset-db.ts`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
  console.log("✅ Database seeded successfully!");
} catch (err) {
  console.error("❌ Failed to push or seed database.");
  process.exit(1);
}
