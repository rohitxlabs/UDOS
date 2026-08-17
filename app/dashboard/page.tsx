import { requireTenant } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { Users, ShieldCheck, GraduationCap, Activity } from "lucide-react";

const ICON_STYLES = {
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tone?: keyof typeof ICON_STYLES;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${ICON_STYLES[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await requireTenant();
  const canViewUsers = can(ctx, "users", "view");
  const canViewStudents = can(ctx, "students", "view");
  const canViewAuditLogs = can(ctx, "auditLogs", "view");

  const [userCount, activeUserCount, studentCount, recentLogs] = await Promise.all([
    canViewUsers ? ctx.db.user.count() : Promise.resolve(null),
    canViewUsers ? ctx.db.user.count({ where: { isActive: true } }) : Promise.resolve(null),
    canViewStudents ? ctx.db.student.count() : Promise.resolve(null),
    canViewAuditLogs
      ? ctx.db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { user: { select: { name: true, username: true } } },
        })
      : Promise.resolve([]),
  ]);

  const hasAnyStats = canViewUsers || canViewStudents;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome back, {ctx.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">Signed in as {ctx.roleName ?? "—"} at {ctx.college.name}.</p>
      </div>

      {hasAnyStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canViewUsers && <StatCard label="Total users" value={userCount ?? 0} icon={Users} tone="blue" />}
          {canViewUsers && <StatCard label="Active users" value={activeUserCount ?? 0} icon={ShieldCheck} tone="emerald" />}
          {canViewStudents && <StatCard label="Students" value={studentCount ?? 0} icon={GraduationCap} tone="violet" />}
          <StatCard label="Your role" value={ctx.roleName ?? "—"} icon={Activity} tone="amber" />
        </div>
      )}

      {canViewAuditLogs && (
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
                  <p className="text-xs text-slate-500">{log.user ? `${log.user.name} (${log.user.username})` : "System"}</p>
                </div>
                <span className="text-xs text-slate-400">{log.createdAt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAnyStats && !canViewAuditLogs && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Your role-specific dashboard modules will appear here as they are enabled for {ctx.roleName ?? "your role"}.
        </div>
      )}
    </div>
  );
}
