import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { suggestedFine, toNumber } from "@/lib/format";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { CirculationTable, type LoanRow } from "./circulation-table";

export default async function CirculationPage({ searchParams }: PageProps<"/dashboard/library/circulation">) {
  const ctx = await requirePageAccess("library", "view");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "on-loan";

  const where =
    status === "returned"
      ? { returnedAt: { not: null } }
      : status === "overdue"
        ? { returnedAt: null, dueDate: { lt: new Date() } }
        : status === "all"
          ? {}
          : { returnedAt: null };

  const loans = await ctx.db.libraryTransaction.findMany({
    where,
    orderBy: [{ returnedAt: "asc" }, { dueDate: "asc" }],
    take: 200,
    include: {
      book: { select: { title: true } },
      student: { include: { user: { select: { name: true } } } },
    },
  });

  const now = new Date();

  const rows: LoanRow[] = loans.map((loan) => {
    const overdueDays =
      loan.returnedAt === null && loan.dueDate < now
        ? Math.ceil((now.getTime() - loan.dueDate.getTime()) / (24 * 60 * 60 * 1000))
        : 0;
    return {
      id: loan.id,
      bookTitle: loan.book.title,
      studentName: loan.student.user.name,
      roll: loan.student.rollNumber ?? loan.student.admissionNumber,
      issuedAtLabel: loan.issuedAt.toLocaleDateString(),
      dueDateLabel: loan.dueDate.toLocaleDateString(),
      returnedAtLabel: loan.returnedAt?.toLocaleDateString() ?? null,
      overdueDays,
      suggestedFine: suggestedFine(loan.dueDate, now),
      fine: loan.fine === null ? null : toNumber(loan.fine),
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/library"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Library catalogue
      </Link>

      <PageHeader title="Circulation" description="Books currently out, overdue and returned." />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "status",
            label: "Show",
            placeholder: "On loan",
            options: [
              { value: "on-loan", label: "On loan" },
              { value: "overdue", label: "Overdue" },
              { value: "returned", label: "Returned" },
              { value: "all", label: "Everything" },
            ],
          },
        ]}
      />

      <CirculationTable loans={rows} canReturn={can(ctx, "library", "edit")} />
    </div>
  );
}
