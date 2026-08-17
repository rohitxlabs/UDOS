"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { createCollege, type CreateCollegeState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";

type ModuleOption = { key: string; name: string; description: string | null };

const initialState: CreateCollegeState = {};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function CreateCollegeFormFields({ modules, onDone }: { modules: ModuleOption[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createCollege, initialState);
  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");

  if (state.success) {
    return (
      <CredentialsDialog
        name={state.success.collegeName}
        username={state.success.adminUsername}
        password={state.success.adminPassword}
        onClose={onDone}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="name"
          label="College name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
        <TextField
          id="slug"
          label="Slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          placeholder="abc-college"
        />
      </div>

      <TextField
        id="databaseUrl"
        label="Database connection string"
        required
        placeholder="postgresql://user:password@host/db?sslmode=require"
      />
      <p className="-mt-2.5 text-xs text-slate-500">
        A separate Postgres database (or the same server — we&apos;ll namespace it) for this college&apos;s own data.
        Encrypted at rest; never shown again after this.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="adminName" label="College Admin name" required />
        <TextField id="adminEmail" label="College Admin email (optional)" type="email" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Modules to enable</span>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-3">
          {modules.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="moduleKeys" value={m.key} className="rounded border-slate-300" />
              {m.name}
            </label>
          ))}
        </div>
      </div>

      <FormError message={state.error} />

      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create college
      </SubmitButton>
    </form>
  );
}

export function CreateCollegeButton({ modules }: { modules: ModuleOption[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        New college
      </button>
      {open && (
        <Modal title="Onboard a college" maxWidth="max-w-xl" onClose={() => setOpen(false)}>
          <CreateCollegeFormFields
            modules={modules}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
