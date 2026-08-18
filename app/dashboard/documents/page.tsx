import { requirePageAccess } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { SetupRequired } from "@/components/dashboard/setup-required";
import { AttachDocumentButton } from "./document-form";
import { DocumentsTable, type DocumentRow } from "./documents-table";

export default async function DocumentsPage({ searchParams }: PageProps<"/dashboard/documents">) {
  const ctx = await requirePageAccess("documents", "view");
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const studentFilter = typeof params.student === "string" ? params.student : "";

  const students = await ctx.db.student.findMany({
    orderBy: [{ rollNumber: "asc" }, { admissionNumber: "asc" }],
    include: { user: { select: { name: true } } },
  });

  if (students.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Documents" />
        <SetupRequired
          message="Documents are filed against a student record."
          href="/dashboard/students"
          cta="Go to Students"
        />
      </div>
    );
  }

  const documents = await ctx.db.document.findMany({
    where: {
      ...(studentFilter ? { studentId: studentFilter } : {}),
      ...(statusFilter === "verified" ? { verified: true } : {}),
      ...(statusFilter === "unverified" ? { verified: false } : {}),
    },
    orderBy: { uploadedAt: "desc" },
    take: 200,
    include: { student: { include: { user: { select: { name: true } } } } },
  });

  const rows: DocumentRow[] = documents.map((document) => ({
    id: document.id,
    studentName: document.student.user.name,
    roll: document.student.rollNumber ?? document.student.admissionNumber,
    type: document.type,
    fileUrl: document.fileUrl,
    verified: document.verified,
    uploadedLabel: document.uploadedAt.toLocaleDateString(),
  }));

  const unverified = rows.filter((row) => !row.verified).length;

  const studentOptions = students.map((student) => ({
    id: student.id,
    label: `${student.rollNumber ?? student.admissionNumber} — ${student.user.name}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Documents"
        description="Student records on file and their verification status."
        action={can(ctx, "documents", "create") ? <AttachDocumentButton students={studentOptions} /> : undefined}
      />

      {unverified > 0 && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {unverified} document{unverified === 1 ? "" : "s"} awaiting verification.
        </div>
      )}

      <FilterBar
        filters={[
          {
            kind: "select",
            name: "student",
            label: "Student",
            placeholder: "All students",
            options: studentOptions.map((s) => ({ value: s.id, label: s.label })),
          },
          {
            kind: "select",
            name: "status",
            label: "Status",
            placeholder: "All",
            options: [
              { value: "unverified", label: "Unverified" },
              { value: "verified", label: "Verified" },
            ],
          },
        ]}
      />

      <DocumentsTable
        documents={rows}
        canVerify={can(ctx, "documents", "approve")}
        canDelete={can(ctx, "documents", "delete")}
      />
    </div>
  );
}
