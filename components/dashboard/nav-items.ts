import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Settings,
  ScrollText,
  GraduationCap,
  Building2,
  BookOpen,
  CalendarRange,
  Layers,
  Rows3,
  NotebookText,
} from "lucide-react";
import type { Module } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  module: Module;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

// Only pages that actually exist and work belong here — no dead links.
// New entries get added as each module ships in later phases.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" }],
  },
  {
    label: "Academic",
    items: [
      { href: "/dashboard/students", label: "Students", icon: GraduationCap, module: "students" },
      { href: "/dashboard/faculty", label: "Faculty", icon: Users, module: "faculty" },
      { href: "/dashboard/departments", label: "Departments", icon: Building2, module: "departments" },
      { href: "/dashboard/courses", label: "Courses", icon: BookOpen, module: "courses" },
      { href: "/dashboard/academic-years", label: "Academic Years", icon: CalendarRange, module: "academicYears" },
      { href: "/dashboard/semesters", label: "Semesters", icon: Layers, module: "semesters" },
      { href: "/dashboard/sections", label: "Sections", icon: Rows3, module: "sections" },
      { href: "/dashboard/subjects", label: "Subjects", icon: NotebookText, module: "subjects" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/users", label: "Users", icon: Users, module: "users" },
      { href: "/dashboard/audit-logs", label: "Audit Logs", icon: ScrollText, module: "auditLogs" },
      { href: "/dashboard/settings", label: "College Settings", icon: Settings, module: "settings" },
    ],
  },
];
