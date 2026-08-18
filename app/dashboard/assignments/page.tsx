import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { CreateAssignmentButton } from "./assignment-form";
import { AssignmentsTable, type AssignmentRow } from "./assignments-table";
import { toDateTimeLocal } from "@/lib/format";

export default async function AssignmentsPage({ searchParams }: PageProps<"/dashboard/assignments">) {
  const ctx = await requirePageAccess("assignments", "view");
  const params = await searchParams;
  const sectionFilter = typeof params.section === "string" ? params.section : "";
  const subjectFilter = typeof params.subject === "string" ? params.subject : "";

  const [sections, subjects, teachers] = await Promise.all([
    ctx.db.section.findMany({
      orderBy: [{ semester: { course: { name: "asc" } } }, { semester: { number: "asc" } }, { name: "asc" }],
      include: { semester: { include: { course: { select: { name: true } } } } },
    }),
    ctx.db.subject.findMany({ orderBy: { name: "asc" } }),
    ctx.db.teacher.findMany({ orderBy: { employeeId: "asc" }, include: { user: { select: { name: true } } } }),
  ]);

  if (sections.length === 0 || subjects.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Assignments" />
        <SetupRequired
          message="Sections and subjects must exist before assignments can be set."
          href={sections.length === 0 ? "/dashboard/sections" : "/dashboard/subjects"}
          cta={sections.length === 0 ? "Go to Sections" : "Go to Subjects"}
        />
      </div>
    );
  }

  const assignments = await ctx.db.assignment.findMany({
    where: {
      ...(sectionFilter ? { sectionId: sectionFilter } : {}),
      ...(subjectFilter ? { subjectId: subjectFilter } : {}),
    },
    orderBy: { deadline: "desc" },
    include: {
      subject: { select: { name: true, code: true } },
      section: { include: { semester: { include: { course: { select: { name: true } } } } } },
      teacher: { include: { user: { select: { name: true } } } },
      submissions: { select: { status: true } },
    },
  });

  const now = new Date();

  const rows: AssignmentRow[] = assignments.map((assignment) => ({
    id: assignment.id,
    sectionId: assignment.sectionId,
    subjectId: assignment.subjectId,
    teacherId: assignment.teacherId,
    title: assignment.title,
    description: assignment.description,
    instructions: assignment.instructions,
    attachmentUrl: assignment.attachmentUrl,
    deadline: toDateTimeLocal(assignment.deadline),
    maxMarks: assignment.maxMarks,
    subjectLabel: `${assignment.subject.name} (${assignment.subject.code})`,
    sectionLabel: `${assignment.section.semester.course.name} — Sem ${assignment.section.semester.number} — ${assignment.section.name}`,
    teacherName: assignment.teacher.user.name,
    deadlineLabel: assignment.deadline.toLocaleString(),
    isOverdue: assignment.deadline < now,
    submitted: assignment.submissions.filter((s) => s.status !== "NOT_SUBMITTED").length,
    reviewed: assignment.submissions.filter((s) => s.status === "REVIEWED").length,
    total: assignment.submissions.length,
  }));

  const sectionOptions = sections.map((s) => ({
    id: s.id,
    semesterId: s.semesterId,
    label: `${s.semester.course.name} — Sem ${s.semester.number} — ${s.name}`,
  }));
  const subjectOptions = subjects.map((s) => ({
    id: s.id,
    semesterId: s.semesterId,
    label: `${s.name} (${s.code})`,
  }));
  const teacherOptions = teachers.map((t) => ({ id: t.id, label: `${t.user.name} (${t.employeeId})` }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Assignments"
        description="Work set for a section, and the grading roster behind it."
        action={
          can(ctx, "assignments", "create") && teachers.length > 0 ? (
            <CreateAssignmentButton sections={sectionOptions} subjects={subjectOptions} teachers={teacherOptions} />
          ) : undefined
        }
      />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "section",
            label: "Section",
            placeholder: "All sections",
            options: sectionOptions.map((s) => ({ value: s.id, label: s.label })),
          },
          {
            kind: "select",
            name: "subject",
            label: "Subject",
            placeholder: "All subjects",
            options: subjectOptions.map((s) => ({ value: s.id, label: s.label })),
          },
        ]}
      />

      <AssignmentsTable
        assignments={rows}
        sections={sectionOptions}
        subjects={subjectOptions}
        teachers={teacherOptions}
        canEdit={can(ctx, "assignments", "edit")}
        canDelete={can(ctx, "assignments", "delete")}
      />
    </div>
  );
}
