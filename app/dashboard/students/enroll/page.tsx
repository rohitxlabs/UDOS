import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/dal";
import { PageHeader } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { EnrollForm, type EnrollOptions } from "./enroll-form";

export default async function EnrollStudentPage() {
  const ctx = await requirePageAccess("students", "create");

  const [years, departments, courses, semesters, sections, roles] = await Promise.all([
    ctx.db.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    ctx.db.department.findMany({ orderBy: { name: "asc" } }),
    ctx.db.course.findMany({ orderBy: { name: "asc" } }),
    ctx.db.semester.findMany({ orderBy: [{ number: "asc" }], include: { academicYear: { select: { name: true } } } }),
    ctx.db.section.findMany({ orderBy: { name: "asc" } }),
    ctx.db.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  // A login has to be attached to some role; that is the one prerequisite
  // this screen genuinely cannot conjure, because roles are the college's
  // own policy decision rather than academic structure.
  if (roles.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Enrol student" />
        <div className="mt-6">
          <SetupRequired
            message="Create at least one role before enrolling students — every login needs one."
            href="/dashboard/roles"
            cta="Go to Roles"
          />
        </div>
      </div>
    );
  }

  const options: EnrollOptions = {
    academicYears: years.map((y) => ({ id: y.id, label: y.name })),
    departments: departments.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` })),
    courses: courses.map((c) => ({ id: c.id, label: `${c.name} (${c.code})`, parentId: c.departmentId })),
    semesters: semesters.map((s) => ({
      id: s.id,
      label: `${s.academicYear.name} — Semester ${s.number}`,
      parentId: s.courseId,
    })),
    sections: sections.map((s) => ({ id: s.id, label: s.name, parentId: s.semesterId })),
    roles: roles.map((r) => ({ id: r.id, label: r.name })),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard/students"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All students
      </Link>

      <div className="mt-4">
        <PageHeader
          title="Enrol student"
          description="Places a student in the academic hierarchy, creating any missing level, and connects them to the assignments, examinations and fees that position entitles them to."
        />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EnrollForm options={options} />
      </div>
    </div>
  );
}
