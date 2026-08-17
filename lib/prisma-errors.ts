import { Prisma } from "@/app/generated/prisma/client";

// Deletes across this schema hit foreign-key constraints often (a
// Department can't be removed while Courses reference it, etc.) — this
// turns that into a message an admin can act on instead of a stack trace.
export function friendlyDeleteError(err: unknown, entityLabel: string): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      return `Cannot delete this ${entityLabel} because other records still reference it.`;
    }
    if (err.code === "P2025") {
      return `This ${entityLabel} no longer exists.`;
    }
  }
  throw err;
}
