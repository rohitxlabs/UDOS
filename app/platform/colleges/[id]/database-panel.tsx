import { Database } from "lucide-react";
import { getTenantClient, describeTenantDatabase } from "@/lib/tenant-db";

// Platform-owner view of where a college's data physically lives. This is
// deliberately absent from anything a college user can reach (spec section 5
// — a college never needs to know its own infrastructure), but the Super
// Admin does need it: without it, "my new database has no tables" is
// unanswerable, because the tables are in a namespaced schema rather than
// the `public` one a database console shows by default.
export async function DatabasePanel({
  collegeId,
  encryptedDatabaseUrl,
  dbStatus,
  dbError,
  dbModels,
  dbInitializedAt,
}: {
  collegeId: string;
  encryptedDatabaseUrl: string;
  dbStatus: string;
  dbError: string | null;
  dbModels: string[];
  dbInitializedAt: Date | null;
}) {
  const info = describeTenantDatabase(encryptedDatabaseUrl);

  let tableCount: number | null = null;
  let reachable = true;
  try {
    const db = getTenantClient(collegeId, encryptedDatabaseUrl);
    const rows = await db.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = ${info.schema}
    `;
    tableCount = rows[0]?.count ?? 0;
  } catch {
    // A tenant database being down must not take the platform page down
    // with it — that is the whole point of per-tenant isolation
    // (spec section 22).
    reachable = false;
  }

  const rows: [string, string][] = [
    ["Host", info.host],
    ["Database", info.database],
    ["Schema", info.schema],
    ["Tables", reachable ? String(tableCount) : "—"],
    ["Models provisioned", dbModels.length ? String(dbModels.length) : "—"],
    ["Initialized", dbInitializedAt ? dbInitializedAt.toLocaleString() : "—"],
  ];

  // Initialization status is the authority on whether this database is
  // usable; the live table count is only corroboration.
  const STATUS_STYLES: Record<string, string> = {
    READY: "bg-emerald-50 text-emerald-700",
    PENDING: "bg-slate-100 text-slate-700",
    INITIALIZING: "bg-blue-50 text-blue-700",
    FAILED: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">Database</h2>
        <span
          className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            !reachable ? "bg-red-50 text-red-700" : (STATUS_STYLES[dbStatus] ?? "bg-slate-100 text-slate-700")
          }`}
        >
          {!reachable ? "Unreachable" : dbStatus.charAt(0) + dbStatus.slice(1).toLowerCase()}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-dashed border-slate-200 pb-1.5">
            <dt className="text-slate-500">{label}</dt>
            <dd className="truncate font-medium text-slate-900" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {dbError && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
          <span className="font-semibold">Initialization error:</span> {dbError}
        </p>
      )}

      {dbModels.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            Tables created for this college&apos;s modules ({dbModels.length})
          </summary>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">{dbModels.slice().sort().join(", ")}</p>
        </details>
      )}

      <p className="mt-4 text-xs text-slate-500">
        This college&apos;s tables live in the <code className="font-mono text-slate-700">{info.schema}</code> schema,
        not <code className="font-mono text-slate-700">public</code>. Database consoles usually open on{" "}
        <code className="font-mono text-slate-700">public</code>, so switch schema there to see them. Credentials are
        encrypted at rest and never displayed.
      </p>
    </div>
  );
}
