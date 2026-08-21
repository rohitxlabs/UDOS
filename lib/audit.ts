import "server-only";
import { headers } from "next/headers";
import { prisma as platformDb } from "@/lib/prisma";
import type { CollegeDb } from "@/lib/college-db";

// Audit writes are deliberately best-effort.
//
// Every caller logs *after* performing its mutation, and a platform audit
// entry lives in a different database than the college data most actions
// change — so no transaction spans the two, and a throw here cannot roll
// anything back. All it can do is turn a completed operation into a 500 and
// discard whatever the action was about to return.
//
// That is not hypothetical: it is how reissuing a College Admin password
// managed to change the password and then lose it. The audit insert failed on
// a stale foreign key, the exception escaped, and the only copy of the newly
// generated credential went with it — leaving the college locked out of an
// account whose password had genuinely been changed.
//
// So a failed write is reported loudly to the server console and swallowed.
// Letting it throw does not protect the audit trail; it only damages the
// operation the trail exists to describe.
function reportAuditFailure(kind: string, action: string, module: string, err: unknown) {
  console.error(
    `[audit] failed to record ${kind} "${action}" on ${module}:`,
    err instanceof Error ? err.message : err
  );
}

async function requestMeta() {
  const headerList = await headers();
  return {
    ipAddress:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? undefined,
    userAgent: headerList.get("user-agent") ?? undefined,
  };
}
//

// The college's own activity log — lives in the college database, owned by
// the college and readable by its own admins. Takes `db` from the caller's
// access context rather than importing the singleton, so a log line is always
// written through the same client that performed the action it describes.
export async function writeCollegeAuditLog(
  db: CollegeDb,
  params: {
    userId: string | null;
    roleName: string | null;
    action: string;
    module: string;
    recordId?: string;
    oldValue?: unknown;
    newValue?: unknown;
  }
) {
  try {
    const meta = await requestMeta();
    await db.auditLog.create({
      data: {
        userId: params.userId,
        roleName: params.roleName,
        action: params.action,
        module: params.module,
        recordId: params.recordId,
        oldValue: params.oldValue === undefined ? undefined : (params.oldValue as object),
        newValue: params.newValue === undefined ? undefined : (params.newValue as object),
        ...meta,
      },
    });
  } catch (err) {
    reportAuditFailure("college", params.action, params.module, err);
  }
}

// What the platform owner did to this deployment: module grants and
// revocations, College Admin password reissues, Super Admin sign-ins. Kept in
// the platform database, where the college cannot see or alter it.
export async function writePlatformAuditLog(params: {
  userId: string | null;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  try {
    const meta = await requestMeta();
    await platformDb.platformAuditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        module: params.module,
        recordId: params.recordId,
        oldValue: params.oldValue === undefined ? undefined : (params.oldValue as object),
        newValue: params.newValue === undefined ? undefined : (params.newValue as object),
        ...meta,
      },
    });
  } catch (err) {
    reportAuditFailure("platform", params.action, params.module, err);
  }
}
