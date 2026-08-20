import "server-only";
import { PrismaClient as CollegePrismaClient } from "@/app/generated/college-prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// This deployment's college database — students, staff, academics, fees, and
// the college's own users and roles.
//
// One deployment serves one college, so this is a plain singleton client
// against a single connection string. There is no tenant resolution step and
// nothing to look up: the database a request talks to is fixed by the
// deployment it is running in, which is the strongest form of the isolation
// guarantee — a request cannot reach another college's data because no other
// college's data exists on this server.
const connectionString = process.env.COLLEGE_DATABASE_URL;
if (!connectionString) throw new Error("COLLEGE_DATABASE_URL environment variable is not set");

const globalForCollegeDb = globalThis as unknown as {
  collegeDb: CollegePrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString });

export const collegeDb = globalForCollegeDb.collegeDb ?? new CollegePrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForCollegeDb.collegeDb = collegeDb;

export type CollegeDb = CollegePrismaClient;
