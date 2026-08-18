import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { CreateSlotButton } from "./timetable-form";
import { TimetableGrid, type SlotRow } from "./timetable-grid";

export default async function TimetablePage({ searchParams }: PageProps<"/dashboard/timetable">) {
  const ctx = await requireCapability("timetable", "view");
  const params = await searchParams;
  const sectionId = typeof params.section === "string" ? params.section : "";

  const sections = await ctx.db.section.findMany({
    orderBy: [{ semester: { course: { name: "asc" } } }, { semester: { number: "asc" } }, { name: "asc" }],
    include: { semester: { include: { course: { select: { name: true } }, academicYear: { select: { name: true } } } } },
  });

  if (sections.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Timetable" />
        <SetupRequired
          message="Create at least one section before building a timetable."
          href="/dashboard/sections"
          cta="Go to Sections"
        />
      </div>
    );
  }

  const section = sections.find((s) => s.id === sectionId) ?? null;

  const [subjects, teachers, slots] = section
    ? await Promise.all([
        ctx.db.subject.findMany({ where: { semesterId: section.semesterId }, orderBy: { name: "asc" } }),
        ctx.db.teacher.findMany({ orderBy: { employeeId: "asc" }, include: { user: { select: { name: true } } } }),
        ctx.db.timetable.findMany({
          where: { sectionId: section.id },
          orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
          include: { subject: { select: { name: true, code: true } } },
        }),
      ])
    : [[], [], []];

  const teacherNames = new Map(teachers.map((t) => [t.id, t.user.name]));

  const rows: SlotRow[] = slots.map((slot) => ({
    id: slot.id,
    subjectId: slot.subjectId,
    teacherId: slot.teacherId,
    dayOfWeek: slot.dayOfWeek,
    periodNumber: slot.periodNumber,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
    subjectName: slot.subject.name,
    subjectCode: slot.subject.code,
    teacherName: teacherNames.get(slot.teacherId) ?? "Unassigned",
  }));

  const subjectOptions = subjects.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` }));
  const teacherOptions = teachers.map((t) => ({ id: t.id, label: `${t.user.name} (${t.employeeId})` }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Timetable"
        description="Weekly class schedule for one section."
        action={
          section && can(ctx, "timetable", "create") ? (
            <CreateSlotButton sectionId={section.id} subjects={subjectOptions} teachers={teacherOptions} />
          ) : undefined
        }
      />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "section",
            label: "Section",
            placeholder: "Select section",
            options: sections.map((s) => ({
              value: s.id,
              label: `${s.semester.course.name} — ${s.semester.academicYear.name} — Sem ${s.semester.number} — ${s.name}`,
            })),
          },
        ]}
      />

      {!section ? (
        <EmptyState message="Choose a section to view or build its weekly timetable." />
      ) : subjects.length === 0 ? (
        <SetupRequired
          message="This section's semester has no subjects yet."
          href="/dashboard/subjects"
          cta="Go to Subjects"
        />
      ) : (
        <TimetableGrid
          sectionId={section.id}
          slots={rows}
          subjects={subjectOptions}
          teachers={teacherOptions}
          canEdit={can(ctx, "timetable", "edit")}
          canDelete={can(ctx, "timetable", "delete")}
        />
      )}
    </div>
  );
}
