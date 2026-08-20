import Link from "next/link";
import {
  Users,
  ShieldCheck,
  GraduationCap,
  Activity,
  CalendarCheck,
  ClipboardList,
  Wallet,
  Library,
  Megaphone,
  PlaneTakeoff,
  type LucideIcon,
} from "lucide-react";
import { requireCollege } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { formatMoney, toNumber } from "@/lib/format";

const ICON_STYLES = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  href,
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: keyof typeof ICON_STYLES;
  href?: string;
  hint?: string;
}) {
  const card = (
    <div className="h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${ICON_STYLES[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export default async function DashboardPage() {
  const ctx = await requireCollege();

  // The dashboard is assembled from whatever this user can actually reach:
  // a module the platform never enabled for this college, or one this role
  // has no view permission on, contributes no query and no widget
  // (spec section 22).
  const show = {
    users: can(ctx, "users", "view"),
    students: can(ctx, "students", "view"),
    faculty: can(ctx, "faculty", "view"),
    attendance: can(ctx, "attendance", "view"),
    assignments: can(ctx, "assignments", "view"),
    fees: can(ctx, "fees", "view"),
    library: can(ctx, "library", "view"),
    notices: can(ctx, "notices", "view"),
    leave: can(ctx, "leave", "view"),
    auditLogs: can(ctx, "auditLogs", "view"),
  };

  const [
    userCount,
    studentCount,
    facultyCount,
    attendanceToday,
    openAssignments,
    feeRows,
    booksOnLoan,
    activeNotices,
    pendingLeave,
    recentLogs,
  ] = await Promise.all([
    show.users ? ctx.db.user.count({ where: { isActive: true } }) : Promise.resolve(null),
    show.students ? ctx.db.student.count({ where: { status: "ACTIVE" } }) : Promise.resolve(null),
    show.faculty ? ctx.db.teacher.count() : Promise.resolve(null),
    show.attendance
      ? ctx.db.attendance.count({ where: { date: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") } })
      : Promise.resolve(null),
    show.assignments
      ? ctx.db.assignment.count({ where: { deadline: { gte: new Date() } } })
      : Promise.resolve(null),
    show.fees ? ctx.db.studentFee.findMany({ select: { totalAmount: true, discount: true, scholarship: true, paidAmount: true } }) : Promise.resolve(null),
    show.library ? ctx.db.libraryTransaction.count({ where: { returnedAt: null } }) : Promise.resolve(null),
    show.notices
      ? ctx.db.notice.count({
          where: {
            publishDate: { lte: new Date() },
            OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
          },
        })
      : Promise.resolve(null),
    show.leave ? ctx.db.leaveRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(null),
    show.auditLogs
      ? ctx.db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { user: { select: { name: true, username: true } } },
        })
      : Promise.resolve([]),
  ]);

  const outstanding =
    feeRows === null
      ? null
      : feeRows.reduce(
          (sum, fee) =>
            sum +
            (toNumber(fee.totalAmount) - toNumber(fee.discount) - toNumber(fee.scholarship) - toNumber(fee.paidAmount)),
          0
        );

  const cards = [
    show.students && (
      <StatCard key="students" label="Active students" value={studentCount ?? 0} icon={GraduationCap} tone="violet" href="/dashboard/students" />
    ),
    show.faculty && (
      <StatCard key="faculty" label="Faculty" value={facultyCount ?? 0} icon={Users} tone="blue" href="/dashboard/faculty" />
    ),
    show.users && (
      <StatCard key="users" label="Active users" value={userCount ?? 0} icon={ShieldCheck} tone="emerald" href="/dashboard/users" />
    ),
    show.attendance && (
      <StatCard
        key="attendance"
        label="Attendance marked today"
        value={attendanceToday ?? 0}
        icon={CalendarCheck}
        tone="emerald"
        href="/dashboard/attendance"
      />
    ),
    show.assignments && (
      <StatCard
        key="assignments"
        label="Open assignments"
        value={openAssignments ?? 0}
        icon={ClipboardList}
        tone="blue"
        href="/dashboard/assignments"
        hint="Deadline not yet passed"
      />
    ),
    show.fees && (
      <StatCard
        key="fees"
        label="Fees outstanding"
        value={formatMoney(outstanding ?? 0)}
        icon={Wallet}
        tone="amber"
        href="/dashboard/fees"
      />
    ),
    show.library && (
      <StatCard key="library" label="Books on loan" value={booksOnLoan ?? 0} icon={Library} tone="violet" href="/dashboard/library/circulation" />
    ),
    show.notices && (
      <StatCard key="notices" label="Active notices" value={activeNotices ?? 0} icon={Megaphone} tone="blue" href="/dashboard/notices" />
    ),
    show.leave && (
      <StatCard
        key="leave"
        label="Leave awaiting decision"
        value={pendingLeave ?? 0}
        icon={PlaneTakeoff}
        tone={pendingLeave ? "red" : "emerald"}
        href="/dashboard/leave"
      />
    ),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome back, {ctx.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">
          Signed in as {ctx.roleName ?? "—"} at {ctx.college.name}.
        </p>
      </div>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards}
          <StatCard label="Your role" value={ctx.roleName ?? "—"} icon={Activity} tone="amber" />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Your dashboard will fill in as modules are enabled for {ctx.college.name} and permissions are granted to{" "}
          {ctx.roleName ?? "your role"}.
        </div>
      )}

      {show.auditLogs && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentLogs.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">No activity recorded yet.</p>}
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {log.action.replaceAll("_", " ").toLowerCase()}
                    <span className="ml-2 text-xs font-normal text-slate-400">{log.module}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {log.user ? `${log.user.name} (${log.user.username})` : "System"}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{log.createdAt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
