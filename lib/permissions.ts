// Two-level access model (see the platform spec):
//   Layer 1 — is this module even enabled for the tenant? (Platform Super Admin)
//   Layer 2 — does this user's role have this action on that module? (College Admin)
// Both layers are precomputed once per request into plain Sets by
// lib/auth/dal.ts's getAccessContext(), so everything in this file is a
// synchronous, dependency-free Set lookup — safe to call from Server
// Components for conditional rendering as well as from server actions.

export const MODULES = [
  "dashboard",
  "students",
  "faculty",
  "departments",
  "courses",
  "academicYears",
  "semesters",
  "sections",
  "subjects",
  "attendance",
  "assignments",
  "exams",
  "marks",
  "results",
  "admitCards",
  "fees",
  "payments",
  "scholarships",
  "timetable",
  "leave",
  "notices",
  "library",
  "documents",
  "reports",
  "auditLogs",
  "users",
  "roles",
  "settings",
] as const;

export type Module = (typeof MODULES)[number];
export type Capability = "view" | "create" | "edit" | "delete" | "approve" | "export" | "print";

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  students: "Students",
  faculty: "Faculty",
  departments: "Departments",
  courses: "Courses",
  academicYears: "Academic Years",
  semesters: "Semesters",
  sections: "Sections",
  subjects: "Subjects",
  attendance: "Attendance",
  assignments: "Assignments",
  exams: "Examinations",
  marks: "Marks",
  results: "Results",
  admitCards: "Admit Cards",
  fees: "Fees",
  payments: "Payments",
  scholarships: "Scholarships",
  timetable: "Timetable",
  leave: "Leave",
  notices: "Notices",
  library: "Library",
  documents: "Documents",
  reports: "Reports",
  auditLogs: "Audit Logs",
  users: "Users",
  roles: "Roles & Permissions",
  settings: "Settings",
};

// Modules a college can actually be granted by the platform (i.e. that a
// real screen exists for). Kept separate from MODULES because MODULES also
// includes "dashboard" and other always-on/ungated concepts.
export const GATED_MODULES: Module[] = MODULES.filter((m) => m !== "dashboard");

export function hasModule(enabledModules: Set<string>, moduleKey: Module): boolean {
  return enabledModules.has(moduleKey);
}

export function permissionKey(moduleKey: Module, action: Capability): string {
  return `${moduleKey}:${action}`;
}

export function hasPermission(permissions: Set<string>, moduleKey: Module, action: Capability): boolean {
  return permissions.has(permissionKey(moduleKey, action));
}

// The combined check most UI code wants: module must be enabled for the
// tenant AND the caller's role must be granted this action on it.
export function can(
  ctx: { enabledModules: Set<string>; permissions: Set<string> },
  moduleKey: Module,
  action: Capability
): boolean {
  return hasModule(ctx.enabledModules, moduleKey) && hasPermission(ctx.permissions, moduleKey, action);
}
