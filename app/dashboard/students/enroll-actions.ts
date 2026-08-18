"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { createLoginAccount } from "@/lib/provisioning";
import { writeTenantAuditLog } from "@/lib/audit";
import { resolveAcademicChain, type AcademicChainInput } from "@/lib/academic-dependencies";
import { attachStudentPackage, type PackageResult } from "@/lib/student-package";

// Prisma's default interactive-transaction budget is 5s. That is fine
// against a local database but not against a hosted one: this block does
// several dependent round-trips plus a bcrypt hash, and the whole point of
// the transaction is that a partially-enrolled student never lands. Give it
// room rather than trading away atomicity.
const TX_OPTIONS = { timeout: 30_000, maxWait: 15_000 };

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

// Each level is "pick an existing one" or "create this one". The form sends
// both shapes through the same field so the user never has to leave the
// enrolment screen to go and create a missing prerequisite first.
const level = <T extends z.ZodTypeAny>(create: T) =>
  z.union([z.object({ id: z.string().min(1) }), z.object({ create })]);

const enrollSchema = z.object({
  chain: z.object({
    academicYear: level(
      z.object({
        name: z.string().trim().min(4, "Academic year name is required"),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
      })
    ),
    department: level(
      z.object({
        name: z.string().trim().min(2, "Department name is required"),
        code: z.string().trim().min(1, "Department code is required").transform((v) => v.toUpperCase()),
      })
    ),
    course: level(
      z.object({
        name: z.string().trim().min(2, "Course name is required"),
        code: z.string().trim().min(1, "Course code is required").transform((v) => v.toUpperCase()),
        durationSemesters: z.coerce.number().int().min(1).max(20),
      })
    ),
    semester: level(z.object({ number: z.coerce.number().int().min(1).max(20) })),
    section: level(z.object({ name: z.string().trim().min(1, "Section name is required") })),
  }),
  student: z.object({
    name: z.string().trim().min(2, "Student name is required"),
    admissionNumber: z.string().trim().min(1, "Admission number is required"),
    rollNumber: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    email: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email").optional()),
    phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    roleId: z.string().min(1, "Role is required"),
    customUsername: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    customPassword: z.preprocess(emptyToUndefined, z.string().min(8, "Password must be at least 8 characters").optional()),
  }),
});

export type EnrollInput = z.input<typeof enrollSchema>;

export type EnrollState = {
  error?: string;
  success?: {
    name: string;
    username: string;
    password: string;
    chainCreated: string[];
    attached: PackageResult;
  };
};

// The "Student package": one call that guarantees the whole academic chain
// exists, creates the student at the bottom of it, and connects everything
// that position entitles them to. All of it in a single transaction — a
// student half-attached to their own assignments and fees is worse than no
// student at all, so it either all lands or none of it does.
export async function enrollStudent(input: EnrollInput): Promise<EnrollState> {
  const ctx = await requireCapability("students", "create");

  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { chain, student } = parsed.data;

  const clash = await ctx.db.student.findUnique({ where: { admissionNumber: student.admissionNumber } });
  if (clash) return { error: `Admission number "${student.admissionNumber}" is already in use` };

  // Which levels this enrolment had to bring into existence, so the result
  // can tell the user what it built on their behalf rather than silently
  // reshaping their academic structure.
  const chainCreated = (Object.keys(chain) as (keyof typeof chain)[]).filter((k) => "create" in chain[k]);

  try {
    const result = await ctx.db.$transaction(async (tx) => {
      const resolved = await resolveAcademicChain(tx, chain as AcademicChainInput);

      const account = await createLoginAccount(ctx.collegeId, tx, {
        name: student.name,
        roleId: student.roleId,
        email: student.email,
        phone: student.phone,
        customUsername: student.customUsername,
        customPassword: student.customPassword,
        createdById: ctx.userId,
      });
      if ("error" in account) throw new Error(account.error);

      const created = await tx.student.create({
        data: {
          userId: account.userId,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          phone: student.phone,
          status: "ACTIVE",
          academicYearId: resolved.academicYear,
          departmentId: resolved.department,
          courseId: resolved.course,
          semesterId: resolved.semester,
          sectionId: resolved.section,
        },
      });

      const attached = await attachStudentPackage(tx, created.id, resolved);
      return { account, studentId: created.id, attached };
    }, TX_OPTIONS);

    await writeTenantAuditLog(ctx.db, {
      userId: ctx.userId,
      roleName: ctx.roleName,
      action: "STUDENT_ENROLLED",
      module: "students",
      recordId: result.studentId,
      newValue: {
        admissionNumber: student.admissionNumber,
        levelsCreated: chainCreated,
        attached: result.attached,
      },
    });

    revalidatePath("/dashboard/students");
    return {
      success: {
        name: student.name,
        username: result.account.username,
        password: result.account.password,
        chainCreated,
        attached: result.attached,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrolment failed";
    if (message.includes("Unique constraint")) {
      return { error: "That admission number, roll number or username is already in use" };
    }
    return { error: message.slice(0, 300) };
  }
}
