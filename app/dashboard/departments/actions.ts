"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { writeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z.object({
  id: z.string().optional(),
  collegeId: z.string().min(1),
  name: z.string().trim().min(2, "Name is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .transform((v) => v.toUpperCase()),
});

export type DepartmentState = { error?: string; success?: boolean };

export async function saveDepartment(_prev: DepartmentState, formData: FormData): Promise<DepartmentState> {
  const session = await requireCapability("departments", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    collegeId: formData.get("collegeId"),
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, collegeId, name, code } = parsed.data;

  try {
    const dept = id
      ? await prisma.department.update({ where: { id }, data: { name, code } })
      : await prisma.department.create({ data: { name, code, collegeId } });

    await writeAuditLog({
      userId: session.userId,
      role: session.role,
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
  const session = await requireCapability("departments", "delete");

  try {
    await prisma.department.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "department"));
  }

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "DEPARTMENT_DELETED",
    module: "departments",
    recordId: id,
  });

  revalidatePath("/dashboard/departments");
}
