import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log("DATABASE_URL:", dbUrl ? "SET" : "NOT SET");

  if (dbUrl && dbUrl.includes("localhost:5432")) {
    console.warn("CRITICAL: Your DATABASE_URL is set to 'localhost:5432'.");
    console.warn("This will NOT work in the AI Studio environment.");
    console.warn("You must provide a connection string to an external PostgreSQL database.");
    console.warn("(e.g., from a hosted PostgreSQL provider or your production database)");
  }

  try {
    console.log("Attempting to connect to database...");
    await prisma.$connect();
    console.log("Database connection successful!");
  } catch (error: any) {
    console.error("Database connection failed!");
    if (error.errorCode === "P1001") {
      console.error("Error P1001: The database server is unreachable.");
      console.error("This usually means your host/port is incorrect or the server is down.");
    } else if (error.errorCode === "P1012") {
      console.error("Error P1012: Environment variable DATABASE_URL not found.");
    } else {
      console.error("Error details:", error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
