import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { CreateUserForm } from "./create-user-form";
import { UsersTable } from "./users-table";
import { ROLE_LABELS } from "@/lib/permissions";
import { Role } from "@/app/generated/prisma/client";
import { Search } from "lucide-react";

export default async function UsersPage({ searchParams }: PageProps<"/dashboard/users">) {
  const session = await requireCapability("users", "view");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const roleFilter = typeof params.role === "string" ? params.role : "";

  const users = await prisma.user.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        roleFilter ? { role: roleFilter as Role } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      email: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Manage login accounts for staff. Only Super Admin can create accounts.</p>
        </div>
        <CreateUserForm />
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, username or email"
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <select
          name="role"
          defaultValue={roleFilter}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <UsersTable users={users} currentUserId={session.userId} />
    </div>
  );
}
