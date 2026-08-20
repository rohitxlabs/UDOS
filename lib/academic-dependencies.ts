import "server-only";
import type { Prisma as CollegePrisma } from "@/app/generated/college-prisma/client";

// The academic hierarchy, declared once so that every part of the app
// agrees on what depends on what. Nothing below this line hard-codes the
// order — it is derived from LEVEL_DEPENDENCIES, so adding a level means
// editing one table rather than hunting through call sites.
//
//   AcademicYear ─┐
//                 ├─> Semester ─> Section ─> Student
//   Department ─> Course ─┘
//
// A Student can only exist at the bottom of a complete chain; that is what
// stops orphan records (no section, no semester, no course) from ever
// reaching the database.

export const ACADEMIC_LEVELS = ["academicYear", "department", "course", "semester", "section"] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export const LEVEL_DEPENDENCIES: Record<AcademicLevel, AcademicLevel[]> = {
  academicYear: [],
  department: [],
  course: ["department"],
  semester: ["course", "academicYear"],
  section: ["semester"],
};

export const LEVEL_LABELS: Record<AcademicLevel, string> = {
  academicYear: "Academic year",
  department: "Department",
  course: "Course",
  semester: "Semester",
  section: "Section",
};

// Topological order of the levels. Computed rather than written down, so it
// cannot drift from LEVEL_DEPENDENCIES.
export function creationOrder(): AcademicLevel[] {
  const ordered: AcademicLevel[] = [];
  const visiting = new Set<AcademicLevel>();

  const visit = (level: AcademicLevel) => {
    if (ordered.includes(level)) return;
    if (visiting.has(level)) throw new Error(`Cyclic academic dependency at "${level}"`);
    visiting.add(level);
    for (const dep of LEVEL_DEPENDENCIES[level]) visit(dep);
    visiting.delete(level);
    ordered.push(level);
  };

  for (const level of ACADEMIC_LEVELS) visit(level);
  return ordered;
}

// ── Resolving a chain ────────────────────────────────────────────────────

// Each level is either an existing record or one to create. "Create" is not
// blind: an equivalent record is reused when it already exists, so running
// the same enrolment twice converges instead of producing duplicates.
export type LevelInput<TCreate> = { id: string } | { create: TCreate };

export type AcademicChainInput = {
  academicYear: LevelInput<{ name: string; startDate: string; endDate: string }>;
  department: LevelInput<{ name: string; code: string }>;
  course: LevelInput<{ name: string; code: string; durationSemesters: number }>;
  semester: LevelInput<{ number: number; name?: string }>;
  section: LevelInput<{ name: string }>;
};

export type ResolvedChain = Record<AcademicLevel, string>;

type Tx = CollegePrisma.TransactionClient;

const isExisting = <T>(input: LevelInput<T>): input is { id: string } => "id" in input;

// Walks the hierarchy top-down, creating only what is missing, and returns
// the id of every level. Must be called inside a transaction: a half-built
// chain (a semester with no section, say) is exactly the inconsistent state
// this is meant to prevent.
export async function resolveAcademicChain(tx: Tx, input: AcademicChainInput): Promise<ResolvedChain> {
  // Independent roots first — both are prerequisites of Course/Semester.
  const academicYearId = isExisting(input.academicYear)
    ? (await requireRow(tx.academicYear.findUnique({ where: { id: input.academicYear.id } }), "Academic year"), input.academicYear.id)
    : (
        await tx.academicYear.upsert({
          where: { name: input.academicYear.create.name },
          update: {},
          create: {
            name: input.academicYear.create.name,
            startDate: new Date(input.academicYear.create.startDate),
            endDate: new Date(input.academicYear.create.endDate),
          },
        })
      ).id;

  const departmentId = isExisting(input.department)
    ? (await requireRow(tx.department.findUnique({ where: { id: input.department.id } }), "Department"), input.department.id)
    : (
        await tx.department.upsert({
          where: { code: input.department.create.code },
          update: { name: input.department.create.name },
          create: { name: input.department.create.name, code: input.department.create.code },
        })
      ).id;

  const courseId = isExisting(input.course)
    ? (await requireRow(tx.course.findUnique({ where: { id: input.course.id } }), "Course"), input.course.id)
    : (
        await tx.course.upsert({
          where: { code: input.course.create.code },
          update: { name: input.course.create.name },
          create: {
            name: input.course.create.name,
            code: input.course.create.code,
            durationSemesters: input.course.create.durationSemesters,
            departmentId,
          },
        })
      ).id;

  const semesterId = isExisting(input.semester)
    ? (await requireRow(tx.semester.findUnique({ where: { id: input.semester.id } }), "Semester"), input.semester.id)
    : (
        await tx.semester.upsert({
          where: {
            courseId_academicYearId_number: {
              courseId,
              academicYearId,
              number: input.semester.create.number,
            },
          },
          update: {},
          create: {
            courseId,
            academicYearId,
            number: input.semester.create.number,
            name: input.semester.create.name ?? `Semester ${input.semester.create.number}`,
          },
        })
      ).id;

  const sectionId = isExisting(input.section)
    ? (await requireRow(tx.section.findUnique({ where: { id: input.section.id } }), "Section"), input.section.id)
    : (
        await tx.section.upsert({
          where: { semesterId_name: { semesterId, name: input.section.create.name } },
          update: {},
          create: { semesterId, name: input.section.create.name },
        })
      ).id;

  // An existing id supplied for a lower level must actually sit under the
  // levels above it, or the "chain" would be a set of unrelated records and
  // the student would end up mis-filed.
  await assertChainConsistency(tx, { academicYearId, departmentId, courseId, semesterId, sectionId });

  return { academicYear: academicYearId, department: departmentId, course: courseId, semester: semesterId, section: sectionId };
}

async function requireRow<T>(promise: Promise<T | null>, label: string): Promise<T> {
  const row = await promise;
  if (!row) throw new Error(`${label} not found`);
  return row;
}

async function assertChainConsistency(tx: Tx, ids: ResolvedChainIds) {
  // Sequential, not Promise.all: a transaction is a single connection, and
  // firing queries at it concurrently interleaves them on that one wire —
  // which aborts the transaction rather than running them in parallel.
  const course = await tx.course.findUnique({ where: { id: ids.courseId }, select: { departmentId: true } });
  const semester = await tx.semester.findUnique({
    where: { id: ids.semesterId },
    select: { courseId: true, academicYearId: true },
  });
  const section = await tx.section.findUnique({ where: { id: ids.sectionId }, select: { semesterId: true } });

  if (course?.departmentId !== ids.departmentId) {
    throw new Error("That course does not belong to the selected department");
  }
  if (semester?.courseId !== ids.courseId) {
    throw new Error("That semester does not belong to the selected course");
  }
  if (semester?.academicYearId !== ids.academicYearId) {
    throw new Error("That semester belongs to a different academic year");
  }
  if (section?.semesterId !== ids.semesterId) {
    throw new Error("That section does not belong to the selected semester");
  }
}

type ResolvedChainIds = {
  academicYearId: string;
  departmentId: string;
  courseId: string;
  semesterId: string;
  sectionId: string;
};
