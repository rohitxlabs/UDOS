import "server-only";
import { headers } from "next/headers";
import { prisma as platformDb } from "@/lib/prisma";
import type { PrismaClient as TenantPrismaClient } from "@/app/generated/tenant-prisma/client";

async function requestMeta() {
  const headerList = await headers();
  return {
    ipAddress:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? undefined,
    userAgent: headerList.get("user-agent") ?? undefined,
  };
}

// A college's own activity log — lives in that college's own database.
export async function writeTenantAuditLog(
  db: TenantPrismaClient,
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
}

// Platform-level activity (tenant lifecycle, module toggles, plans, ...).
export async function writePlatformAuditLog(params: {
  userId: string | null;
  collegeId?: string | null;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const meta = await requestMeta();
  await platformDb.platformAuditLog.create({
    data: {
      userId: params.userId,
      collegeId: params.collegeId ?? null,
      action: params.action,
      module: params.module,
      recordId: params.recordId,
      oldValue: params.oldValue === undefined ? undefined : (params.oldValue as object),
      newValue: params.newValue === undefined ? undefined : (params.newValue as object),
      ...meta,
    },
  });
}
