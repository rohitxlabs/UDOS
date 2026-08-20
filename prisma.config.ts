// Config for the platform schema (prisma/schema.prisma) — this deployment's
// control-plane database: the college profile, the module grants and the
// platform Super Admin.
//
//   npx prisma migrate deploy
//   npx prisma db seed
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["PLATFORM_DATABASE_URL"],
  },
});
