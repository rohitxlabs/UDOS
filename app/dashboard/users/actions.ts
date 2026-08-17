"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { hashPassword, generatePassword } from "@/lib/password";
import { createLoginAccount } from "@/lib/provisioning";
import { writeTenantAuditLog } from "@/lib/audit";

// FormData.get() returns null for fields absent from the DOM (e.g. the
// collapsed "advanced" section) and "" for present-but-empty fields —
// normalize both to undefined so z.optional() accepts them.
const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  roleId: z.string().trim().min(1, "Role is required"),
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

export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const ctx = await requireCapability("users", "create");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    roleId: formData.get("roleId"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    customUsername: formData.get("customUsername"),
    customPassword: formData.get("customPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, roleId, email, phone, customUsername, customPassword } = parsed.data;

  const role = await ctx.db.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "Selected role no longer exists" };

  const result = await createLoginAccount(ctx.collegeId, ctx.db, {
    name,
    roleId,
    email,
    phone,
    customUsername,
    customPassword,
    createdById: ctx.userId,
  });
  if ("error" in result) return { error: result.error };

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "USER_CREATED",
    module: "users",
    recordId: result.userId,
    newValue: { username: result.username, role: role.name, name },
  });

  revalidatePath("/dashboard/users");
  return { success: { username: result.username, password: result.password, name } };
}

export async function toggleUserActive(userId: string, nextActive: boolean) {
  const ctx = await requireCapability("users", "edit");
  if (userId === ctx.userId) throw new Error("You cannot deactivate your own account");

  const user = await ctx.db.user.update({ where: { id: userId }, data: { isActive: nextActive } });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: nextActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    module: "users",
    recordId: user.id,
    newValue: { isActive: nextActive },
  });

  revalidatePath("/dashboard/users");
}

export async function resetUserPassword(userId: string): Promise<{ password: string }> {
  const ctx = await requireCapability("users", "edit");
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const user = await ctx.db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "USER_PASSWORD_RESET",
    module: "users",
    recordId: user.id,
  });

  revalidatePath("/dashboard/users");
  return { password };
}
