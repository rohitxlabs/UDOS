import { notFound } from "next/navigation";
import { prisma as platformDb } from "@/lib/prisma";
import { requirePlatform } from "@/lib/auth/dal";
import { ModuleToggles } from "./module-toggles";
import { MODULE_DEPENDENCIES, type Module } from "@/lib/permissions";
import { AdminAccess } from "./admin-access";
import { DatabasePanel } from "./database-panel";

export default async function CollegeDetailPage({ params }: PageProps<"/platform/colleges/[id]">) {
  await requirePlatform();
  const { id } = await params;

  const [college, modules, tenantModules] = await Promise.all([
    platformDb.college.findUnique({ where: { id } }),
    platformDb.module.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    platformDb.tenantModule.findMany({ where: { collegeId: id } }),
  ]);

  if (!college) notFound();

  const enabledByKey = new Map(tenantModules.map((tm) => [tm.moduleId, tm.enabled]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{college.name}</h1>
          <p className="mt-1 text-sm text-slate-500">/{college.slug} — {college.isActive ? "Active" : "Suspended"}</p>
        </div>
        <AdminAccess collegeId={college.id} collegeName={college.name} />
      </div>

      <DatabasePanel
        collegeId={college.id}
        encryptedDatabaseUrl={college.databaseUrlEncrypted}
        dbStatus={college.dbStatus}
        dbError={college.dbError}
        dbModels={college.dbModels}
        dbInitializedAt={college.dbInitializedAt}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Modules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only modules enabled here can ever appear for this college&apos;s own users — the College Admin decides who
          on their side gets to use them.
        </p>
        <div className="mt-4">
          <ModuleToggles
            collegeId={college.id}
            modules={modules.map((m) => ({
              key: m.key,
              name: m.name,
              description: m.description,
              enabled: enabledByKey.get(m.id) ?? false,
              requires: MODULE_DEPENDENCIES[m.key as Module] ?? [],
            }))}
          />
        </div>
      </div>
    </div>
  );
}
