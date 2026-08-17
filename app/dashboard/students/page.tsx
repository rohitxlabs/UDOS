import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { StudentsTable } from "./students-table";
import type { Prisma } from "@/app/generated/prisma/client";

const PAGE_SIZE = 20;

export default async function StudentsPage({ searchParams }: PageProps<"/dashboard/students">) {
  const session = await requireCapability("students", "view");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const courseId = typeof params.course === "string" ? params.course : "";
  const status = typeof params.status === "string" ? params.status : "";
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.StudentWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { user: { name: { contains: q, mode: "insensitive" } } },
              { admissionNumber: { contains: q, mode: "insensitive" } },
              { rollNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      courseId ? { courseId } : {},
      status ? { status: status as Prisma.EnumStudentStatusFilter["equals"] } : {},
    ],
  };

  const [students, total, courses] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true } }, course: { select: { name: true } }, section: { select: { name: true } } },
    }),
    prisma.student.count({ where }),
    prisma.course.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">{total} student{total === 1 ? "" : "s"} enrolled.</p>
        </div>
        {can(session.role, "students", "create") && (
          <Link
            href="/dashboard/students/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New student
          </Link>
        )}
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, admission or roll number"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <select
          name="course"
          defaultValue={courseId}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <StudentsTable
        students={students.map((s) => ({
          id: s.id,
          name: s.user.name,
          admissionNumber: s.admissionNumber,
          rollNumber: s.rollNumber,
          courseName: s.course?.name ?? null,
          sectionLabel: s.section?.name ?? null,
          status: s.status,
          isActive: true,
        }))}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/dashboard/students?page=${p}${q ? `&q=${q}` : ""}${courseId ? `&course=${courseId}` : ""}${status ? `&status=${status}` : ""}`}
              className={`rounded-md px-3 py-1.5 ${p === page ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
