import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.asset.findMany({
    where: { catalogId: null },
    orderBy: { createdAt: "asc" },
  });

  for (const asset of assets as any[]) {
    if (asset.catalogId) {
      continue;
    }

    const catalog = await prisma.assetCatalog.create({
      data: {
        name: asset.name,
        brand: asset.brand,
        typeId: asset.typeId,
        type: asset.type,
        isConsumable: asset.isConsumable,
        minStockLevel: asset.minStockLevel,
      },
    });

    if (asset.isConsumable || asset.quantity <= 1) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          catalogId: catalog.id,
          quantity: asset.isConsumable ? asset.quantity : 1,
        },
      });
      continue;
    }

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        catalogId: catalog.id,
        quantity: 1,
      },
    });

    const extraUnits = Array.from({ length: asset.quantity - 1 }, () => ({
      catalogId: catalog.id,
      name: asset.name,
      brand: asset.brand,
      typeId: asset.typeId,
      type: asset.type,
      quantity: 1,
      minStockLevel: asset.minStockLevel,
      isConsumable: false,
      status: asset.status,
    }));

    if (extraUnits.length > 0) {
      await prisma.asset.createMany({
        data: extraUnits,
      });
    }
  }

  console.log("Asset catalog migration complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
