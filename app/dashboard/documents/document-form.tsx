"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { saveDocument, type DocumentState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

export type StudentOption = { id: string; label: string };

// Documents Indian colleges usually collect at admission; free text is
// still accepted so a college can record anything else it needs.
const TYPES = [
  "10th Marksheet",
  "12th Marksheet",
  "Transfer Certificate",
  "Migration Certificate",
  "Character Certificate",
  "Caste Certificate",
  "Income Certificate",
  "Aadhaar",
  "Photograph",
  "Other",
];

const initialState: DocumentState = {};

function DocumentFields({ students, onDone }: { students: StudentOption[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveDocument, initialState);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <SelectField id="studentId" label="Student" defaultValue="" required>
        <option value="" disabled>
          Select student
        </option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.label}
          </option>
        ))}
      </SelectField>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="type" className="text-sm font-medium text-slate-700">
          Document type
        </label>
        <input
          id="type"
          name="type"
          list="document-types"
          placeholder="10th Marksheet"
          required
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
        <datalist id="document-types">
          {TYPES.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </div>

      <TextField id="fileUrl" label="Document link" type="url" placeholder="https://…" required />

      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Attach document
      </SubmitButton>
    </form>
  );
}

export function AttachDocumentButton({ students }: { students: StudentOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Attach document
      </button>
      {open && (
        <Modal title="Attach document" onClose={() => setOpen(false)}>
          <DocumentFields students={students} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
