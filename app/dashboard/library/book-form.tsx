"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { saveBook, type BookState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type BookTarget = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  category: string | null;
  totalCopies: number;
};

const initialState: BookState = {};

function BookFields({ target, onDone }: { target?: BookTarget; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveBook, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {target && <input type="hidden" name="id" value={target.id} />}
      <TextField id="title" label="Title" placeholder="Introduction to Algorithms" defaultValue={target?.title} required />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="author" label="Author" defaultValue={target?.author ?? ""} />
        <TextField id="publisher" label="Publisher" defaultValue={target?.publisher ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField id="isbn" label="ISBN" placeholder="978-…" defaultValue={target?.isbn ?? ""} />
        <TextField id="category" label="Category" placeholder="Computer Science" defaultValue={target?.category ?? ""} />
      </div>
      <TextField
        id="totalCopies"
        label="Total copies"
        type="number"
        min={1}
        max={10000}
        defaultValue={target?.totalCopies ?? 1}
        required
      />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {target ? "Save changes" : "Add book"}
      </SubmitButton>
    </form>
  );
}

export function CreateBookButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Add book
      </button>
      {open && (
        <Modal title="Add book" onClose={() => setOpen(false)}>
          <BookFields onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

export function EditBookButton({ target }: { target: BookTarget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit"
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {open && (
        <Modal title="Edit book" onClose={() => setOpen(false)}>
          <BookFields target={target} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
