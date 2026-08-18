import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { toDateInput } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { SchedulePanel, type ScheduleRow, type SubjectOption } from "./schedule-panel";
import { EligibilityPanel, type EligibilityRow, type EligibilityStatusValue } from "./eligibility-panel";

export default async function ExamDetailPage({ params }: PageProps<"/dashboard/exams/[id]">) {
  const ctx = await requirePageAccess("exams", "view");
  const { id } = await params;

  const exam = await ctx.db.examination.findUnique({
    where: { id },
    include: {
      semester: { include: { course: { select: { name: true } }, academicYear: { select: { name: true } } } },
      examSubjects: { include: { subject: { select: { name: true, code: true } } }, orderBy: { examDate: "asc" } },
      eligibility: {
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: { student: { rollNumber: "asc" } },
      },
    },
  });

  if (!exam) notFound();

  const subjects = await ctx.db.subject.findMany({
    where: { semesterId: exam.semesterId },
    orderBy: { name: "asc" },
  });

  const subjectOptions: SubjectOption[] = subjects.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.code})`,
    maxMarks: s.maxMarks,
    passMarks: s.passMarks,
  }));

  const scheduleRows: ScheduleRow[] = exam.examSubjects.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    examDate: toDateInput(row.examDate),
    startTime: row.startTime,
    durationMin: row.durationMin,
    room: row.room,
    maxMarks: row.maxMarks,
    passMarks: row.passMarks,
    subjectLabel: `${row.subject.name} (${row.subject.code})`,
    examDateLabel: row.examDate.toLocaleDateString(),
  }));

  const eligibilityRows: EligibilityRow[] = exam.eligibility.map((row) => ({
    id: row.id,
    studentName: row.student.user.name,
    roll: row.student.rollNumber ?? row.student.admissionNumber,
    status: row.status as EligibilityStatusValue,
    reason: row.reason,
    overridden: row.overriddenAt !== null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/exams"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All examinations
      </Link>

      <PageHeader
        title={exam.name}
        description={`${exam.type} · ${exam.semester.course.name} — ${exam.semester.academicYear.name} — Sem ${exam.semester.number} · ${exam.startDate.toLocaleDateString()} – ${exam.endDate.toLocaleDateString()}`}
      />

      <SchedulePanel
        examId={exam.id}
        subjects={subjectOptions}
        rows={scheduleRows}
        canCreate={can(ctx, "exams", "create")}
        canEdit={can(ctx, "exams", "edit")}
        canDelete={can(ctx, "exams", "delete")}
      />

      <EligibilityPanel examId={exam.id} rows={eligibilityRows} canApprove={can(ctx, "exams", "approve")} />
    </div>
  );
}
