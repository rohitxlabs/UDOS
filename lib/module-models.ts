import type { Module } from "@/lib/permissions";

// Which Prisma models each module's screens actually read and write. This is
// the "Module → Prisma models" mapping: a college's database is built from
// the union of the models for the modules it was granted, never the whole
// schema.
//
// Only the models a module *owns* are listed. Anything they merely point at
// (Attendance → Student) is pulled in automatically by the dependency
// resolver in lib/tenant-schema.ts, which reads the real schema rather than
// trusting a second hand-maintained list to stay in step with it.
export const MODULE_MODELS: Partial<Record<Module, string[]>> = {
  departments: ["Department"],
  courses: ["Course"],
  academicYears: ["AcademicYear"],
  semesters: ["Semester"],
  sections: ["Section"],
  subjects: ["Subject"],
  students: ["Student", "Parent", "StudentParent", "AdmissionApplication"],
  faculty: ["Teacher", "FacultySubject"],
  attendance: ["Attendance"],
  assignments: ["Assignment", "AssignmentSubmission"],
  exams: ["Examination", "ExamSubject", "ExamEligibility"],
  marks: ["Marks"],
  results: ["Result", "GradeScale"],
  admitCards: ["AdmitCard"],
  fees: ["FeeStructure", "FeeComponent", "StudentFee"],
  payments: ["Payment", "Receipt"],
  scholarships: ["Scholarship"],
  timetable: ["Timetable"],
  leave: ["LeaveRequest"],
  notices: ["Notice"],
  library: ["LibraryBook", "LibraryTransaction"],
  documents: ["Document", "Certificate"],
  // Reports render from whatever other modules are enabled; it owns no
  // tables of its own.
  reports: [],
};

// Present in every college database whatever modules were bought: a tenant
// without users, roles or an audit trail cannot be administered at all, and
// these back the ungated core screens (see UNGATED_MODULES in permissions).
export const CORE_MODELS = ["Settings", "Role", "RolePermission", "User", "AuditLog", "Notification"] as const;

// The models a set of modules directly owns, before dependency resolution.
export function modelsForModules(moduleKeys: string[]): string[] {
  const models = new Set<string>(CORE_MODELS);
  for (const key of moduleKeys) {
    for (const model of MODULE_MODELS[key as Module] ?? []) models.add(model);
  }
  return [...models];
}
