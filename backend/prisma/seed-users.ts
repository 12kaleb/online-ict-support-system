import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { getSeedPassword, seedUsers, type SeedUser } from "./seed-data.js";
import { prisma } from "../lib/prisma.js";

dotenv.config();

async function upsertAuthUser(user: SeedUser) {
  const password = getSeedPassword(user.passwordEnv);
  return {
    email: user.email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
  };
}

async function main() {
  for (const user of seedUsers) {
    const authUser = await upsertAuthUser(user);

    const profile = await prisma.profile.upsert({
      where: { email: authUser.email },
      update: {
        name: user.name,
        email: authUser.email,
        role: user.role,
        status: "active",
        department: user.department,
        passwordHash: authUser.passwordHash,
      },
      create: {
        name: user.name,
        email: authUser.email,
        role: user.role,
        status: "active",
        department: user.department,
        passwordHash: authUser.passwordHash,
      },
    });

    console.log(`Seeded ${profile.role}: ${profile.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
