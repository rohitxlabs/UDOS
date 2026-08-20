"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma as platformDb } from "@/lib/prisma";
import { collegeDb } from "@/lib/college-db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth/session";
import { writePlatformAuditLog, writeCollegeAuditLog } from "@/lib/audit";

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

  // One form, two identity spaces: the platform owner's Super Admin (platform
  // database) and the college's own users (college database). Which one this
  // is gets decided here, by where the username is found, and is then fixed
  // in the signed session — the client never gets to say which it wants.
  //
  // Platform is checked first so a college could never shadow the Super Admin
  // login by creating a user with the same name in its own database.
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

  const user = await collegeDb.user.findUnique({ where: { username }, include: { role: true } });

  if (!user || !user.isActive) {
    return { error: "Invalid username or password" };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    await writeCollegeAuditLog(collegeDb, {
      userId: user.id,
      roleName: user.role?.name ?? null,
      action: "LOGIN_FAILED",
      module: "auth",
      recordId: user.id,
    });
    return { error: "Invalid username or password" };
  }

  await createSession({
    scope: "COLLEGE",
    userId: user.id,
    username: user.username,
    name: user.name,
    roleId: user.roleId,
    roleName: user.role?.name ?? null,
    mustChangePassword: user.mustChangePassword,
  });
  await collegeDb.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeCollegeAuditLog(collegeDb, {
    userId: user.id,
    roleName: user.role?.name ?? null,
    action: "LOGIN_SUCCESS",
    module: "auth",
    recordId: user.id,
  });

  redirect(user.mustChangePassword ? "/dashboard/change-password" : "/dashboard");
}
