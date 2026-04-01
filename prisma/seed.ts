import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
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

  console.log("Seeding Knowledge Base...");

  for (const faq of faqs) {
    await prisma.knowledgeBase.upsert({
      where: { question: faq.question },
      create: faq,
      update: faq,
    });
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
