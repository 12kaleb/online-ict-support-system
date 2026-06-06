import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize Prisma");
}

function getConnectionString(url: string) {
  const parsedUrl = new URL(url);
  const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
  const hasSslConfig = parsedUrl.searchParams.has("ssl")
    || parsedUrl.searchParams.has("sslmode")
    || parsedUrl.searchParams.has("sslrootcert");

  if (!isLocalDatabase && !hasSslConfig && process.env.DATABASE_SSL_NO_VERIFY !== "false") {
    parsedUrl.searchParams.set("ssl", "no-verify");
  }

  return parsedUrl.toString();
}

const adapter = new PrismaPg(getConnectionString(connectionString));

export const prisma = new PrismaClient({ adapter });
