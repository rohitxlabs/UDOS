import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/dal";
import { PrintButton } from "@/components/dashboard/print-button";

export default async function AdmitCardPage({ params }: PageProps<"/dashboard/admit-cards/[id]">) {
  const ctx = await requireCapability("admitCards", "print");
  const { id } = await params;

  const card = await ctx.db.admitCard.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          user: { select: { name: true } },
          course: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
      exam: {
        include: {
          semester: { include: { course: { select: { name: true } }, academicYear: { select: { name: true } } } },
          examSubjects: { include: { subject: { select: { name: true, code: true } } }, orderBy: { examDate: "asc" } },
        },
      },
    },
  });

  if (!card) notFound();

  const student = card.student;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/admit-cards"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All admit cards
        </Link>
        <PrintButton />
      </div>

      {!card.releasedAt && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
          This card has not been released to the student yet. It is visible to staff only.
        </div>
      )}

      <div className="rounded-3xl border border-slate-300 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b border-slate-300 pb-4 text-center">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{ctx.college.name}</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-slate-600">Admit card</p>
          <p className="mt-1 text-sm text-slate-500">
            {card.exam.name} · {card.exam.semester.academicYear.name}
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {[
            ["Student name", student.user.name],
            ["Admission number", student.admissionNumber],
            ["Roll number", student.rollNumber ?? "—"],
            ["Enrollment number", student.enrollmentNumber ?? "—"],
            ["Course", student.course?.name ?? card.exam.semester.course.name],
            ["Department", student.department?.name ?? "—"],
            ["Semester", `Semester ${card.exam.semester.number}`],
            ["Examination type", card.exam.type],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-dashed border-slate-200 pb-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Examination schedule</h2>
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead className="border-y border-slate-300 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Subject</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 font-medium">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {card.exam.examSubjects.map((paper) => (
                <tr key={paper.id}>
                  <td className="py-2 pr-4 text-slate-900">{paper.subject.name}</td>
                  <td className="py-2 pr-4 text-slate-600">{paper.subject.code}</td>
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-600">{paper.examDate.toLocaleDateString()}</td>
                  <td className="py-2 pr-4 text-slate-600">
                    {paper.startTime ?? "—"}
                    {paper.durationMin ? ` (${paper.durationMin}m)` : ""}
                  </td>
                  <td className="py-2 text-slate-600">{paper.room ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-400">Verification code</p>
            <p className="font-mono text-xs text-slate-600">{card.qrCode ?? "—"}</p>
          </div>
          <div className="text-center">
            <div className="h-12 w-40 border-b border-slate-400" />
            <p className="mt-1 text-xs text-slate-500">Controller of Examinations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
