import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { PageHeader, Badge } from "@/components/dashboard/page-header";
import { SubmissionsPanel, type SubmissionRow, type SubmissionStatusValue } from "./submissions-panel";

export default async function AssignmentDetailPage({ params }: PageProps<"/dashboard/assignments/[id]">) {
  const ctx = await requirePageAccess("assignments", "view");
  const { id } = await params;

  const assignment = await ctx.db.assignment.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true, code: true } },
      section: { include: { semester: { include: { course: { select: { name: true } } } } } },
      teacher: { include: { user: { select: { name: true } } } },
      submissions: {
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: { student: { rollNumber: "asc" } },
      },
    },
  });

  if (!assignment) notFound();

  const rows: SubmissionRow[] = assignment.submissions.map((submission) => ({
    id: submission.id,
    studentName: submission.student.user.name,
    roll: submission.student.rollNumber ?? submission.student.admissionNumber,
    fileUrl: submission.fileUrl,
    submittedAtLabel: submission.submittedAt?.toLocaleString() ?? null,
    status: submission.status as SubmissionStatusValue,
    marksObtained: submission.marksObtained,
    feedback: submission.feedback,
  }));

  const reviewed = rows.filter((r) => r.status === "REVIEWED").length;
  const submitted = rows.filter((r) => r.status !== "NOT_SUBMITTED").length;
  const graded = rows.filter((r) => r.marksObtained !== null);
  const average =
    graded.length > 0 ? graded.reduce((sum, r) => sum + (r.marksObtained ?? 0), 0) / graded.length : null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/assignments"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All assignments
      </Link>

      <PageHeader
        title={assignment.title}
        description={`${assignment.subject.name} (${assignment.subject.code}) · ${assignment.section.semester.course.name} — Sem ${assignment.section.semester.number} — ${assignment.section.name}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={assignment.deadline < new Date() ? "amber" : "green"}>
              {assignment.deadline < new Date() ? "Closed" : "Open"}
            </Badge>
            <span className="text-sm text-slate-500">Due {assignment.deadline.toLocaleString()}</span>
            <span className="text-sm text-slate-500">· Max {assignment.maxMarks} marks</span>
            <span className="text-sm text-slate-500">· Set by {assignment.teacher.user.name}</span>
          </div>

          {assignment.description && <p className="mt-4 text-sm text-slate-700">{assignment.description}</p>}
          {assignment.instructions && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{assignment.instructions}</p>
            </div>
          )}
          {assignment.attachmentUrl && (
            <a
              href={assignment.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              <Paperclip className="h-4 w-4" />
              Attachment
            </a>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Progress</p>
          <dl className="mt-3 flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Roster</dt>
              <dd className="font-medium text-slate-900">{rows.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Submitted</dt>
              <dd className="font-medium text-slate-900">{submitted}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Reviewed</dt>
              <dd className="font-medium text-slate-900">{reviewed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Average marks</dt>
              <dd className="font-medium text-slate-900">
                {average === null ? "—" : `${average.toFixed(1)} / ${assignment.maxMarks}`}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <SubmissionsPanel
        submissions={rows}
        maxMarks={assignment.maxMarks}
        canGrade={can(ctx, "assignments", "edit")}
      />
    </div>
  );
}
