import Link from "next/link";
import { prisma as platformDb } from "@/lib/prisma";
import { requirePlatform } from "@/lib/auth/dal";

const PAGE_SIZE = 25;

export default async function PlatformAuditLogsPage({ searchParams }: PageProps<"/platform/audit-logs">) {
  await requirePlatform();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [logs, total] = await Promise.all([
    platformDb.platformAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, username: true } } },
    }),
    platformDb.platformAuditLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Platform audit logs</h1>
        <p className="text-sm text-slate-500">
          What the platform owner did to this deployment — module grants and revocations, College Admin password
          reissues, and Super Admin sign-ins. The college&apos;s own activity is logged separately, in their database.
        </p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Area</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
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
              href={`/platform/audit-logs?page=${p}`}
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
