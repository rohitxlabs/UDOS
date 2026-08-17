"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";
import type { Capability, Module } from "@/lib/permissions";
import type { PermissionAction } from "@/app/generated/tenant-prisma/client";

const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
});

export type CreateRoleState = { error?: string; success?: boolean };

export async function createRole(_prev: CreateRoleState, formData: FormData): Promise<CreateRoleState> {
  const ctx = await requireCapability("roles", "create");

  const parsed = createRoleSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const role = await ctx.db.role.create({ data: { name: parsed.data.name } });
    await writeTenantAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: "ROLE_CREATED",
      module: "roles",
      recordId: role.id,
      newValue: { name: role.name },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: `A role named "${parsed.data.name}" already exists` };
    }
    throw err;
  }

  revalidatePath("/dashboard/roles");
  return { success: true };
}

export async function deleteRole(id: string) {
  const ctx = await requireCapability("roles", "delete");

  const role = await ctx.db.role.findUniqueOrThrow({ where: { id } });
  if (role.isSystem) throw new Error("This role is required by the system and cannot be deleted");

  try {
    await ctx.db.role.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "role"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "ROLE_DELETED",
    module: "roles",
    recordId: id,
    oldValue: { name: role.name },
  });

  revalidatePath("/dashboard/roles");
}

export async function setRolePermission(roleId: string, moduleKey: Module, action: Capability, granted: boolean) {
  const ctx = await requireCapability("roles", "edit");
  const upperAction = action.toUpperCase() as PermissionAction;

  if (granted) {
    await ctx.db.rolePermission.upsert({
      where: { roleId_moduleKey_action: { roleId, moduleKey, action: upperAction } },
      update: {},
      create: { roleId, moduleKey, action: upperAction },
    });
  } else {
    await ctx.db.rolePermission.deleteMany({ where: { roleId, moduleKey, action: upperAction } });
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: granted ? "PERMISSION_GRANTED" : "PERMISSION_REVOKED",
    module: "roles",
    recordId: roleId,
    newValue: { moduleKey, action },
  });

  revalidatePath(`/dashboard/roles/${roleId}`);
}
