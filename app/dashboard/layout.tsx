import { getCurrentUser } from "@/lib/auth/dal";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();

  return (
    <DashboardShell role={user.role} name={user.name}>
      {children}
    </DashboardShell>
  );
}
