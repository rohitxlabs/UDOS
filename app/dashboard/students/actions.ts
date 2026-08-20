"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { createLoginAccount } from "@/lib/provisioning";
import { hashPassword, generatePassword } from "@/lib/password";
import { writeCollegeAuditLog } from "@/lib/audit";
import type { PrismaClient as CollegePrismaClient } from "@/app/generated/college-prisma/client";

// Prisma's default interactive-transaction budget is 5s. That is fine
// against a local database but not against a hosted one: this block does
// several dependent round-trips plus a bcrypt hash, and the whole point of
// the transaction is that a partially-enrolled student never lands. Give it
// room rather than trading away atomicity.
const TX_OPTIONS = { timeout: 30_000, maxWait: 15_000 };

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

const baseFields = {
  name: z.string().trim().min(2, "Name is required"),
  admissionNumber: z.string().trim().min(1, "Admission number is required"),
  enrollmentNumber: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  rollNumber: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  sectionId: z.string().min(1, "Section is required"),
  fatherName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  motherName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  guardianName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  dob: z.preprocess(emptyToUndefined, z.string().optional()),
  gender: z.preprocess(emptyToUndefined, z.enum(GENDERS).optional()),
  bloodGroup: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  category: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  admissionDate: z.preprocess(emptyToUndefined, z.string().optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  state: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  pincode: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
};

const createSchema = z.object({
  ...baseFields,
  roleId: z.string().trim().min(1, "Role is required"),
  customUsername: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  customPassword: z.preprocess(
    emptyToUndefined,
    z.string().min(8, "Password must be at least 8 characters").optional()
  ),
});

export type CreateStudentState = {
  error?: string;
  success?: { username: string; password: string; name: string };
};

async function resolveSection(db: CollegePrismaClient, sectionId: string) {
  return db.section.findUnique({
    where: { id: sectionId },
    include: { semester: { include: { course: true } } },
  });
}

export async function createStudent(_prev: CreateStudentState, formData: FormData): Promise<CreateStudentState> {
  const ctx = await requireCapability("students", "create");

  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existingAdmission = await ctx.db.student.findUnique({ where: { admissionNumber: data.admissionNumber } });
  if (existingAdmission) return { error: `Admission number "${data.admissionNumber}" is already in use` };

  if (data.enrollmentNumber) {
    const existingEnrollment = await ctx.db.student.findUnique({ where: { enrollmentNumber: data.enrollmentNumber } });
    if (existingEnrollment) return { error: `Enrollment number "${data.enrollmentNumber}" is already in use` };
  }

  const section = await resolveSection(ctx.db, data.sectionId);
  if (!section) return { error: "Section not found" };

  const result = await ctx.db.$transaction(async (tx) => {
    const account = await createLoginAccount(tx, {
      name: data.name,
      roleId: data.roleId,
      email: data.email,
      phone: data.phone,
      customUsername: data.customUsername,
      customPassword: data.customPassword,
      createdById: ctx.userId,
    });
    if ("error" in account) return account;

    const student = await tx.student.create({
      data: {
        userId: account.userId,
        admissionNumber: data.admissionNumber,
        enrollmentNumber: data.enrollmentNumber,
        rollNumber: data.rollNumber,
        fatherName: data.fatherName,
        motherName: data.motherName,
        guardianName: data.guardianName,
        dob: data.dob ? new Date(data.dob) : undefined,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        category: data.category,
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : undefined,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        phone: data.phone,
        sectionId: section.id,
        semesterId: section.semesterId,
        courseId: section.semester.courseId,
        departmentId: section.semester.course.departmentId,
        academicYearId: section.semester.academicYearId,
        status: "ACTIVE",
      },
    });

    return { ...account, studentId: student.id };
  }, TX_OPTIONS);

  if ("error" in result) return { error: result.error };

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "STUDENT_CREATED",
    module: "students",
    recordId: result.studentId,
    newValue: { name: data.name, admissionNumber: data.admissionNumber, username: result.username },
  });

  revalidatePath("/dashboard/students");
  return { success: { username: result.username, password: result.password, name: data.name } };
}

const updateSchema = z.object({
  id: z.string().min(1),
  ...baseFields,
  status: z.enum(STATUSES),
});

export type UpdateStudentState = { error?: string; success?: boolean };

export async function updateStudent(_prev: UpdateStudentState, formData: FormData): Promise<UpdateStudentState> {
  const ctx = await requireCapability("students", "edit");

  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const student = await ctx.db.student.findUnique({ where: { id: data.id } });
  if (!student) return { error: "Student not found" };

  const duplicateAdmission = await ctx.db.student.findFirst({
    where: { admissionNumber: data.admissionNumber, NOT: { id: data.id } },
  });
  if (duplicateAdmission) return { error: `Admission number "${data.admissionNumber}" is already in use` };

  const section = await resolveSection(ctx.db, data.sectionId);
  if (!section) return { error: "Section not found" };

  await ctx.db.$transaction([
    ctx.db.student.update({
      where: { id: data.id },
      data: {
        admissionNumber: data.admissionNumber,
        enrollmentNumber: data.enrollmentNumber ?? null,
        rollNumber: data.rollNumber ?? null,
        fatherName: data.fatherName ?? null,
        motherName: data.motherName ?? null,
        guardianName: data.guardianName ?? null,
        dob: data.dob ? new Date(data.dob) : null,
        gender: data.gender ?? null,
        bloodGroup: data.bloodGroup ?? null,
        category: data.category ?? null,
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        pincode: data.pincode ?? null,
        phone: data.phone ?? null,
        sectionId: section.id,
        semesterId: section.semesterId,
        courseId: section.semester.courseId,
        departmentId: section.semester.course.departmentId,
        academicYearId: section.semester.academicYearId,
        status: data.status,
      },
    }),
    ctx.db.user.update({
      where: { id: student.userId },
      data: { name: data.name, email: data.email || null, phone: data.phone || null },
    }),
  ]);

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "STUDENT_UPDATED",
    module: "students",
    recordId: data.id,
    newValue: { name: data.name, admissionNumber: data.admissionNumber, status: data.status },
  });

  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${data.id}`);
  return { success: true };
}

export async function resetStudentPassword(id: string): Promise<{ password: string }> {
  const ctx = await requireCapability("students", "edit");
  const student = await ctx.db.student.findUniqueOrThrow({ where: { id } });

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await ctx.db.user.update({ where: { id: student.userId }, data: { passwordHash, mustChangePassword: true } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "STUDENT_PASSWORD_RESET",
    module: "students",
    recordId: id,
  });

  revalidatePath(`/dashboard/students/${id}`);
  return { password };
}
