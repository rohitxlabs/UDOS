"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { createModule, type CreateModuleState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { TextField, TextAreaField, FormError, SubmitButton } from "@/components/dashboard/form-field";

type ModuleOption = { key: string; name: string };

const initialState: CreateModuleState = {};

function CreateModuleFormFields({ modules, onDone }: { modules: ModuleOption[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createModule, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success("Module added to catalog");
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField id="name" label="Module name" placeholder="Hostel Management" required />
        <TextField id="key" label="Key" placeholder="hostel" required />
      </div>
      <TextAreaField id="description" label="Description (optional)" />
      {modules.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Depends on (optional)</span>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3">
            {modules.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="dependsOnKeys" value={m.key} className="rounded border-slate-300" />
                {m.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Add module
      </SubmitButton>
    </form>
  );
}

export function CreateModuleButton({ modules }: { modules: ModuleOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New module
      </button>
      {open && (
        <Modal title="Add module to catalog" onClose={() => setOpen(false)}>
          <CreateModuleFormFields modules={modules} onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
