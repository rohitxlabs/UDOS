import type { Role } from "@/app/generated/prisma";

// Central role → module capability matrix (spec section 27).
// Server actions and route handlers must check this — never rely on the
// sidebar hiding a link as the only protection.

export const MODULES = [
  "dashboard",
  "students",
  "faculty",
  "departments",
  "courses",
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
  "settings",
] as const;

export type Module = (typeof MODULES)[number];
export type Capability = "view" | "create" | "edit" | "delete" | "approve";

type ModulePermissions = Partial<Record<Module, Capability[]>>;

const ALL: Capability[] = ["view", "create", "edit", "delete", "approve"];
const VIEW: Capability[] = ["view"];

const MATRIX: Record<Role, ModulePermissions> = {
  SUPER_ADMIN: Object.fromEntries(MODULES.map((m) => [m, ALL])) as ModulePermissions,

  MANAGEMENT: {
    dashboard: VIEW,
    students: VIEW,
    faculty: VIEW,
    departments: VIEW,
    courses: VIEW,
    subjects: VIEW,
    attendance: VIEW,
    assignments: VIEW,
    exams: VIEW,
    marks: ["view", "approve"],
    results: ["view", "approve"],
    admitCards: ["view", "approve"],
    fees: VIEW,
    payments: VIEW,
    scholarships: ["view", "approve"],
    timetable: VIEW,
    leave: ["view", "approve"],
    notices: ["view", "create", "edit"],
    library: VIEW,
    documents: VIEW,
    reports: VIEW,
    auditLogs: VIEW,
  },

  TEACHER: {
    dashboard: VIEW,
    students: VIEW,
    attendance: ["view", "create", "edit"],
    assignments: ["view", "create", "edit"],
    exams: VIEW,
    marks: ["view", "create", "edit"],
    results: VIEW,
    timetable: VIEW,
    leave: ["view", "create"],
    notices: VIEW,
    documents: VIEW,
  },

  ACCOUNTS: {
    dashboard: VIEW,
    students: VIEW,
    fees: ["view", "create", "edit"],
    payments: ["view", "create", "edit"],
    scholarships: ["view", "create", "edit"],
    reports: VIEW,
    notices: VIEW,
  },

  EXAM_CELL: {
    dashboard: VIEW,
    students: VIEW,
    exams: ["view", "create", "edit"],
    marks: ["view", "create", "edit", "approve"],
    results: ["view", "create", "edit", "approve"],
    admitCards: ["view", "create", "edit"],
    reports: VIEW,
    notices: VIEW,
  },

  STUDENT: {
    dashboard: VIEW,
    attendance: VIEW,
    assignments: VIEW,
    exams: VIEW,
    marks: VIEW,
    results: VIEW,
    admitCards: VIEW,
    fees: VIEW,
    payments: VIEW,
    timetable: VIEW,
    leave: ["view", "create"],
    notices: VIEW,
    documents: VIEW,
    library: VIEW,
  },

  PARENT: {
    dashboard: VIEW,
    attendance: VIEW,
    assignments: VIEW,
    results: VIEW,
    fees: VIEW,
    notices: VIEW,
  },
};

export function can(role: Role, moduleName: Module, capability: Capability): boolean {
  const perms = MATRIX[role]?.[moduleName];
  return !!perms?.includes(capability);
}

export function assertCan(role: Role, moduleName: Module, capability: Capability) {
  if (!can(role, moduleName, capability)) {
    throw new Error(`Forbidden: role ${role} lacks ${capability} on ${moduleName}`);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGEMENT: "Management",
  TEACHER: "Teacher",
  ACCOUNTS: "Accounts",
  EXAM_CELL: "Examination Cell",
  STUDENT: "Student",
  PARENT: "Parent",
};

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/dashboard",
  MANAGEMENT: "/dashboard",
  TEACHER: "/dashboard",
  ACCOUNTS: "/dashboard",
  EXAM_CELL: "/dashboard",
  STUDENT: "/dashboard",
  PARENT: "/dashboard",
};
