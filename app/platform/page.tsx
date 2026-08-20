import { requirePlatform } from "@/lib/auth/dal";
import { prisma as platformDb } from "@/lib/prisma";
import { COLLEGE_ID } from "@/lib/college";
import { MODULE_DEPENDENCIES, type Module } from "@/lib/permissions";
import { ModuleToggles } from "./module-toggles";
import { AdminAccess } from "./admin-access";
import { CollegeStatusToggle } from "./college-status-toggle";
import { Blocks, CheckCircle2, Building2, Database } from "lucide-react";

// The Super Admin's home screen, and the whole reason they sign in: which
// modules this deployment's college is allowed to use. There is no college
// list because there is no second college — a new college is a new
// deployment, with its own domain and its own pair of databases.
export default async function PlatformPage() {
  await requirePlatform();

  const [college, modules, grants, recentLogs] = await Promise.all([
    platformDb.college.findUnique({ where: { id: COLLEGE_ID } }),
    platformDb.module.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    platformDb.moduleAccess.findMany({ where: { enabled: true }, select: { moduleId: true } }),
    platformDb.platformAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, username: true } } },
    }),
  ]);

  // A deployment that was never seeded has no college row. Say so plainly
  // instead of rendering an empty control panel that looks broken.
  if (!college) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-sm font-semibold text-amber-900">This deployment has not been set up yet</h1>
        <p className="mt-2 text-sm text-amber-800">
          No college is configured. Set <code className="rounded bg-amber-100 px-1">COLLEGE_NAME</code> and{" "}
          <code className="rounded bg-amber-100 px-1">COLLEGE_CODE</code> in the environment, then run{" "}
          <code className="rounded bg-amber-100 px-1">npm run db:setup</code>.
        </p>
      </div>
    );
  }

  const enabledIds = new Set(grants.map((g) => g.moduleId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{college.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {college.code} — {college.isActive ? "Active" : "Suspended"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminAccess collegeName={college.name} />
          <CollegeStatusToggle isActive={college.isActive} collegeName={college.name} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Modules granted" value={`${enabledIds.size} of ${modules.length}`} icon={Blocks} tone="violet" />
        <StatCard label="College access" value={college.isActive ? "Active" : "Suspended"} icon={CheckCircle2} tone={college.isActive ? "emerald" : "amber"} />
        <StatCard label="Deployment" value="Single college" icon={Building2} tone="blue" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Modules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only modules enabled here can ever appear for this college&apos;s own users — the College Admin decides who
          on their side gets to use them.
        </p>
        <div className="mt-4">
          <ModuleToggles
            modules={modules.map((m) => ({
              key: m.key,
              name: m.name,
              description: m.description,
              enabled: enabledIds.has(m.id),
              requires: MODULE_DEPENDENCIES[m.key as Module] ?? [],
            }))}
          />
        </div>
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
  icon: typeof Database;
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
