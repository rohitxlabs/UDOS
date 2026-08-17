import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { CreateFacultyForm } from "./create-faculty-form";

export default async function NewFacultyPage() {
  await requireCapability("faculty", "create");
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">New faculty member</h1>
      <p className="mt-1 text-sm text-slate-500">Creates a profile and a login account with the Teacher role.</p>
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <CreateFacultyForm departments={departments} />
      </div>
    </div>
  );
}
