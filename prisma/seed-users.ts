import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { supabaseAdmin } from "../supabase";

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
  const {
    data: { users },
    error: listError,
  } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    throw listError;
  }

  const existingUser = users.find((authUser: any) => authUser.email?.toLowerCase() === user.email.toLowerCase());

  if (existingUser) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        department: user.department,
        role: user.role,
      },
    });

    if (error || !data.user) {
      throw error || new Error(`Failed to update auth user for ${user.email}`);
    }

    return data.user;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: {
      name: user.name,
      department: user.department,
      role: user.role,
    },
  });

  if (error || !data.user) {
    throw error || new Error(`Failed to create auth user for ${user.email}`);
  }

  return data.user;
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to seed auth users.");
  }

  for (const user of seedUsers) {
    const authUser = await upsertAuthUser(user);

    const profile = await prisma.profile.upsert({
      where: { email: user.email },
      update: {
        id: authUser.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
      create: {
        id: authUser.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
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
