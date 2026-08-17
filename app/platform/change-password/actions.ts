"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requirePlatform } from "@/lib/auth/dal";
import { prisma as platformDb } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth/session";
import { writePlatformAuditLog } from "@/lib/audit";

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

export type ChangePasswordState = { error?: string };

export async function changePlatformPassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const ctx = await requirePlatform();

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await platformDb.platformUser.findUniqueOrThrow({ where: { id: ctx.userId } });
  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect" };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const updated = await platformDb.platformUser.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await createSession({
    scope: "PLATFORM",
    userId: updated.id,
    username: updated.username,
    name: updated.name,
    platformRole: updated.platformRole,
    mustChangePassword: false,
  });

  await writePlatformAuditLog({ userId: user.id, action: "PASSWORD_CHANGED", module: "auth", recordId: user.id });

  redirect("/platform");
}
