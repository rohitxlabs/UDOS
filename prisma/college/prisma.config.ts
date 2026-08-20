// Config for the college schema (prisma/college/schema.prisma) — the ERP
// database of the one college this deployment serves.
//
//   npx prisma generate     --config prisma/college/prisma.config.ts
//   npx prisma migrate deploy --config prisma/college/prisma.config.ts
//
// The full schema is always applied: every deployment gets every table,
// and which modules the college may actually use is decided in the platform
// database, not by the presence or absence of tables here.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: process.env["COLLEGE_DATABASE_URL"],
  },
});
