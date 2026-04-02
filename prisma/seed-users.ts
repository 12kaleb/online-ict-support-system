import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.profile.create({
    data: {
      name: "Admin User",
      email: "kalebteshome94@gmail.com",
      role: "admin"
    }
  });
  
  console.log("Admin user created:", admin.email);

  const manager = await prisma.profile.create({
    data: {
      name: "Manager User",
      email: "manager@example.com",
      role: "manager"
    }
  });
  console.log("Manager user created:", manager.email);

  const technician = await prisma.profile.create({
    data: {
      name: "Technician User",
      email: "tech@example.com",
      role: "technician"
    }
  });
  console.log("Technician user created:", technician.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
