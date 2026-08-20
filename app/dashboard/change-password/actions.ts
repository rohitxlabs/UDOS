"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireCollege } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth/session";
import { writeCollegeAuditLog } from "@/lib/audit";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordState = {
  error?: string;
};

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const ctx = await requireCollege();

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.userId } });

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect" };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const updated = await ctx.db.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await createSession({
    scope: "COLLEGE",
    userId: updated.id,
    username: updated.username,
    name: updated.name,
    roleId: updated.roleId,
    roleName: ctx.roleName,
    mustChangePassword: false,
  });

  await writeCollegeAuditLog(ctx.db, {
    userId: user.id,
    roleName: ctx.roleName,
    action: "PASSWORD_CHANGED",
    module: "auth",
    recordId: user.id,
  });

  redirect("/dashboard");
}
