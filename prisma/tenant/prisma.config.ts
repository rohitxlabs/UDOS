// Config for the tenant schema (prisma/tenant/schema.prisma). Used two ways:
//  - `npx prisma generate --config prisma/tenant/prisma.config.ts` to build
//    the tenant Prisma Client (app/generated/tenant-prisma) from a schema,
//    not a live database.
//  - `npx prisma migrate deploy --config prisma/tenant/prisma.config.ts`
//    with TENANT_DATABASE_URL set to a specific college's connection string
//    to provision/upgrade that one tenant database (see lib/tenant-db.ts).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: process.env["TENANT_DATABASE_URL"],
  },
});
