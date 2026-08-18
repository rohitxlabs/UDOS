import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { RequestLeaveButton } from "./leave-form";
import { LeaveTable, type LeaveRow, type LeaveStatusValue } from "./leave-table";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function LeavePage({ searchParams }: PageProps<"/dashboard/leave">) {
  const ctx = await requirePageAccess("leave", "view");
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const scope = typeof params.scope === "string" ? params.scope : "";

  const canFileForOthers = can(ctx, "leave", "create");

  const [requests, users] = await Promise.all([
    ctx.db.leaveRequest.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter as LeaveStatusValue } : {}),
        ...(scope === "mine" ? { userId: ctx.userId } : {}),
      },
      orderBy: [{ status: "asc" }, { fromDate: "desc" }],
      take: 200,
      include: { user: { include: { role: { select: { name: true } } } } },
    }),
    canFileForOthers
      ? ctx.db.user.findMany({
          where: { isActive: true, id: { not: ctx.userId } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, username: true },
        })
      : Promise.resolve([]),
  ]);

  const rows: LeaveRow[] = requests.map((request) => ({
    id: request.id,
    userName: request.user.name,
    roleName: request.user.role?.name ?? null,
    fromLabel: request.fromDate.toLocaleDateString(),
    toLabel: request.toDate.toLocaleDateString(),
    days: Math.round((request.toDate.getTime() - request.fromDate.getTime()) / DAY_MS) + 1,
    reason: request.reason,
    documentUrl: request.documentUrl,
    status: request.status as LeaveStatusValue,
    decidedLabel: request.approvedAt?.toLocaleDateString() ?? null,
    isMine: request.userId === ctx.userId,
  }));

  const pending = rows.filter((row) => row.status === "PENDING").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leave"
        description="Leave requests and their approvals."
        action={
          <RequestLeaveButton users={users.map((u) => ({ id: u.id, label: `${u.name} (${u.username})` }))} />
        }
      />

      {pending > 0 && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {pending} request{pending === 1 ? "" : "s"} awaiting a decision.
        </div>
      )}

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "status",
            label: "Status",
            placeholder: "All statuses",
            options: [
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ],
          },
          {
            kind: "select",
            name: "scope",
            label: "Show",
            placeholder: "Everyone",
            options: [{ value: "mine", label: "Only mine" }],
          },
        ]}
      />

      <LeaveTable requests={rows} canApprove={can(ctx, "leave", "approve")} />
    </div>
  );
}
