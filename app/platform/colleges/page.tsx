import { prisma as platformDb } from "@/lib/prisma";
import { requirePlatform } from "@/lib/auth/dal";
import { CreateCollegeButton } from "./create-college-form";
import { CollegesTable } from "./colleges-table";

export default async function CollegesPage() {
  await requirePlatform();

  const [colleges, modules] = await Promise.all([
    platformDb.college.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { tenantModules: { where: { enabled: true } } } } },
    }),
    platformDb.module.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Colleges</h1>
          <p className="text-sm text-slate-500">Tenants on the platform, each with their own database.</p>
        </div>
        <CreateCollegeButton modules={modules} />
      </div>

      <CollegesTable
        colleges={colleges.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          isActive: c.isActive,
          moduleCount: c._count.tenantModules,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
