"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { createLoginAccount } from "@/lib/provisioning";
import { hashPassword, generatePassword } from "@/lib/password";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  roleId: z.string().trim().min(1, "Role is required"),
  departmentId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  designation: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  qualification: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  joiningDate: z.preprocess(emptyToUndefined, z.string().optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  customUsername: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  customPassword: z.preprocess(
    emptyToUndefined,
    z.string().min(8, "Password must be at least 8 characters").optional()
  ),
});

export type CreateFacultyState = {
  error?: string;
  success?: { username: string; password: string; name: string };
};

export async function createFaculty(_prev: CreateFacultyState, formData: FormData): Promise<CreateFacultyState> {
  const ctx = await requireCapability("faculty", "create");

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    employeeId: formData.get("employeeId"),
    roleId: formData.get("roleId"),
    departmentId: formData.get("departmentId"),
    designation: formData.get("designation"),
    qualification: formData.get("qualification"),
    joiningDate: formData.get("joiningDate"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    customUsername: formData.get("customUsername"),
    customPassword: formData.get("customPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const {
    name,
    employeeId,
    roleId,
    departmentId,
    designation,
    qualification,
    joiningDate,
    email,
    phone,
    customUsername,
    customPassword,
  } = parsed.data;

  const existingEmployee = await ctx.db.teacher.findUnique({ where: { employeeId } });
  if (existingEmployee) return { error: `Employee ID "${employeeId}" is already in use` };

  const result = await ctx.db.$transaction(async (tx) => {
    const account = await createLoginAccount(ctx.collegeId, tx, {
      name,
      roleId,
      email,
      phone,
      customUsername,
      customPassword,
      createdById: ctx.userId,
    });
    if ("error" in account) return account;

    const teacher = await tx.teacher.create({
      data: {
        userId: account.userId,
        employeeId,
        departmentId,
        designation,
        qualification,
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      },
    });

    return { ...account, teacherId: teacher.id };
  }, { timeout: 30_000, maxWait: 15_000 });

  if ("error" in result) return { error: result.error };

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "FACULTY_CREATED",
    module: "faculty",
    recordId: result.teacherId,
    newValue: { name, employeeId, username: result.username },
  });

  revalidatePath("/dashboard/faculty");
  return { success: { username: result.username, password: result.password, name } };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Name is required"),
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  departmentId: z.preprocess(emptyToUndefined, z.string().optional()),
  designation: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  qualification: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  joiningDate: z.preprocess(emptyToUndefined, z.string().optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type UpdateFacultyState = { error?: string; success?: boolean };

export async function updateFaculty(_prev: UpdateFacultyState, formData: FormData): Promise<UpdateFacultyState> {
  const ctx = await requireCapability("faculty", "edit");

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    employeeId: formData.get("employeeId"),
    departmentId: formData.get("departmentId"),
    designation: formData.get("designation"),
    qualification: formData.get("qualification"),
    joiningDate: formData.get("joiningDate"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, name, employeeId, departmentId, designation, qualification, joiningDate, email, phone } = parsed.data;

  const teacher = await ctx.db.teacher.findUnique({ where: { id } });
  if (!teacher) return { error: "Faculty member not found" };

  const duplicateEmployee = await ctx.db.teacher.findFirst({ where: { employeeId, NOT: { id } } });
  if (duplicateEmployee) return { error: `Employee ID "${employeeId}" is already in use` };

  await ctx.db.$transaction([
    ctx.db.teacher.update({
      where: { id },
      data: { employeeId, departmentId, designation, qualification, joiningDate: joiningDate ? new Date(joiningDate) : null },
    }),
    ctx.db.user.update({ where: { id: teacher.userId }, data: { name, email: email || null, phone: phone || null } }),
  ]);

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "FACULTY_UPDATED",
    module: "faculty",
    recordId: id,
    newValue: { name, employeeId, departmentId },
  });

  revalidatePath("/dashboard/faculty");
  revalidatePath(`/dashboard/faculty/${id}`);
  return { success: true };
}

export async function toggleFacultyActive(id: string, nextActive: boolean) {
  const ctx = await requireCapability("faculty", "edit");
  const teacher = await ctx.db.teacher.findUniqueOrThrow({ where: { id } });

  await ctx.db.user.update({ where: { id: teacher.userId }, data: { isActive: nextActive } });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: nextActive ? "FACULTY_ACTIVATED" : "FACULTY_DEACTIVATED",
    module: "faculty",
    recordId: id,
  });

  revalidatePath("/dashboard/faculty");
  revalidatePath(`/dashboard/faculty/${id}`);
}

export async function assignFacultySubject(teacherId: string, subjectId: string, sectionId: string) {
  const ctx = await requireCapability("faculty", "edit");

  try {
    await ctx.db.facultySubject.create({ data: { teacherId, subjectId, sectionId } });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      throw new Error("This teacher is already assigned to that subject and section");
    }
    throw err;
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "FACULTY_SUBJECT_ASSIGNED",
    module: "faculty",
    recordId: teacherId,
    newValue: { subjectId, sectionId },
  });

  revalidatePath(`/dashboard/faculty/${teacherId}`);
}

export async function unassignFacultySubject(facultySubjectId: string, teacherId: string) {
  const ctx = await requireCapability("faculty", "edit");

  try {
    await ctx.db.facultySubject.delete({ where: { id: facultySubjectId } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "assignment"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "FACULTY_SUBJECT_UNASSIGNED",
    module: "faculty",
    recordId: teacherId,
  });

  revalidatePath(`/dashboard/faculty/${teacherId}`);
}

export async function resetFacultyPassword(id: string): Promise<{ password: string }> {
  const ctx = await requireCapability("faculty", "edit");
  const teacher = await ctx.db.teacher.findUniqueOrThrow({ where: { id } });

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await ctx.db.user.update({ where: { id: teacher.userId }, data: { passwordHash, mustChangePassword: true } });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "FACULTY_PASSWORD_RESET",
    module: "faculty",
    recordId: id,
  });

  revalidatePath(`/dashboard/faculty/${id}`);
  return { password };
}
