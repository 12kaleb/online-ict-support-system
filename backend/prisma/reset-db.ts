import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

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
  await prisma.inviteToken.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.allowedEmail.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.knowledgeBase.deleteMany();

  console.log("Database cleared.");

  console.log("Seeding Profiles...");
  
  await prisma.profile.create({
    data: {
      id: "00000000-0000-0000-0000-000000000001", // Placeholder ID
      name: "Admin User",
      email: "kalebteshome94@gmail.com",
      role: "admin",
      status: "active",
    }
  });
  
  await prisma.profile.create({
    data: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Manager User",
      email: "manager@example.com",
      role: "manager",
      status: "active",
    }
  });
 
  await prisma.profile.create({
    data: {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Technician User",
      email: "tech@example.com",
      role: "technician",
      status: "active",
    }
  });

  console.log("Users seeded.");

  console.log("Seeding Knowledge Base...");
  const faqs = [
    {
      question: "How do I create a support ticket?",
      answer: "Open Create Ticket, choose a template or enter your own title and description, then add the building block and room number. You can also attach supported files and link an affected asset when relevant.",
      category: "Tickets"
    },
    {
      question: "How are ticket priorities and SLA deadlines calculated?",
      answer: "The system assigns SLA deadlines by priority: Critical within 4 hours, High within 24 hours, Medium within 3 days, and Low within 7 days. Tickets from the Presidential Bureau are automatically treated as Critical.",
      category: "SLA"
    },
    {
      question: "What happens after a technician resolves my ticket?",
      answer: "Resolved technician work moves to requester confirmation. If the issue is fixed, confirm it as solved. If it still needs work, choose Not Solved so the ticket can return to active handling.",
      category: "Tickets"
    },
    {
      question: "Can I appeal a closed ticket?",
      answer: "Yes. If a ticket was closed but you still need support, open the ticket and submit an appeal with a clear reason. Managers review appeals and decide whether the ticket should be reopened.",
      category: "Approvals"
    },
    {
      question: "How do I request ICT assets or consumables?",
      answer: "Open Assets, find the item you need, and submit a request with the required quantity. Managers approve requests, and ICT staff fulfill them based on stock availability.",
      category: "Assets"
    },
    {
      question: "How do asset returns work?",
      answer: "For assigned assets or consumables, start a return from the asset request or usage record. The return is completed only after the appropriate staff confirmation is recorded in the system.",
      category: "Assets"
    },
    {
      question: "Why does a high-priority closure need approval?",
      answer: "High and Critical tickets require extra control before closure. The system creates an approval request so managers can verify that important issues are not closed prematurely.",
      category: "Approvals"
    },
    {
      question: "Can I receive updates in Telegram?",
      answer: "Yes. Open Profile, choose Connect Telegram, generate a secure link code, then send the generated /start command to the configured Telegram bot. You will receive ticket and approval notifications there.",
      category: "Notifications"
    },
    {
      question: "Who can assign technicians and manage maintenance?",
      answer: "Managers and admins can assign technicians. ICT staff with inventory permissions can manage assets, schedule maintenance, record parts used, and update maintenance status.",
      category: "Maintenance"
    },
    {
      question: "How do new users get access?",
      answer: "Public signup is disabled. Admins can invite staff, managers, and technicians. Managers with staff-invite permission can invite staff users only.",
      category: "Accounts"
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
