import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { GATED_MODULES, MODULE_LABELS, MODULE_DEPENDENCIES } from "../lib/permissions";

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

  // "users"/"roles"/"settings"/"auditLogs" are core tenant self-admin, not
  // gate-able platform modules — remove any stale catalog rows for them.
  await prisma.module.deleteMany({ where: { key: { in: ["users", "roles", "settings", "auditLogs"] } } });

  for (const key of GATED_MODULES) {
    await prisma.module.upsert({
      where: { key },
      update: { name: MODULE_LABELS[key] },
      create: { key, name: MODULE_LABELS[key] },
    });
  }
  console.log(`Module catalog ready: ${GATED_MODULES.length} modules`);

  // Module dependencies (spec section 11). Mirrored from the single
  // declaration in lib/permissions.ts so the database and the application
  // can never disagree about what needs what.
  const byKey = new Map((await prisma.module.findMany()).map((m) => [m.key, m.id]));
  await prisma.moduleDependency.deleteMany({});
  let edges = 0;
  for (const [moduleKey, deps] of Object.entries(MODULE_DEPENDENCIES)) {
    const moduleId = byKey.get(moduleKey);
    if (!moduleId) continue;
    for (const dep of deps ?? []) {
      const dependsOnId = byKey.get(dep);
      if (!dependsOnId) continue;
      await prisma.moduleDependency.create({ data: { moduleId, dependsOnId } });
      edges++;
    }
  }
  console.log(`Module dependencies ready: ${edges} edges`);
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
