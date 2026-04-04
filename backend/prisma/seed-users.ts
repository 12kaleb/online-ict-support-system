import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const prisma = new PrismaClient();

type SeedUser = {
  name: string;
  email: string;
  role: "staff" | "technician" | "manager" | "admin";
  department?: string;
  passwordEnv: string;
};

const seedUsers: SeedUser[] = [
  {
    name: "Admin User",
    email: "kalebteshome94@gmail.com",
    role: "admin",
    department: "ICT",
    passwordEnv: "SEED_ADMIN_PASSWORD",
  },
  {
    name: "Manager User",
    email: "manager@example.com",
    role: "manager",
    department: "ICT",
    passwordEnv: "SEED_MANAGER_PASSWORD",
  },
  {
    name: "Technician User",
    email: "tech@example.com",
    role: "technician",
    department: "ICT",
    passwordEnv: "SEED_TECHNICIAN_PASSWORD",
  },
  {
    name: "Staff User",
    email: "staff@example.com",
    role: "staff",
    department: "Operations",
    passwordEnv: "SEED_STAFF_PASSWORD",
  },
];

function getSeedPassword(envName: string) {
  const password = process.env[envName] || process.env.SEED_DEFAULT_PASSWORD;
  if (!password) {
    throw new Error(
      `Missing ${envName}. Set it in .env or provide SEED_DEFAULT_PASSWORD before running prisma/seed-users.ts.`,
    );
  }

  return password;
}

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
        department: user.department,
        passwordHash: authUser.passwordHash,
      },
      create: {
        name: user.name,
        email: authUser.email,
        role: user.role,
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
