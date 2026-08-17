import Link from "next/link";
import { requireCapability } from "@/lib/auth/dal";

const PAGE_SIZE = 25;

export default async function AuditLogsPage({ searchParams }: PageProps<"/dashboard/audit-logs">) {
  const ctx = await requireCapability("auditLogs", "view");
  const params = await searchParams;
  const moduleFilter = typeof params.module === "string" ? params.module : "";
  const page = Math.max(1, Number(params.page) || 1);

  const where = moduleFilter ? { module: moduleFilter } : {};

  const [logs, total, modules] = await Promise.all([
    ctx.db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, username: true } } },
    }),
    ctx.db.auditLog.count({ where }),
    ctx.db.auditLog.findMany({ distinct: ["module"], select: { module: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Audit logs</h1>
        <p className="text-sm text-slate-500">Every sensitive action taken in the system, in order.</p>
      </div>

      <form className="flex items-center gap-3">
        <select
          name="module"
          defaultValue={moduleFilter}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        >
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.module} value={m.module}>
              {m.module}
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

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Module</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No audit log entries.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{log.createdAt.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-900">
                  {log.user ? `${log.user.name} (${log.user.username})` : "System"}
                </td>
                <td className="px-4 py-3 text-slate-600">{log.roleName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{log.action.replaceAll("_", " ").toLowerCase()}</td>
                <td className="px-4 py-3 text-slate-600">{log.module}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/dashboard/audit-logs?page=${p}${moduleFilter ? `&module=${moduleFilter}` : ""}`}
              className={`rounded-md px-3 py-1.5 ${
                p === page ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
