import { execSync } from "child_process";

const url = "postgresql://postgres:%40%23Kaleb1301@db.qmmojzifrvtkvlysjpbh.supabase.co:5432/postgres?sslmode=require";

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
