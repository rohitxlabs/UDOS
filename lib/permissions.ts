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

// Core tenant self-administration — always available once a college
// exists at all, never subject to the platform's per-module toggle (a
// College Admin must always be able to manage their own users/roles even
// if the platform admin forgot to tick a box for it). Only "dashboard" and
// these are exempt from Layer 1; everything else is a real business
// module the platform explicitly grants.
const UNGATED_MODULES: Module[] = ["dashboard", "users", "roles", "settings", "auditLogs"];

// Modules a college can actually be granted by the platform (i.e. that a
// real screen exists for).
export const GATED_MODULES: Module[] = MODULES.filter((m) => !UNGATED_MODULES.includes(m));

// Which modules each module cannot function without (spec section 11). A
// module is useless without the data its screens are built from: Attendance
// has nothing to mark without Students and Subjects, Payments has nothing to
// collect against without Fees.
//
// Only *direct* prerequisites are listed. Everything transitive is derived
// by moduleWithPrerequisites(), so this table stays readable and there is
// exactly one place to edit when a module gains a dependency.
export const MODULE_DEPENDENCIES: Partial<Record<Module, Module[]>> = {
  courses: ["departments"],
  semesters: ["courses", "academicYears"],
  sections: ["semesters"],
  subjects: ["semesters"],
  students: ["sections"],
  faculty: ["departments"],
  attendance: ["students", "subjects"],
  assignments: ["students", "subjects", "faculty"],
  timetable: ["sections", "subjects", "faculty"],
  exams: ["semesters", "subjects"],
  marks: ["exams", "students"],
  results: ["marks"],
  admitCards: ["exams", "students"],
  fees: ["students"],
  payments: ["fees"],
  scholarships: ["students", "academicYears"],
  library: ["students"],
  documents: ["students"],
};

// Every module that must be enabled for `moduleKey` to work, including the
// module itself — the full transitive closure, so enabling one thing turns
// on everything underneath it in a single step.
export function moduleWithPrerequisites(moduleKey: Module): Module[] {
  const seen = new Set<Module>();
  const walk = (key: Module) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const dep of MODULE_DEPENDENCIES[key] ?? []) walk(dep);
  };
  walk(moduleKey);
  return [...seen];
}

// The mirror image: everything that would stop working if `moduleKey` were
// switched off. Used to cascade a disable rather than silently leaving a
// module enabled with its foundations removed (spec section 11: "Do not
// silently break modules").
export function moduleWithDependents(moduleKey: Module): Module[] {
  const seen = new Set<Module>([moduleKey]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const key of MODULES) {
      if (seen.has(key)) continue;
      if ((MODULE_DEPENDENCIES[key] ?? []).some((dep) => seen.has(dep))) {
        seen.add(key);
        grew = true;
      }
    }
  }
  return [...seen];
}

export function hasModule(enabledModules: Set<string>, moduleKey: Module): boolean {
  return UNGATED_MODULES.includes(moduleKey) || enabledModules.has(moduleKey);
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
