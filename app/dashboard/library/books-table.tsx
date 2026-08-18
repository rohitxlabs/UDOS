"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, BookUp, Loader2 } from "lucide-react";
import { deleteBook, issueBook } from "./actions";
import { EditBookButton, type BookTarget } from "./book-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { Modal } from "@/components/dashboard/modal";
import { Badge } from "@/components/dashboard/page-header";
import { TextField, SelectField, FormError } from "@/components/dashboard/form-field";

export type BookRow = BookTarget & { availableCopies: number };
export type StudentOption = { id: string; label: string };

function IssueDialog({
  book,
  students,
  onClose,
}: {
  book: BookRow;
  students: StudentOption[];
  onClose: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  // A two-week loan is the common default; the librarian can change it.
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function handleIssue() {
    setError(undefined);
    startTransition(async () => {
      const result = await issueBook({ bookId: book.id, studentId, dueDate });
      if (result.error) setError(result.error);
      else {
        toast.success(`Issued "${book.title}"`);
        onClose();
      }
    });
  }

  return (
    <Modal
      title={`Issue "${book.title}"`}
      description={`${book.availableCopies} of ${book.totalCopies} copies available.`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <SelectField id="studentId" label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
          <option value="" disabled>
            Select student
          </option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.label}
            </option>
          ))}
        </SelectField>
        <TextField id="dueDate" label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        <FormError message={error} />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleIssue}
            disabled={pending || !studentId}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Issue book
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function BooksTable({
  books,
  students,
  canIssue,
  canEdit,
  canDelete,
}: {
  books: BookRow[];
  students: StudentOption[];
  canIssue: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [issuing, setIssuing] = useState<BookRow | null>(null);

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Author</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">ISBN</th>
            <th className="px-4 py-3 font-medium">Availability</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {books.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No books in the catalogue yet.
              </td>
            </tr>
          )}
          {books.map((book) => (
            <tr key={book.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{book.title}</td>
              <td className="px-4 py-3 text-slate-600">{book.author ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{book.category ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{book.isbn ?? "—"}</td>
              <td className="px-4 py-3">
                {book.availableCopies > 0 ? (
                  <Badge tone="green">
                    {book.availableCopies} of {book.totalCopies} available
                  </Badge>
                ) : (
                  <Badge tone="red">All {book.totalCopies} on loan</Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {canIssue && book.availableCopies > 0 && students.length > 0 && (
                    <button
                      onClick={() => setIssuing(book)}
                      title="Issue"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <BookUp className="h-4 w-4" />
                    </button>
                  )}
                  {canEdit && <EditBookButton target={book} />}
                  {canDelete && (
                    <ConfirmButton
                      title={`Remove "${book.title}"?`}
                      description="The book is removed from the catalogue along with its loan history."
                      onConfirm={() => deleteBook(book.id)}
                      successMessage="Book removed"
                      trigger={
                        <button title="Remove" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      }
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {issuing && <IssueDialog book={issuing} students={students} onClose={() => setIssuing(null)} />}
    </div>
  );
}
