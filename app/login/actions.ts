"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma as platformDb } from "@/lib/prisma";
import { getTenantClient } from "@/lib/tenant-db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth/session";
import { writePlatformAuditLog, writeTenantAuditLog } from "@/lib/audit";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = {
  error?: string;
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { username, password } = parsed.data;

  // Two separate identity spaces share one form (spec section 16) — figure
  // out which one this username belongs to before we can check a password.
  const platformUser = await platformDb.platformUser.findUnique({ where: { username } });

  if (platformUser) {
    if (!platformUser.isActive) return { error: "Invalid username or password" };

    const validPassword = await verifyPassword(password, platformUser.passwordHash);
    if (!validPassword) {
      await writePlatformAuditLog({ userId: platformUser.id, action: "LOGIN_FAILED", module: "auth", recordId: platformUser.id });
      return { error: "Invalid username or password" };
    }

    await createSession({
      scope: "PLATFORM",
      userId: platformUser.id,
      username: platformUser.username,
      name: platformUser.name,
      platformRole: platformUser.platformRole,
      mustChangePassword: platformUser.mustChangePassword,
    });
    await platformDb.platformUser.update({ where: { id: platformUser.id }, data: { lastLoginAt: new Date() } });
    await writePlatformAuditLog({ userId: platformUser.id, action: "LOGIN_SUCCESS", module: "auth", recordId: platformUser.id });

    redirect(platformUser.mustChangePassword ? "/platform/change-password" : "/platform");
  }

  const directoryEntry = await platformDb.tenantUserDirectory.findUnique({ where: { username } });
  if (!directoryEntry) {
    return { error: "Invalid username or password" };
  }

  const college = await platformDb.college.findUnique({ where: { id: directoryEntry.collegeId } });
  if (!college || !college.isActive) {
    return { error: "Invalid username or password" };
  }

  const db = getTenantClient(college.id, college.databaseUrlEncrypted);
  const user = await db.user.findUnique({ where: { username }, include: { role: true } });

  if (!user || !user.isActive) {
    return { error: "Invalid username or password" };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    await writeTenantAuditLog(db, {
      userId: user.id,
      roleName: user.role?.name ?? null,
      action: "LOGIN_FAILED",
      module: "auth",
      recordId: user.id,
    });
    return { error: "Invalid username or password" };
  }

  await createSession({
    scope: "TENANT",
    userId: user.id,
    username: user.username,
    name: user.name,
    collegeId: college.id,
    collegeSlug: college.slug,
    roleId: user.roleId,
    roleName: user.role?.name ?? null,
    mustChangePassword: user.mustChangePassword,
  });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeTenantAuditLog(db, {
    userId: user.id,
    roleName: user.role?.name ?? null,
    action: "LOGIN_SUCCESS",
    module: "auth",
    recordId: user.id,
  });

  redirect(user.mustChangePassword ? "/dashboard/change-password" : "/dashboard");
}
