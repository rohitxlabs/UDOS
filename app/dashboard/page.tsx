import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { Users, ShieldCheck, Building2, Activity } from "lucide-react";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
  const user = await getCurrentUser();
  const canViewUsers = can(user.role, "users", "view");

  const [userCount, activeUserCount, collegeCount, recentLogs] = await Promise.all([
    canViewUsers ? prisma.user.count() : Promise.resolve(null),
    canViewUsers ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(null),
    canViewUsers ? prisma.college.count() : Promise.resolve(null),
    can(user.role, "auditLogs", "view")
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { user: { select: { name: true, username: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">Signed in as {ROLE_LABELS[user.role]}.</p>
      </div>

      {canViewUsers && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={userCount ?? 0} icon={Users} tone="blue" />
          <StatCard label="Active users" value={activeUserCount ?? 0} icon={ShieldCheck} tone="emerald" />
          <StatCard label="Colleges configured" value={collegeCount ?? 0} icon={Building2} tone="violet" />
          <StatCard label="Your role" value={ROLE_LABELS[user.role]} icon={Activity} tone="amber" />
        </div>
      )}

      {can(user.role, "auditLogs", "view") && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
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

      {!canViewUsers && !can(user.role, "auditLogs", "view") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Your role-specific dashboard modules will appear here as they are enabled for {ROLE_LABELS[user.role]}.
        </div>
      )}
    </div>
  );
}
