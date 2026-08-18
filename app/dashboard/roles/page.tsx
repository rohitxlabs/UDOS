import { requirePageAccess } from "@/lib/auth/dal";
import { CreateRoleButton } from "./create-role-form";
import { RolesTable } from "./roles-table";

export default async function RolesPage() {
  const ctx = await requirePageAccess("roles", "view");

  const roles = await ctx.db.role.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Roles & permissions</h1>
          <p className="text-sm text-slate-500">
            What each role at {ctx.college.name} can do — only within modules the platform has enabled.
          </p>
        </div>
        <CreateRoleButton />
      </div>

      <RolesTable
        roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem, userCount: r._count.users }))}
      />
    </div>
  );
}
