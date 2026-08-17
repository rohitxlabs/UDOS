"use server";

import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/auth/session";
import { getAccessContext } from "@/lib/auth/dal";
import { writePlatformAuditLog, writeTenantAuditLog } from "@/lib/audit";

export async function logout() {
  const ctx = await getAccessContext();

  if (ctx.scope === "PLATFORM") {
    await writePlatformAuditLog({ userId: ctx.userId, action: "LOGOUT", module: "auth", recordId: ctx.userId });
    await deleteSession();
    redirect("/login");
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "LOGOUT",
    module: "auth",
    recordId: ctx.userId,
  });
  await deleteSession();
  redirect("/login");
}
