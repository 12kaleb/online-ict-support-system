import { defineConfig } from "@prisma/config/next"

export default defineConfig({
  migrateConnectionURI: process.env.DATABASE_URL ?? ''
})


