"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .transform((v) => v.toUpperCase()),
});

export type DepartmentState = { error?: string; success?: boolean };

export async function saveDepartment(_prev: DepartmentState, formData: FormData): Promise<DepartmentState> {
  const ctx = await requireCapability("departments", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, name, code } = parsed.data;

  try {
    const dept = id
      ? await ctx.db.department.update({ where: { id }, data: { name, code } })
      : await ctx.db.department.create({ data: { name, code } });

    await writeTenantAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: id ? "DEPARTMENT_UPDATED" : "DEPARTMENT_CREATED",
      module: "departments",
      recordId: dept.id,
      newValue: { name, code },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: `Department code "${code}" is already in use` };
    }
    throw err;
  }

  revalidatePath("/dashboard/departments");
  return { success: true };
}

export async function deleteDepartment(id: string) {
  const ctx = await requireCapability("departments", "delete");

  try {
    await ctx.db.department.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "department"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "DEPARTMENT_DELETED",
    module: "departments",
    recordId: id,
  });

  revalidatePath("/dashboard/departments");
}
