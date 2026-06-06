import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize Prisma");
}

function getPoolConfig(url: string): pg.PoolConfig {
  const parsedUrl = new URL(url);
  const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
  const hasSslConfig = parsedUrl.searchParams.has("ssl")
    || parsedUrl.searchParams.has("sslmode")
    || parsedUrl.searchParams.has("sslrootcert");

  return {
    connectionString: parsedUrl.toString(),
    ssl: !isLocalDatabase && !hasSslConfig && process.env.DATABASE_SSL_NO_VERIFY !== "false"
      ? { rejectUnauthorized: false }
      : undefined,
  };
}

const adapter = new PrismaPg(getPoolConfig(connectionString));

export const prisma = new PrismaClient({ adapter });
