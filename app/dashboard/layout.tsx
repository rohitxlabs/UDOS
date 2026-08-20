import { requireCollege } from "@/lib/auth/dal";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireCollege();

  return (
    <DashboardShell
      collegeName={ctx.college.name}
      name={ctx.name}
      roleName={ctx.roleName}
      enabledModules={[...ctx.enabledModules]}
      permissions={[...ctx.permissions]}
    >
      {children}
    </DashboardShell>
  );
}
