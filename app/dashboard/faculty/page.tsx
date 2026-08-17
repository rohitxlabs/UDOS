import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FacultyTable } from "./faculty-table";

export default async function FacultyPage({ searchParams }: PageProps<"/dashboard/faculty">) {
  const ctx = await requireCapability("faculty", "view");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";

  const faculty = await ctx.db.teacher.findMany({
    where: q
      ? {
          user: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : undefined,
    orderBy: { user: { name: "asc" } },
    include: { user: true, department: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Faculty</h1>
          <p className="text-sm text-slate-500">Teachers and their department assignments.</p>
        </div>
        {can(ctx, "faculty", "create") && (
          <Link
            href="/dashboard/faculty/new"
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New faculty
          </Link>
        )}
      </div>

      <form className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email"
          className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
      </form>

      <FacultyTable
        faculty={faculty.map((t) => ({
          id: t.id,
          name: t.user.name,
          employeeId: t.employeeId,
          departmentName: t.department?.name ?? null,
          designation: t.designation,
          email: t.user.email,
          phone: t.user.phone,
          isActive: t.user.isActive,
        }))}
      />
    </div>
  );
}
