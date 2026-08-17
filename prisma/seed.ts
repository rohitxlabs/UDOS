import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { GATED_MODULES, MODULE_LABELS } from "../lib/permissions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin@master", 12);

  const superAdmin = await prisma.platformUser.upsert({
    where: { username: "rohit" },
    update: {},
    create: {
      username: "rohit",
      name: "Rohit",
      platformRole: "SUPER_ADMIN",
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });
  console.log(`Platform Super Admin ready: ${superAdmin.username}`);

  for (const key of GATED_MODULES) {
    await prisma.module.upsert({
      where: { key },
      update: { name: MODULE_LABELS[key] },
      create: { key, name: MODULE_LABELS[key] },
    });
  }
  console.log(`Module catalog ready: ${GATED_MODULES.length} modules`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
