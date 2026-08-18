import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { MarksSheet, type MarksRow, type MarksStatusValue } from "./marks-sheet";

export default async function MarksPage({ searchParams }: PageProps<"/dashboard/marks">) {
  const ctx = await requireCapability("marks", "view");
  const params = await searchParams;
  const examId = typeof params.exam === "string" ? params.exam : "";
  const paperId = typeof params.paper === "string" ? params.paper : "";

  const exams = await ctx.db.examination.findMany({
    orderBy: { startDate: "desc" },
    include: { semester: { include: { course: { select: { name: true } } } } },
  });

  if (exams.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Marks" />
        <SetupRequired
          message="Create an examination and schedule its papers before entering marks."
          href="/dashboard/exams"
          cta="Go to Examinations"
        />
      </div>
    );
  }

  const exam = exams.find((e) => e.id === examId) ?? null;

  const papers = exam
    ? await ctx.db.examSubject.findMany({
        where: { examId: exam.id },
        orderBy: { examDate: "asc" },
        include: { subject: { select: { name: true, code: true } } },
      })
    : [];

  const paper = papers.find((p) => p.id === paperId) ?? null;

  const students = paper
    ? await ctx.db.student.findMany({
        where: { semesterId: exam!.semesterId, status: "ACTIVE" },
        orderBy: [{ rollNumber: "asc" }, { admissionNumber: "asc" }],
        include: { user: { select: { name: true } } },
      })
    : [];

  const existing = paper
    ? await ctx.db.marks.findMany({ where: { examSubjectId: paper.id } })
    : [];

  const byStudent = new Map(existing.map((row) => [row.studentId, row]));

  const rows: MarksRow[] = students.map((student) => {
    const marks = byStudent.get(student.id);
    return {
      studentId: student.id,
      name: student.user.name,
      roll: student.rollNumber ?? student.admissionNumber,
      internal: marks?.internal ?? null,
      assignmentMarks: marks?.assignmentMarks ?? null,
      practical: marks?.practical ?? null,
      viva: marks?.viva ?? null,
      theory: marks?.theory ?? null,
    };
  });

  // The sheet has one status, not one per student: the least-advanced row
  // decides, so a single un-submitted correction holds the whole paper back.
  const status: MarksStatusValue = existing.length === 0
    ? "DRAFT"
    : existing.some((m) => m.status === "DRAFT")
      ? "DRAFT"
      : existing.some((m) => m.status === "SUBMITTED")
        ? "SUBMITTED"
        : "VERIFIED";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Marks"
        description="Enter, submit and verify one paper's marks sheet."
      />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "exam",
            label: "Examination",
            placeholder: "Select examination",
            resets: ["paper"],
            options: exams.map((e) => ({
              value: e.id,
              label: `${e.name} — ${e.semester.course.name} Sem ${e.semester.number}`,
            })),
          },
          {
            kind: "select",
            name: "paper",
            label: "Paper",
            placeholder: exam ? "Select paper" : "Select an examination first",
            options: papers.map((p) => ({ value: p.id, label: `${p.subject.name} (${p.subject.code})` })),
          },
        ]}
      />

      {!exam || !paper ? (
        <EmptyState message="Choose an examination and a paper to open its marks sheet." />
      ) : rows.length === 0 ? (
        <EmptyState message="No active students are enrolled in this examination's semester." />
      ) : (
        <MarksSheet
          examSubjectId={paper.id}
          rows={rows}
          status={status}
          maxMarks={paper.maxMarks}
          passMarks={paper.passMarks}
          canEnter={can(ctx, "marks", "create")}
          canSubmit={can(ctx, "marks", "edit")}
          canApprove={can(ctx, "marks", "approve")}
        />
      )}
    </div>
  );
}
