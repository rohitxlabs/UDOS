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
  ShieldCheck,
  CalendarCheck,
  ClipboardList,
  FileCheck2,
  PenSquare,
  Trophy,
  IdCard,
  Wallet,
  Receipt,
  Award,
  CalendarClock,
  PlaneTakeoff,
  Megaphone,
  Library,
  FolderOpen,
  BarChart3,
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
// The sidebar filters this list per request by module availability (what
// the platform granted this college) and permission (what the college
// granted this role), so a group with nothing visible disappears entirely.
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
    label: "Teaching",
    items: [
      { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, module: "attendance" },
      { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardList, module: "assignments" },
      { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, module: "timetable" },
    ],
  },
  {
    label: "Examination",
    items: [
      { href: "/dashboard/exams", label: "Examinations", icon: FileCheck2, module: "exams" },
      { href: "/dashboard/marks", label: "Marks", icon: PenSquare, module: "marks" },
      { href: "/dashboard/results", label: "Results", icon: Trophy, module: "results" },
      { href: "/dashboard/admit-cards", label: "Admit Cards", icon: IdCard, module: "admitCards" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/fees", label: "Fees", icon: Wallet, module: "fees" },
      { href: "/dashboard/payments", label: "Payments", icon: Receipt, module: "payments" },
      { href: "/dashboard/scholarships", label: "Scholarships", icon: Award, module: "scholarships" },
    ],
  },
  {
    label: "Campus",
    items: [
      { href: "/dashboard/library", label: "Library", icon: Library, module: "library" },
      { href: "/dashboard/notices", label: "Notices", icon: Megaphone, module: "notices" },
      { href: "/dashboard/leave", label: "Leave", icon: PlaneTakeoff, module: "leave" },
      { href: "/dashboard/documents", label: "Documents", icon: FolderOpen, module: "documents" },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3, module: "reports" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/users", label: "Users", icon: Users, module: "users" },
      { href: "/dashboard/roles", label: "Roles & Permissions", icon: ShieldCheck, module: "roles" },
      { href: "/dashboard/audit-logs", label: "Audit Logs", icon: ScrollText, module: "auditLogs" },
      { href: "/dashboard/settings", label: "College Settings", icon: Settings, module: "settings" },
    ],
  },
];
