import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { EditFacultyForm } from "./edit-faculty-form";
import { AssignmentsPanel } from "./assignments-panel";

export default async function FacultyDetailPage({ params }: PageProps<"/dashboard/faculty/[id]">) {
  await requireCapability("faculty", "view");
  const { id } = await params;

  const [teacher, departments, semesters] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id },
      include: {
        user: true,
        facultySubjects: {
          include: {
            subject: { select: { name: true } },
            section: { select: { name: true, semester: { select: { number: true, course: { select: { name: true } } } } } },
          },
        },
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.semester.findMany({
      orderBy: [{ course: { name: "asc" } }, { number: "asc" }],
      include: {
        course: { select: { name: true } },
        academicYear: { select: { name: true } },
        subjects: { select: { id: true, name: true } },
        sections: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!teacher) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{teacher.user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Faculty profile and subject assignments.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <EditFacultyForm
          departments={departments}
          faculty={{
            id: teacher.id,
            name: teacher.user.name,
            username: teacher.user.username,
            employeeId: teacher.employeeId,
            departmentId: teacher.departmentId,
            designation: teacher.designation,
            qualification: teacher.qualification,
            joiningDate: teacher.joiningDate ? teacher.joiningDate.toISOString().slice(0, 10) : null,
            email: teacher.user.email,
            phone: teacher.user.phone,
          }}
        />
      </div>

      <AssignmentsPanel
        teacherId={teacher.id}
        semesters={semesters.map((s) => ({
          id: s.id,
          label: `${s.course.name} — ${s.academicYear.name} — Sem ${s.number}`,
          subjects: s.subjects,
          sections: s.sections,
        }))}
        assignments={teacher.facultySubjects.map((fs) => ({
          id: fs.id,
          subjectName: fs.subject.name,
          sectionName: fs.section.name,
          semesterLabel: `${fs.section.semester.course.name} — Sem ${fs.section.semester.number}`,
        }))}
      />
    </div>
  );
}
