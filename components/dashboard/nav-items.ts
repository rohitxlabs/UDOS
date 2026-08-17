import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, Settings, ScrollText } from "lucide-react";
import type { Module } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  module: Module;
};

// Only pages that actually exist and work belong here — no dead links.
// New entries get added as each module ships in later phases.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/dashboard/users", label: "Users", icon: Users, module: "users" },
  { href: "/dashboard/audit-logs", label: "Audit Logs", icon: ScrollText, module: "auditLogs" },
  { href: "/dashboard/settings", label: "College Settings", icon: Settings, module: "settings" },
];
