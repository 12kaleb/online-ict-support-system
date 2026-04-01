import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const manager1 = await prisma.profile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {
      name: "Manager User",
      email: "kalebteshome94@gmail.com",
      role: "manager"
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Manager User",
      email: "kalebteshome94@gmail.com",
      role: "manager"
    }
  });
  
  console.log("Manager user created/updated:", manager1.email);

  const manager2 = await prisma.profile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {
      name: "Manager User",
      email: "manager@example.com",
      role: "manager"
    },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Manager User",
      email: "manager@example.com",
      role: "manager"
    }
  });
  console.log("Manager user created/updated:", manager2.email);

  const technician = await prisma.profile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {
      name: "Technician User",
      email: "tech@example.com",
      role: "technician"
    },
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Technician User",
      email: "tech@example.com",
      role: "technician"
    }
  });
  console.log("Technician user created/updated:", technician.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
