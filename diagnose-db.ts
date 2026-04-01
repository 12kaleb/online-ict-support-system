import { PrismaClient, Prisma } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

async function diagnose() {
  console.log("--- Database Diagnostic (Supabase) ---");
  const url = "postgresql://postgres:%40%23Kaleb1301@db.qmmojzifrvtkvlysjpbh.supabase.co:5432/postgres?sslmode=require";
  
  console.log(`📡 Attempting to connect to: db.qmmojzifrvtkvlysjpbh.supabase.co`);
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: url,
      },
    },
  });

  try {
    console.log("⏳ Connecting...");
    await prisma.$connect();
    console.log("✅ Connection successful!");
    
    console.log("⏳ Querying AssetType count...");
    const count = await prisma.assetType.count();
    console.log(`✅ Query successful! AssetType count: ${count}`);
    
  } catch (err: any) {
    console.error("❌ Connection failed!");
    
    if (err instanceof Prisma.PrismaClientInitializationError) {
      console.error("Type: PrismaClientInitializationError");
      console.error(`Code: ${err.errorCode}`);
      console.error(`Message: ${err.message}`);
      
      if (err.message.includes("Can't reach database server")) {
        console.error("\n💡 SUGGESTION: The database server is unreachable.");
        console.error("1. Check if the host and port are correct.");
        console.error("2. Ensure your database provider allows connections from this environment.");
        console.error("3. If using Neon/Supabase, make sure you've added '?sslmode=require' to the URL.");
      }
      
      if (err.message.includes("Authentication failed")) {
        console.error("\n💡 SUGGESTION: Authentication failed. Check your username and password.");
      }
    } else {
      console.error("Unknown Error:", err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
