import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/dal";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader, EmptyState, Badge } from "@/components/dashboard/page-header";

export default async function AttendanceRegisterPage({
  searchParams,
}: PageProps<"/dashboard/attendance/register">) {
  const ctx = await requirePageAccess("attendance", "view");
  const params = await searchParams;

  const sectionId = typeof params.section === "string" ? params.section : "";
  const subjectId = typeof params.subject === "string" ? params.subject : "";

  const [sections, settings] = await Promise.all([
    ctx.db.section.findMany({
      orderBy: [{ semester: { course: { name: "asc" } } }, { semester: { number: "asc" } }, { name: "asc" }],
      include: { semester: { include: { course: { select: { name: true } } } } },
    }),
    ctx.db.settings.findUnique({ where: { id: "settings" } }),
  ]);

  // The college's own threshold (spec section 12 — module rules belong to
  // the college, not the platform), defaulting to the schema default.
  const minPercent = Number(settings?.attendanceMinPercent ?? 75);

  const section = sections.find((s) => s.id === sectionId) ?? null;

  const subjects = section
    ? await ctx.db.subject.findMany({ where: { semesterId: section.semesterId }, orderBy: { name: "asc" } })
    : [];

  const students = section
    ? await ctx.db.student.findMany({
        where: { sectionId: section.id, status: "ACTIVE" },
        orderBy: [{ rollNumber: "asc" }, { admissionNumber: "asc" }],
        include: { user: { select: { name: true } } },
      })
    : [];

  const attendance =
    students.length > 0
      ? await ctx.db.attendance.groupBy({
          by: ["studentId", "status"],
          where: {
            studentId: { in: students.map((s) => s.id) },
            ...(subjectId ? { subjectId } : {}),
          },
          _count: { _all: true },
        })
      : [];

  const tally = new Map<string, { present: number; total: number }>();
  for (const row of attendance) {
    const entry = tally.get(row.studentId) ?? { present: 0, total: 0 };
    entry.total += row._count._all;
    // LATE still counts as attended; LEAVE and ABSENT do not.
    if (row.status === "PRESENT" || row.status === "LATE") entry.present += row._count._all;
    tally.set(row.studentId, entry);
  }

  const rows = students.map((student) => {
    const entry = tally.get(student.id) ?? { present: 0, total: 0 };
    const percent = entry.total === 0 ? null : (entry.present / entry.total) * 100;
    return {
      id: student.id,
      name: student.user.name,
      roll: student.rollNumber ?? student.admissionNumber,
      present: entry.present,
      total: entry.total,
      percent,
    };
  });

  const defaulters = rows.filter((r) => r.percent !== null && r.percent < minPercent).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance register"
        description={`Cumulative attendance. Minimum required: ${minPercent}%.`}
        action={
          <Link
            href="/dashboard/attendance"
            className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Mark attendance
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
            placeholder: "All subjects",
            options: subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
          },
        ]}
      />

      {!section ? (
        <EmptyState message="Choose a section to see its attendance register." />
      ) : rows.length === 0 ? (
        <EmptyState message="No active students are assigned to this section yet." />
      ) : (
        <>
          {defaulters > 0 && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {defaulters} student{defaulters === 1 ? " is" : "s are"} below the {minPercent}% attendance requirement.
            </div>
          )}
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Roll</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Attended</th>
                  <th className="px-4 py-3 font-medium">Classes</th>
                  <th className="px-4 py-3 font-medium">Percentage</th>
                  <th className="px-4 py-3 font-medium">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{row.roll}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.present}</td>
                    <td className="px-4 py-3 text-slate-600">{row.total}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.percent === null ? "—" : `${row.percent.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3">
                      {row.percent === null ? (
                        <Badge>No data</Badge>
                      ) : row.percent < minPercent ? (
                        <Badge tone="red">Defaulter</Badge>
                      ) : (
                        <Badge tone="green">Eligible</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
