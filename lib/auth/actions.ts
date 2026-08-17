"use server";

import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/auth/session";
import { verifySession } from "@/lib/auth/dal";
import { writeAuditLog } from "@/lib/audit";

export async function logout() {
  const session = await verifySession();
  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "LOGOUT",
    module: "auth",
    recordId: session.userId,
  });
  await deleteSession();
  redirect("/login");
}
