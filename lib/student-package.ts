import "server-only";
import type { Prisma as CollegePrisma } from "@/app/generated/college-prisma/client";
import type { ResolvedChain } from "@/lib/academic-dependencies";
import { toNumber } from "@/lib/format";

type Tx = CollegePrisma.TransactionClient;

// What a student is entitled to the moment they exist is decided by where
// they sit in the hierarchy, not by an admin remembering to wire it up.
// Enrolling into a section that already runs assignments, exams and a fee
// structure should leave the student already on those rolls — otherwise the
// records only appear for students enrolled *before* the work was set, and
// nobody notices the gap until marks or fees come out wrong.
//
// Everything here is additive and idempotent (skipDuplicates / existence
// checks), so re-running it after a transfer tops the student up rather
// than duplicating their record.
export type PackageResult = {
  assignments: number;
  exams: number;
  fees: number;
};

export async function attachStudentPackage(
  tx: Tx,
  studentId: string,
  chain: Pick<ResolvedChain, "section" | "semester" | "course" | "academicYear">
): Promise<PackageResult> {
  // 1. Assignments already set for this section — a submission slot each,
  //    so the grading roster is complete rather than only listing students
  //    who happened to upload something.
  const assignments = await tx.assignment.findMany({
    where: { sectionId: chain.section },
    select: { id: true },
  });
  const assignmentResult = assignments.length
    ? await tx.assignmentSubmission.createMany({
        data: assignments.map((a) => ({ assignmentId: a.id, studentId })),
        skipDuplicates: true,
      })
    : { count: 0 };

  // 2. Examinations scheduled for this semester. Eligibility starts as
  //    PENDING_VERIFICATION — the college's attendance rule decides the
  //    real answer later, and presuming eligibility here would quietly
  //    bypass that check.
  const exams = await tx.examination.findMany({
    where: { semesterId: chain.semester },
    select: { id: true },
  });
  const examResult = exams.length
    ? await tx.examEligibility.createMany({
        data: exams.map((e) => ({ examId: e.id, studentId, status: "PENDING_VERIFICATION" as const })),
        skipDuplicates: true,
      })
    : { count: 0 };

  // 3. Fee structures that apply to this student's course/semester/year. A
  //    structure with a null course or semester is a college-wide one and
  //    applies to everyone in that academic year.
  const structures = await tx.feeStructure.findMany({
    where: {
      academicYearId: chain.academicYear,
      AND: [
        { OR: [{ courseId: null }, { courseId: chain.course }] },
        { OR: [{ semesterId: null }, { semesterId: chain.semester }] },
      ],
    },
    include: { components: { select: { amount: true } } },
  });

  let feesAttached = 0;
  for (const structure of structures) {
    const already = await tx.studentFee.findFirst({
      where: { studentId, feeStructureId: structure.id },
      select: { id: true },
    });
    if (already) continue;

    const total = structure.components.reduce((sum, component) => sum + toNumber(component.amount), 0);
    await tx.studentFee.create({
      data: { studentId, feeStructureId: structure.id, totalAmount: total.toFixed(2) },
    });
    feesAttached++;
  }

  return {
    assignments: assignmentResult.count,
    exams: examResult.count,
    fees: feesAttached,
  };
}
