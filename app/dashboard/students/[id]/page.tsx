import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/auth/dal";
import { EditStudentForm } from "./edit-student-form";

export default async function StudentDetailPage({ params }: PageProps<"/dashboard/students/[id]">) {
  const ctx = await requirePageAccess("students", "view");
  const { id } = await params;

  const [student, courses] = await Promise.all([
    ctx.db.student.findUnique({ where: { id }, include: { user: true } }),
    ctx.db.course.findMany({
      orderBy: { name: "asc" },
      include: {
        semesters: {
          orderBy: { number: "asc" },
          include: { academicYear: { select: { name: true } }, sections: { orderBy: { name: "asc" } } },
        },
      },
    }),
  ]);

  if (!student) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">{student.user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Student profile.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <EditStudentForm
          courses={courses.map((c) => ({
            id: c.id,
            name: c.name,
            semesters: c.semesters.map((s) => ({
              id: s.id,
              label: `${s.academicYear.name} — Sem ${s.number}`,
              sections: s.sections.map((sec) => ({ id: sec.id, name: sec.name })),
            })),
          }))}
          student={{
            id: student.id,
            name: student.user.name,
            username: student.user.username,
            admissionNumber: student.admissionNumber,
            enrollmentNumber: student.enrollmentNumber,
            rollNumber: student.rollNumber,
            sectionId: student.sectionId ?? "",
            fatherName: student.fatherName,
            motherName: student.motherName,
            guardianName: student.guardianName,
            dob: student.dob ? student.dob.toISOString().slice(0, 10) : null,
            gender: student.gender,
            bloodGroup: student.bloodGroup,
            category: student.category,
            admissionDate: student.admissionDate ? student.admissionDate.toISOString().slice(0, 10) : null,
            address: student.address,
            city: student.city,
            state: student.state,
            pincode: student.pincode,
            email: student.user.email,
            phone: student.user.phone,
            status: student.status,
          }}
        />
      </div>
    </div>
  );
}
