import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { toDateInput } from "@/lib/format";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreateNoticeButton, AUDIENCE_LABELS, type AudienceValue, type Targets } from "./notice-form";
import { NoticesList, type NoticeRow } from "./notices-list";

export default async function NoticesPage({ searchParams }: PageProps<"/dashboard/notices">) {
  const ctx = await requireCapability("notices", "view");
  const params = await searchParams;
  const audienceFilter = typeof params.audience === "string" ? params.audience : "";
  const stateFilter = typeof params.state === "string" ? params.state : "";

  const now = new Date();

  const [notices, departments, courses, semesters, sections] = await Promise.all([
    ctx.db.notice.findMany({
      where: {
        ...(audienceFilter ? { audience: audienceFilter as AudienceValue } : {}),
        ...(stateFilter === "active"
          ? { publishDate: { lte: now }, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }
          : {}),
        ...(stateFilter === "scheduled" ? { publishDate: { gt: now } } : {}),
        ...(stateFilter === "expired" ? { expiryDate: { lt: now } } : {}),
      },
      orderBy: { publishDate: "desc" },
      take: 100,
      include: { createdBy: { select: { name: true } } },
    }),
    ctx.db.department.findMany({ orderBy: { name: "asc" } }),
    ctx.db.course.findMany({ orderBy: { name: "asc" } }),
    ctx.db.semester.findMany({
      orderBy: [{ course: { name: "asc" } }, { number: "asc" }],
      include: { course: { select: { name: true } } },
    }),
    ctx.db.section.findMany({
      orderBy: [{ semester: { course: { name: "asc" } } }, { name: "asc" }],
      include: { semester: { include: { course: { select: { name: true } } } } },
    }),
  ]);

  const targets: Targets = {
    departments: departments.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` })),
    courses: courses.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` })),
    semesters: semesters.map((s) => ({ id: s.id, label: `${s.course.name} — Sem ${s.number}` })),
    sections: sections.map((s) => ({
      id: s.id,
      label: `${s.semester.course.name} — Sem ${s.semester.number} — ${s.name}`,
    })),
  };

  const labelForTarget = (notice: (typeof notices)[number]) => {
    const id = notice.departmentId ?? notice.courseId ?? notice.semesterId ?? notice.sectionId;
    if (!id) return AUDIENCE_LABELS[notice.audience as AudienceValue];
    const pool = [...targets.departments, ...targets.courses, ...targets.semesters, ...targets.sections];
    return pool.find((option) => option.id === id)?.label ?? AUDIENCE_LABELS[notice.audience as AudienceValue];
  };

  const rows: NoticeRow[] = notices.map((notice) => ({
    id: notice.id,
    title: notice.title,
    description: notice.description,
    attachmentUrl: notice.attachmentUrl,
    publishDate: toDateInput(notice.publishDate),
    expiryDate: notice.expiryDate ? toDateInput(notice.expiryDate) : null,
    audience: notice.audience as AudienceValue,
    targetId: notice.departmentId ?? notice.courseId ?? notice.semesterId ?? notice.sectionId,
    audienceLabel: labelForTarget(notice),
    publishLabel: notice.publishDate.toLocaleDateString(),
    expiryLabel: notice.expiryDate?.toLocaleDateString() ?? null,
    authorName: notice.createdBy.name,
    state:
      notice.publishDate > now
        ? "Scheduled"
        : notice.expiryDate && notice.expiryDate < now
          ? "Expired"
          : "Active",
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notices"
        description="Announcements addressed to the whole college or a specific group."
        action={can(ctx, "notices", "create") ? <CreateNoticeButton targets={targets} /> : undefined}
      />

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "audience",
            label: "Audience",
            placeholder: "All audiences",
            options: (Object.keys(AUDIENCE_LABELS) as AudienceValue[]).map((value) => ({
              value,
              label: AUDIENCE_LABELS[value],
            })),
          },
          {
            kind: "select",
            name: "state",
            label: "Status",
            placeholder: "All",
            options: [
              { value: "active", label: "Active" },
              { value: "scheduled", label: "Scheduled" },
              { value: "expired", label: "Expired" },
            ],
          },
        ]}
      />

      <NoticesList
        notices={rows}
        targets={targets}
        canEdit={can(ctx, "notices", "edit")}
        canDelete={can(ctx, "notices", "delete")}
      />
    </div>
  );
}
