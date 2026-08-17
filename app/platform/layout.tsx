import { requirePlatform } from "@/lib/auth/dal";
import { PlatformShell } from "@/components/platform/shell";

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const ctx = await requirePlatform();

  return <PlatformShell name={ctx.name}>{children}</PlatformShell>;
}
