// Deletes across this schema hit foreign-key constraints often (a
// Department can't be removed while Courses reference it, etc.) — this
// turns that into a message an admin can act on instead of a stack trace.
//
// Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError`
// on purpose: platform and tenant queries run through two separately
// generated Prisma Client packages, each with their own class identity, so
// an `instanceof` check against one would silently miss errors from the
// other. Both shapes expose the same `code`.
function isPrismaKnownRequestError(err: unknown): err is { code: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    "clientVersion" in err
  );
}

export function friendlyDeleteError(err: unknown, entityLabel: string): string {
  if (isPrismaKnownRequestError(err)) {
    if (err.code === "P2003") {
      return `Cannot delete this ${entityLabel} because other records still reference it.`;
    }
    if (err.code === "P2025") {
      return `This ${entityLabel} no longer exists.`;
    }
  }
  throw err;
}
