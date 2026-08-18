import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { formatMoney, toNumber } from "@/lib/format";
import { PageHeader, EmptyState, Badge } from "@/components/dashboard/page-header";

function ReportCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full min-w-[520px] text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          {headers.map((header) => (
            <th key={header} className="px-4 py-3 font-medium">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 && (
          <tr>
            <td colSpan={headers.length} className="px-4 py-6 text-center text-slate-500">
              Nothing to report yet.
            </td>
          </tr>
        )}
        {rows.map((row, index) => (
          <tr key={index} className="hover:bg-slate-50">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-4 py-3 text-slate-600">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ReportsPage() {
  const ctx = await requireCapability("reports", "view");

  // Every section below is gated on the reporting user being able to see
  // the underlying module too: a report must never become a side door
  // around a module the platform disabled or a permission the college
  // withheld (spec sections 9 and 32).
  const showStudents = can(ctx, "students", "view");
  const showAttendance = can(ctx, "attendance", "view");
  const showFees = can(ctx, "fees", "view");
  const showResults = can(ctx, "results", "view");
  const showLibrary = can(ctx, "library", "view");

  const [courses, studentsByStatus, attendanceRows, feeRows, resultRows, libraryStats] = await Promise.all([
    showStudents
      ? ctx.db.course.findMany({
          orderBy: { name: "asc" },
          include: { department: { select: { name: true } }, _count: { select: { students: true } } },
        })
      : Promise.resolve([]),
    showStudents
      ? ctx.db.student.groupBy({ by: ["status"], _count: { _all: true } })
      : Promise.resolve([]),
    showAttendance
      ? ctx.db.attendance.groupBy({ by: ["status"], _count: { _all: true } })
      : Promise.resolve([]),
    showFees
      ? ctx.db.studentFee.findMany({
          include: { feeStructure: { select: { name: true } } },
        })
      : Promise.resolve([]),
    showResults
      ? ctx.db.result.groupBy({ by: ["examId", "status"], _count: { _all: true } })
      : Promise.resolve([]),
    showLibrary
      ? Promise.all([
          ctx.db.libraryBook.count(),
          ctx.db.libraryTransaction.count({ where: { returnedAt: null } }),
          ctx.db.libraryTransaction.count({ where: { returnedAt: null, dueDate: { lt: new Date() } } }),
        ])
      : Promise.resolve([0, 0, 0] as const),
  ]);

  // Result rows come back grouped by exam id, so the exam names have to be
  // fetched separately before they can be labelled.
  const exams = showResults
    ? await ctx.db.examination.findMany({
        where: { id: { in: [...new Set(resultRows.map((row) => row.examId))] } },
        select: { id: true, name: true },
      })
    : [];
  const examNames = new Map(exams.map((exam) => [exam.id, exam.name]));

  const attendanceTotal = attendanceRows.reduce((sum, row) => sum + row._count._all, 0);
  const attended = attendanceRows
    .filter((row) => row.status === "PRESENT" || row.status === "LATE")
    .reduce((sum, row) => sum + row._count._all, 0);

  const feeByStructure = new Map<string, { billed: number; collected: number; students: number }>();
  for (const fee of feeRows) {
    const key = fee.feeStructure.name;
    const entry = feeByStructure.get(key) ?? { billed: 0, collected: 0, students: 0 };
    entry.billed += toNumber(fee.totalAmount) - toNumber(fee.discount) - toNumber(fee.scholarship);
    entry.collected += toNumber(fee.paidAmount);
    entry.students += 1;
    feeByStructure.set(key, entry);
  }

  const resultByExam = new Map<string, { pass: number; fail: number; backlog: number }>();
  for (const row of resultRows) {
    const key = examNames.get(row.examId) ?? "Unknown examination";
    const entry = resultByExam.get(key) ?? { pass: 0, fail: 0, backlog: 0 };
    if (row.status === "PASS") entry.pass += row._count._all;
    else if (row.status === "FAIL") entry.fail += row._count._all;
    else if (row.status === "BACKLOG") entry.backlog += row._count._all;
    resultByExam.set(key, entry);
  }

  const nothingVisible = !showStudents && !showAttendance && !showFees && !showResults && !showLibrary;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        description="A cross-module summary, limited to the modules you can access."
      />

      {nothingVisible && (
        <EmptyState message="You do not have view access to any module that reports can be built from." />
      )}

      {showStudents && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {studentsByStatus.map((row) => (
              <div key={row.status} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">{row.status.charAt(0) + row.status.slice(1).toLowerCase()} students</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{row._count._all}</p>
              </div>
            ))}
          </div>

          <ReportCard title="Enrolment by course" description="Active and inactive students registered against each course.">
            <SimpleTable
              headers={["Course", "Department", "Students"]}
              rows={courses.map((course) => [course.name, course.department.name, course._count.students])}
            />
          </ReportCard>
        </>
      )}

      {showAttendance && (
        <ReportCard
          title="Attendance"
          description={`${attendanceTotal} class records. Overall attendance ${
            attendanceTotal === 0 ? "—" : `${((attended / attendanceTotal) * 100).toFixed(1)}%`
          }.`}
        >
          <SimpleTable
            headers={["Status", "Records", "Share"]}
            rows={attendanceRows.map((row) => [
              row.status.charAt(0) + row.status.slice(1).toLowerCase(),
              row._count._all,
              attendanceTotal === 0 ? "—" : `${((row._count._all / attendanceTotal) * 100).toFixed(1)}%`,
            ])}
          />
        </ReportCard>
      )}

      {showFees && (
        <ReportCard title="Fee collection" description="Net billed against collected, per fee structure.">
          <SimpleTable
            headers={["Fee structure", "Students", "Net billed", "Collected", "Outstanding"]}
            rows={[...feeByStructure.entries()].map(([name, entry]) => [
              name,
              entry.students,
              formatMoney(entry.billed),
              formatMoney(entry.collected),
              formatMoney(entry.billed - entry.collected),
            ])}
          />
        </ReportCard>
      )}

      {showResults && (
        <ReportCard title="Examination results" description="Pass, backlog and fail counts per examination.">
          <SimpleTable
            headers={["Examination", "Pass", "Backlog", "Fail", "Pass rate"]}
            rows={[...resultByExam.entries()].map(([name, entry]) => {
              const total = entry.pass + entry.fail + entry.backlog;
              return [
                name,
                <Badge key="p" tone="green">{entry.pass}</Badge>,
                <Badge key="b" tone="amber">{entry.backlog}</Badge>,
                <Badge key="f" tone="red">{entry.fail}</Badge>,
                total === 0 ? "—" : `${((entry.pass / total) * 100).toFixed(1)}%`,
              ];
            })}
          />
        </ReportCard>
      )}

      {showLibrary && (
        <ReportCard title="Library" description="Catalogue size and current circulation.">
          <SimpleTable
            headers={["Titles", "On loan", "Overdue"]}
            rows={[[libraryStats[0], libraryStats[1], libraryStats[2]]]}
          />
        </ReportCard>
      )}
    </div>
  );
}
