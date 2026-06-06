import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config();

async function diagnose() {
  console.log("--- Database Diagnostic (PostgreSQL) ---");
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("Attempting to connect using DATABASE_URL");

  const adapter = new PrismaPg(url);
  const prisma = new PrismaClient({
    adapter,
    log: ["query", "info", "warn", "error"],
  });

  try {
    console.log("Connecting...");
    await prisma.$connect();
    console.log("Connection successful!");

    console.log("Querying AssetType count...");
    const count = await prisma.assetType.count();
    console.log(`Query successful! AssetType count: ${count}`);
  } catch (err: any) {
    console.error("Connection failed!");

    if (err instanceof Prisma.PrismaClientInitializationError) {
      console.error("Type: PrismaClientInitializationError");
      console.error(`Code: ${err.errorCode}`);
      console.error(`Message: ${err.message}`);

      if (err.message.includes("Can't reach database server")) {
        console.error("\nSUGGESTION: The database server is unreachable.");
        console.error("1. Check if the host and port are correct.");
        console.error("2. Ensure your database provider allows connections from this environment.");
        console.error("3. If using managed PostgreSQL, verify any required SSL parameters.");
      }

      if (err.message.includes("Authentication failed")) {
        console.error("\nSUGGESTION: Authentication failed. Check your username and password.");
      }
    } else {
      console.error("Unknown Error:", err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
