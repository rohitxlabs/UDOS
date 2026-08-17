import { requirePlatform } from "@/lib/auth/dal";
import { prisma as platformDb } from "@/lib/prisma";
import { Building2, CheckCircle2, Blocks, Activity } from "lucide-react";

const ICON_STYLES = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof Building2;
  tone: keyof typeof ICON_STYLES;
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

export default async function PlatformDashboardPage() {
  const ctx = await requirePlatform();

  const [totalColleges, activeColleges, totalModules, recentLogs] = await Promise.all([
    platformDb.college.count(),
    platformDb.college.count({ where: { isActive: true } }),
    platformDb.module.count({ where: { isActive: true } }),
    platformDb.platformAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, username: true } }, college: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome back, {ctx.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">Platform overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total colleges" value={totalColleges} icon={Building2} tone="blue" />
        <StatCard label="Active colleges" value={activeColleges} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Modules in catalog" value={totalModules} icon={Blocks} tone="violet" />
        <StatCard label="Your role" value="Super Admin" icon={Activity} tone="amber" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent platform activity</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {recentLogs.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">No activity recorded yet.</p>}
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  {log.action.replaceAll("_", " ").toLowerCase()}
                  <span className="ml-2 text-xs font-normal text-slate-400">{log.module}</span>
                  {log.college && <span className="ml-2 text-xs font-normal text-slate-400">— {log.college.name}</span>}
                </p>
                <p className="text-xs text-slate-500">{log.user ? `${log.user.name} (${log.user.username})` : "System"}</p>
              </div>
              <span className="text-xs text-slate-400">{log.createdAt.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
