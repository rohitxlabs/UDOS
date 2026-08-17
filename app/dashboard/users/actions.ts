"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { hashPassword, generatePassword, usernameBase } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { Role } from "@/app/generated/prisma/client";

// Student and Parent accounts are provisioned through Admissions / Student
// Management (Phase 2+), where their profile record is created alongside
// the login — not through this generic staff-account screen.
const CREATABLE_ROLES = [Role.SUPER_ADMIN, Role.MANAGEMENT, Role.TEACHER, Role.ACCOUNTS, Role.EXAM_CELL] as const;

// FormData.get() returns null for fields absent from the DOM (e.g. the
// collapsed "advanced" section) and "" for present-but-empty fields —
// normalize both to undefined so z.optional() accepts them.
const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  role: z.enum(CREATABLE_ROLES),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  customUsername: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  customPassword: z.preprocess(
    emptyToUndefined,
    z.string().min(8, "Password must be at least 8 characters").optional()
  ),
});

export type CreateUserState = {
  error?: string;
  success?: { username: string; password: string; name: string };
};

export async function createStaffUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const session = await requireCapability("users", "create");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    customUsername: formData.get("customUsername"),
    customPassword: formData.get("customPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, role, email, phone, customUsername, customPassword } = parsed.data;

  let username = customUsername?.trim();
  if (username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return { error: `Username "${username}" is already taken` };
  } else {
    const base = usernameBase(name);
    let candidate = "";
    let attempt = 0;
    do {
      const suffix = attempt === 0 ? String(Math.floor(100 + Math.random() * 900)) : String(Date.now()).slice(-6);
      candidate = `${base}.${suffix}`;
      attempt++;
    } while ((await prisma.user.findUnique({ where: { username: candidate } })) && attempt < 5);
    username = candidate;
  }

  const password = customPassword?.trim() || generatePassword();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      email: email || null,
      phone: phone || null,
      name,
      role,
      passwordHash,
      mustChangePassword: true,
      createdById: session.userId,
    },
  });

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "USER_CREATED",
    module: "users",
    recordId: user.id,
    newValue: { username: user.username, role: user.role, name: user.name },
  });

  revalidatePath("/dashboard/users");
  return { success: { username, password, name } };
}

export async function toggleUserActive(userId: string, nextActive: boolean) {
  const session = await requireCapability("users", "edit");
  if (userId === session.userId) throw new Error("You cannot deactivate your own account");

  const user = await prisma.user.update({ where: { id: userId }, data: { isActive: nextActive } });

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: nextActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    module: "users",
    recordId: user.id,
    newValue: { isActive: nextActive },
  });

  revalidatePath("/dashboard/users");
}

export async function resetUserPassword(userId: string): Promise<{ password: string }> {
  const session = await requireCapability("users", "edit");
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "USER_PASSWORD_RESET",
    module: "users",
    recordId: user.id,
  });

  revalidatePath("/dashboard/users");
  return { password };
}
