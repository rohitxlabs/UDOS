import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { AttendanceMarker, type RosterEntry } from "./attendance-marker";
import type { AttendanceStatusValue } from "./actions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendancePage({ searchParams }: PageProps<"/dashboard/attendance">) {
  const ctx = await requireCapability("attendance", "view");
  const params = await searchParams;

  const sectionId = typeof params.section === "string" ? params.section : "";
  const subjectId = typeof params.subject === "string" ? params.subject : "";
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayISO();

  const sections = await ctx.db.section.findMany({
    orderBy: [{ semester: { course: { name: "asc" } } }, { semester: { number: "asc" } }, { name: "asc" }],
    include: {
      semester: { include: { course: { select: { name: true } }, academicYear: { select: { name: true } } } },
    },
  });

  if (sections.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Attendance" />
        <SetupRequired
          message="Create at least one section before marking attendance."
          href="/dashboard/sections"
          cta="Go to Sections"
        />
      </div>
    );
  }

  const section = sections.find((s) => s.id === sectionId) ?? null;

  const subjects = section
    ? await ctx.db.subject.findMany({ where: { semesterId: section.semesterId }, orderBy: { name: "asc" } })
    : [];

  const subject = subjects.find((s) => s.id === subjectId) ?? null;

  const students = section
    ? await ctx.db.student.findMany({
        where: { sectionId: section.id, status: "ACTIVE" },
        orderBy: [{ rollNumber: "asc" }, { admissionNumber: "asc" }],
        include: { user: { select: { name: true } } },
      })
    : [];

  const existing =
    subject && students.length > 0
      ? await ctx.db.attendance.findMany({
          where: {
            subjectId: subject.id,
            date: new Date(`${date}T00:00:00.000Z`),
            studentId: { in: students.map((s) => s.id) },
          },
        })
      : [];

  const existingByStudent = new Map(existing.map((row) => [row.studentId, row.status as AttendanceStatusValue]));

  const roster: RosterEntry[] = students.map((student) => ({
    studentId: student.id,
    name: student.user.name,
    rollNumber: student.rollNumber,
    admissionNumber: student.admissionNumber,
    status: existingByStudent.get(student.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance"
        description="Mark a class register for one subject on one day."
        action={
          <Link
            href="/dashboard/attendance/register"
            className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" />
            Attendance register
          </Link>
        }
      />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "section",
            label: "Section",
            placeholder: "Select section",
            resets: ["subject"],
            options: sections.map((s) => ({
              value: s.id,
              label: `${s.semester.course.name} — Sem ${s.semester.number} — ${s.name}`,
            })),
          },
          {
            kind: "select",
            name: "subject",
            label: "Subject",
            placeholder: section ? "Select subject" : "Select a section first",
            options: subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
          },
          { kind: "date", name: "date", label: "Date" },
        ]}
      />

      {!section || !subject ? (
        <EmptyState message="Choose a section and a subject to load the class roster." />
      ) : roster.length === 0 ? (
        <EmptyState message="No active students are assigned to this section yet." />
      ) : (
        <AttendanceMarker
          subjectId={subject.id}
          date={date}
          roster={roster}
          canSave={can(ctx, "attendance", "create")}
        />
      )}
    </div>
  );
}
