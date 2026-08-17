import { requireCapability } from "@/lib/auth/dal";
import { CreateFacultyForm } from "./create-faculty-form";

export default async function NewFacultyPage() {
  const ctx = await requireCapability("faculty", "create");
  const [departments, roles] = await Promise.all([
    ctx.db.department.findMany({ orderBy: { name: "asc" } }),
    ctx.db.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">New faculty member</h1>
      <p className="mt-1 text-sm text-slate-500">Creates a profile and a login account for them.</p>
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <CreateFacultyForm departments={departments} roles={roles} />
      </div>
    </div>
  );
}
