import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader, EmptyState } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { AdmitCardsPanel, type AdmitCardRow } from "./admit-cards-panel";

export default async function AdmitCardsPage({ searchParams }: PageProps<"/dashboard/admit-cards">) {
  const ctx = await requirePageAccess("admitCards", "view");
  const params = await searchParams;
  const examId = typeof params.exam === "string" ? params.exam : "";

  const exams = await ctx.db.examination.findMany({
    orderBy: { startDate: "desc" },
    include: { semester: { include: { course: { select: { name: true } } } } },
  });

  if (exams.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Admit cards" />
        <SetupRequired
          message="Admit cards are issued against an examination."
          href="/dashboard/exams"
          cta="Go to Examinations"
        />
      </div>
    );
  }

  const exam = exams.find((e) => e.id === examId) ?? null;

  const [cards, eligibleCount] = exam
    ? await Promise.all([
        ctx.db.admitCard.findMany({
          where: { examId: exam.id },
          orderBy: { student: { rollNumber: "asc" } },
          include: { student: { include: { user: { select: { name: true } } } } },
        }),
        ctx.db.examEligibility.count({ where: { examId: exam.id, status: "ELIGIBLE" } }),
      ])
    : [[], 0];

  const rows: AdmitCardRow[] = cards.map((card) => ({
    id: card.id,
    studentName: card.student.user.name,
    roll: card.student.rollNumber ?? card.student.admissionNumber,
    released: card.releasedAt !== null,
    releasedAtLabel: card.releasedAt?.toLocaleString() ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Admit cards"
        description="Issue hall tickets to the students cleared to sit an examination."
      />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "exam",
            label: "Examination",
            placeholder: "Select examination",
            options: exams.map((e) => ({
              value: e.id,
              label: `${e.name} — ${e.semester.course.name} Sem ${e.semester.number}`,
            })),
          },
        ]}
      />

      {!exam ? (
        <EmptyState message="Choose an examination to issue or review its admit cards." />
      ) : (
        <AdmitCardsPanel
          examId={exam.id}
          rows={rows}
          eligibleCount={eligibleCount}
          canGenerate={can(ctx, "admitCards", "create")}
          canApprove={can(ctx, "admitCards", "approve")}
          canPrint={can(ctx, "admitCards", "print")}
        />
      )}
    </div>
  );
}
