import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The platform (control-plane) database for this deployment: the college
// profile, the module catalog and grants, and the Super Admin login.
// Deliberately a different database from the college's ERP data — see
// lib/college-db.ts.
const connectionString = process.env.PLATFORM_DATABASE_URL;
if (!connectionString) throw new Error("PLATFORM_DATABASE_URL environment variable is not set");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
