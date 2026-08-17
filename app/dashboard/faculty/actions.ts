"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { createLoginAccount } from "@/lib/provisioning";
import { hashPassword, generatePassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  employeeId: z.string().trim().min(1, "Employee ID is required"),
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
  const session = await requireCapability("faculty", "create");

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    employeeId: formData.get("employeeId"),
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

  const { name, employeeId, departmentId, designation, qualification, joiningDate, email, phone, customUsername, customPassword } =
    parsed.data;

  const existingEmployee = await prisma.teacher.findUnique({ where: { employeeId } });
  if (existingEmployee) return { error: `Employee ID "${employeeId}" is already in use` };

  const result = await prisma.$transaction(async (tx) => {
    const account = await createLoginAccount(tx, {
      name,
      role: "TEACHER",
      email,
      phone,
      customUsername,
      customPassword,
      createdById: session.userId,
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
  });

  if ("error" in result) return { error: result.error };

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
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
  const session = await requireCapability("faculty", "edit");

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

  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) return { error: "Faculty member not found" };

  const duplicateEmployee = await prisma.teacher.findFirst({ where: { employeeId, NOT: { id } } });
  if (duplicateEmployee) return { error: `Employee ID "${employeeId}" is already in use` };

  await prisma.$transaction([
    prisma.teacher.update({
      where: { id },
      data: { employeeId, departmentId, designation, qualification, joiningDate: joiningDate ? new Date(joiningDate) : null },
    }),
    prisma.user.update({ where: { id: teacher.userId }, data: { name, email: email || null, phone: phone || null } }),
  ]);

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
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
  const session = await requireCapability("faculty", "edit");
  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { id } });

  await prisma.user.update({ where: { id: teacher.userId }, data: { isActive: nextActive } });

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: nextActive ? "FACULTY_ACTIVATED" : "FACULTY_DEACTIVATED",
    module: "faculty",
    recordId: id,
  });

  revalidatePath("/dashboard/faculty");
  revalidatePath(`/dashboard/faculty/${id}`);
}

export async function assignFacultySubject(teacherId: string, subjectId: string, sectionId: string) {
  const session = await requireCapability("faculty", "edit");

  try {
    await prisma.facultySubject.create({ data: { teacherId, subjectId, sectionId } });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      throw new Error("This teacher is already assigned to that subject and section");
    }
    throw err;
  }

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "FACULTY_SUBJECT_ASSIGNED",
    module: "faculty",
    recordId: teacherId,
    newValue: { subjectId, sectionId },
  });

  revalidatePath(`/dashboard/faculty/${teacherId}`);
}

export async function unassignFacultySubject(facultySubjectId: string, teacherId: string) {
  const session = await requireCapability("faculty", "edit");

  try {
    await prisma.facultySubject.delete({ where: { id: facultySubjectId } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "assignment"));
  }

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "FACULTY_SUBJECT_UNASSIGNED",
    module: "faculty",
    recordId: teacherId,
  });

  revalidatePath(`/dashboard/faculty/${teacherId}`);
}

export async function resetFacultyPassword(id: string): Promise<{ password: string }> {
  const session = await requireCapability("faculty", "edit");
  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { id } });

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await prisma.user.update({ where: { id: teacher.userId }, data: { passwordHash, mustChangePassword: true } });

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "FACULTY_PASSWORD_RESET",
    module: "faculty",
    recordId: id,
  });

  revalidatePath(`/dashboard/faculty/${id}`);
  return { password };
}
