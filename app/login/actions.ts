"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

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

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !user.isActive) {
    return { error: "Invalid username or password" };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    await writeAuditLog({
      userId: user.id,
      role: user.role,
      action: "LOGIN_FAILED",
      module: "auth",
      recordId: user.id,
    });
    return { error: "Invalid username or password" };
  }

  await createSession(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({
    userId: user.id,
    role: user.role,
    action: "LOGIN_SUCCESS",
    module: "auth",
    recordId: user.id,
  });

  redirect(user.mustChangePassword ? "/dashboard/change-password" : "/dashboard");
}
