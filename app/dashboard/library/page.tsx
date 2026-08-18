import Link from "next/link";
import { Repeat } from "lucide-react";
import { requireCapability } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { CreateBookButton } from "./book-form";
import { BooksTable, type BookRow } from "./books-table";

export default async function LibraryPage({ searchParams }: PageProps<"/dashboard/library">) {
  const ctx = await requireCapability("library", "view");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const [books, students, onLoan, overdue] = await Promise.all([
    ctx.db.libraryBook.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { author: { contains: query, mode: "insensitive" } },
              { isbn: { contains: query, mode: "insensitive" } },
              { category: { contains: query, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { title: "asc" },
    }),
    ctx.db.student.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ rollNumber: "asc" }, { admissionNumber: "asc" }],
      include: { user: { select: { name: true } } },
    }),
    ctx.db.libraryTransaction.count({ where: { returnedAt: null } }),
    ctx.db.libraryTransaction.count({ where: { returnedAt: null, dueDate: { lt: new Date() } } }),
  ]);

  const rows: BookRow[] = books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    publisher: book.publisher,
    category: book.category,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
  }));

  const studentOptions = students.map((student) => ({
    id: student.id,
    label: `${student.rollNumber ?? student.admissionNumber} — ${student.user.name}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Library"
        description="Book catalogue and lending."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/library/circulation"
              className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Repeat className="h-4 w-4" />
              Circulation
            </Link>
            {can(ctx, "library", "create") && <CreateBookButton />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Titles</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{books.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">On loan</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{onLoan}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Overdue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overdue}</p>
        </div>
      </div>

      <form className="flex items-center gap-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by title, author, ISBN or category"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
        <button
          type="submit"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
      </form>

      <BooksTable
        books={rows}
        students={studentOptions}
        canIssue={can(ctx, "library", "create")}
        canEdit={can(ctx, "library", "edit")}
        canDelete={can(ctx, "library", "delete")}
      />
    </div>
  );
}
