import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin@master", 12);

  const superAdmin = await prisma.user.upsert({
    where: { username: "rohit" },
    update: {},
    create: {
      username: "rohit",
      name: "Rohit",
      role: "SUPER_ADMIN",
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  console.log(`Super Admin ready: ${superAdmin.username}`);
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
