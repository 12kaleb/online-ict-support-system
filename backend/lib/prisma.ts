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
  const shouldDisableCertificateVerification = !isLocalDatabase
    && process.env.DATABASE_SSL_NO_VERIFY !== "false";

  if (shouldDisableCertificateVerification) {
    parsedUrl.searchParams.delete("ssl");
    parsedUrl.searchParams.delete("sslmode");
    parsedUrl.searchParams.delete("sslrootcert");
    parsedUrl.searchParams.delete("sslcert");
    parsedUrl.searchParams.delete("sslkey");
  }

  return {
    connectionString: parsedUrl.toString(),
    ssl: shouldDisableCertificateVerification ? { rejectUnauthorized: false } : undefined,
  };
}

const adapter = new PrismaPg(getPoolConfig(connectionString));

export const prisma = new PrismaClient({ adapter });
