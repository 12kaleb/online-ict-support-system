import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function main() {
  const maintenances = await prisma.maintenance.findMany({
    where: {
      title: {
        startsWith: 'Maintenance for '
      }
    },
    include: {
      asset: true
    }
  });

  for (const m of maintenances) {
    if (m.asset && m.title === `Maintenance for ${m.assetId}`) {
      console.log(`Updating maintenance ${m.id} title from "${m.title}" to "Maintenance for ${m.asset.name}"`);
      await prisma.maintenance.update({
        where: { id: m.id },
        data: { title: `Maintenance for ${m.asset.name}` }
      });
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
