import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma";

export async function writeAuditLog(params: {
  userId: string | null;
  role: Role | null;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const headerList = await headers();
  const ipAddress =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? undefined;
  const userAgent = headerList.get("user-agent") ?? undefined;

  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      role: params.role,
      action: params.action,
      module: params.module,
      recordId: params.recordId,
      oldValue: params.oldValue === undefined ? undefined : (params.oldValue as object),
      newValue: params.newValue === undefined ? undefined : (params.newValue as object),
      ipAddress,
      userAgent,
    },
  });
}
