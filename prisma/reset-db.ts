import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function main() {
  console.log("Clearing database...");
  
  // Delete in order to avoid foreign key constraints
  await prisma.ticketHistory.deleteMany();
  await prisma.assetUsage.deleteMany();
  await prisma.assetRequest.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.maintenance.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.knowledgeBase.deleteMany();

  console.log("Database cleared.");

  console.log("Seeding Profiles...");
  
  await prisma.profile.create({
    data: {
      id: "00000000-0000-0000-0000-000000000001", // Placeholder ID
      name: "Admin User",
      email: "kalebteshome94@gmail.com",
      role: "manager"
    }
  });
  
  await prisma.profile.create({
    data: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Manager User",
      email: "manager@example.com",
      role: "manager"
    }
  });
 
  await prisma.profile.create({
    data: {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Technician User",
      email: "tech@example.com",
      role: "technician"
    }
  });

  console.log("Users seeded.");

  console.log("Seeding Knowledge Base...");
  const faqs = [
    {
      question: "How do I reset my password?",
      answer: "To reset your password, please contact the ICT helpdesk at extension 1234 or visit the self-service portal at https://password.example.com.",
      category: "Account"
    },
    {
      question: "How do I connect to the office Wi-Fi?",
      answer: "Select the 'Office-Guest' network and use your corporate credentials to log in. For a secure connection, use 'Office-Secure'.",
      category: "Network"
    },
    {
      question: "What should I do if my computer is running slow?",
      answer: "Try restarting your computer first. If the problem persists, check for any background processes consuming high CPU or memory in the Task Manager.",
      category: "Hardware"
    },
    {
      question: "How can I request new software?",
      answer: "All software requests must be submitted through the ICT Support portal by creating a new ticket with the 'Software Request' category.",
      category: "Software"
    },
    {
      question: "How do I set up my email on my phone?",
      answer: "Download the Microsoft Outlook app from the App Store or Google Play Store, and sign in with your corporate email address and password.",
      category: "Software"
    }
  ];

  for (const faq of faqs) {
    await prisma.knowledgeBase.create({
      data: faq
    });
  }

  console.log("Knowledge Base seeded.");
  console.log("Database reset complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
