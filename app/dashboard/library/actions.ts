"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const bookSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Title is required"),
    author: z.string().trim().optional(),
    isbn: z.string().trim().optional(),
    publisher: z.string().trim().optional(),
    category: z.string().trim().optional(),
    totalCopies: z.coerce.number().int().min(1).max(10_000),
  })
  .refine((d) => d.totalCopies >= 1, { message: "A book needs at least one copy", path: ["totalCopies"] });

export type BookState = { error?: string; success?: boolean };

export async function saveBook(_prev: BookState, formData: FormData): Promise<BookState> {
  const ctx = await requireCapability("library", formData.get("id") ? "edit" : "create");

  const parsed = bookSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    author: formData.get("author") || undefined,
    isbn: formData.get("isbn") || undefined,
    publisher: formData.get("publisher") || undefined,
    category: formData.get("category") || undefined,
    totalCopies: formData.get("totalCopies"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, title, author, isbn, publisher, category, totalCopies } = parsed.data;

  const data = {
    title,
    author: author || null,
    isbn: isbn || null,
    publisher: publisher || null,
    category: category || null,
  };

  try {
    if (id) {
      const existing = await ctx.db.libraryBook.findUnique({ where: { id } });
      if (!existing) return { error: "Book not found" };

      // Available copies move with the stock count rather than being set
      // directly: the difference between total and available is the number
      // currently on loan, and that must not change here.
      const onLoan = existing.totalCopies - existing.availableCopies;
      if (totalCopies < onLoan) {
        return { error: `${onLoan} cop${onLoan === 1 ? "y is" : "ies are"} on loan — stock cannot go below that` };
      }
      await ctx.db.libraryBook.update({
        where: { id },
        data: { ...data, totalCopies, availableCopies: totalCopies - onLoan },
      });
    } else {
      await ctx.db.libraryBook.create({ data: { ...data, totalCopies, availableCopies: totalCopies } });
    }
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: `A book with ISBN "${isbn}" already exists` };
    }
    throw err;
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: id ? "LIBRARY_BOOK_UPDATED" : "LIBRARY_BOOK_ADDED",
    module: "library",
    recordId: id,
    newValue: { title, isbn, totalCopies },
  });

  revalidatePath("/dashboard/library");
  return { success: true };
}

export async function deleteBook(id: string) {
  const ctx = await requireCapability("library", "delete");

  const onLoan = await ctx.db.libraryTransaction.count({ where: { bookId: id, returnedAt: null } });
  if (onLoan > 0) throw new Error("This book still has copies on loan.");

  try {
    await ctx.db.libraryBook.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "book"));
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "LIBRARY_BOOK_REMOVED",
    module: "library",
    recordId: id,
  });

  revalidatePath("/dashboard/library");
}

const issueSchema = z.object({
  bookId: z.string().min(1, "Book is required"),
  studentId: z.string().min(1, "Student is required"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
});

// Issuing decrements stock in the same transaction that creates the loan,
// so two librarians issuing the last copy at once cannot both succeed.
export async function issueBook(input: {
  bookId: string;
  studentId: string;
  dueDate: string;
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("library", "create");

  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { bookId, studentId, dueDate } = parsed.data;

  const alreadyHolding = await ctx.db.libraryTransaction.findFirst({
    where: { bookId, studentId, returnedAt: null },
    select: { id: true },
  });
  if (alreadyHolding) return { error: "This student already has a copy of this book on loan" };

  try {
    await ctx.db.$transaction(async (tx) => {
      const claimed = await tx.libraryBook.updateMany({
        where: { id: bookId, availableCopies: { gt: 0 } },
        data: { availableCopies: { decrement: 1 } },
      });
      if (claimed.count === 0) throw new Error("NO_COPIES");

      await tx.libraryTransaction.create({
        data: { bookId, studentId, dueDate: new Date(`${dueDate}T00:00:00.000Z`) },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_COPIES") return { error: "No copies are available to issue" };
    throw err;
  }

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "LIBRARY_BOOK_ISSUED",
    module: "library",
    recordId: bookId,
    newValue: { studentId, dueDate },
  });

  revalidatePath("/dashboard/library");
  revalidatePath("/dashboard/library/circulation");
  return { success: true };
}

export async function returnBook(
  transactionId: string,
  fine?: number
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("library", "edit");

  const parsed = z.object({ fine: z.coerce.number().min(0).max(1_000_000).optional() }).safeParse({ fine });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid fine" };

  const loan = await ctx.db.libraryTransaction.findUnique({ where: { id: transactionId } });
  if (!loan) return { error: "Loan not found" };
  if (loan.returnedAt) return { error: "This copy has already been returned" };

  await ctx.db.$transaction([
    ctx.db.libraryTransaction.update({
      where: { id: transactionId },
      data: {
        returnedAt: new Date(),
        fine: parsed.data.fine === undefined ? null : parsed.data.fine.toFixed(2),
      },
    }),
    ctx.db.libraryBook.update({
      where: { id: loan.bookId },
      data: { availableCopies: { increment: 1 } },
    }),
  ]);

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "LIBRARY_BOOK_RETURNED",
    module: "library",
    recordId: transactionId,
    newValue: { bookId: loan.bookId, fine: parsed.data.fine ?? 0 },
  });

  revalidatePath("/dashboard/library");
  revalidatePath("/dashboard/library/circulation");
  return { success: true };
}
