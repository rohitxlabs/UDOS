import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/auth/dal";
import { MODULE_LABELS, type Module } from "@/lib/permissions";
import { PermissionGrid } from "./permission-grid";

const CORE_MODULES: Module[] = ["users", "roles", "settings", "auditLogs"];

export default async function RoleDetailPage({ params }: PageProps<"/dashboard/roles/[id]">) {
  const ctx = await requirePageAccess("roles", "view");
  const { id } = await params;

  const role = await ctx.db.role.findUnique({ where: { id }, include: { permissions: true } });
  if (!role) notFound();

  const availableModules: Module[] = [...ctx.enabledModules, ...CORE_MODULES].filter(
    (m): m is Module => m in MODULE_LABELS
  );

  const granted = new Set(role.permissions.map((p) => `${p.moduleKey}:${p.action.toLowerCase()}`));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{role.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {role.isSystem
            ? "This is the built-in College Admin role — it always has full access and can't be edited."
            : "Choose what this role can do, module by module. Only modules the platform has enabled for you appear here."}
        </p>
      </div>

      <PermissionGrid
        roleId={role.id}
        readOnly={role.isSystem}
        modules={availableModules.map((key) => ({ key, label: MODULE_LABELS[key] }))}
        granted={granted}
      />
    </div>
  );
}
