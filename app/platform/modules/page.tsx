import { prisma as platformDb } from "@/lib/prisma";
import { requirePlatform } from "@/lib/auth/dal";
import { CreateModuleButton } from "./create-module-form";
import { ModulesTable } from "./modules-table";

export default async function ModulesPage() {
  await requirePlatform();

  const modules = await platformDb.module.findMany({
    orderBy: { name: "asc" },
    include: {
      dependsOn: { include: { dependsOnModule: { select: { name: true } } } },
      _count: { select: { tenantModules: { where: { enabled: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Module catalog</h1>
          <p className="text-sm text-slate-500">Every module available to be enabled for colleges.</p>
        </div>
        <CreateModuleButton modules={modules.map((m) => ({ key: m.key, name: m.name }))} />
      </div>

      <ModulesTable
        modules={modules.map((m) => ({
          id: m.id,
          key: m.key,
          name: m.name,
          description: m.description,
          isActive: m.isActive,
          dependsOn: m.dependsOn.map((d) => d.dependsOnModule.name),
          collegesUsing: m._count.tenantModules,
        }))}
      />
    </div>
  );
}
