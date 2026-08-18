"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { createCollege, type CreateCollegeState } from "./actions";
import { Modal } from "@/components/dashboard/modal";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";
import { moduleWithPrerequisites, moduleWithDependents, MODULE_DEPENDENCIES, type Module } from "@/lib/permissions";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const available = new Set(modules.map((m) => m.key));
  const labelOf = (key: string) => modules.find((m) => m.key === key)?.name ?? key;

  // Same closure the server applies when a module is toggled on a live
  // college, so onboarding and later changes behave identically: ticking
  // pulls in prerequisites, unticking releases dependents.
  function toggleModule(key: string, next: boolean) {
    const group = (next ? moduleWithPrerequisites(key as Module) : moduleWithDependents(key as Module)).filter((k) =>
      available.has(k)
    );
    setSelected((prev) => {
      const out = new Set(prev);
      for (const k of group) {
        if (next) out.add(k);
        else out.delete(k);
      }
      return out;
    });
  }

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

      <TextField id="email" label="College email (optional)" type="email" placeholder="office@abccollege.edu" />

      <TextField
        id="databaseUrl"
        label="Database connection string"
        required
        placeholder="postgresql://user:password@host/db?sslmode=require"
      />
      <p className="-mt-2.5 text-xs text-slate-500">
        A separate Postgres database (or the same server — we&apos;ll namespace it) for this college&apos;s own data.
        Every ERP table is created here automatically. Encrypted at rest; never shown again after this.
      </p>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-3">
        <span className="text-sm font-medium text-slate-700">College Admin account</span>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="adminName" label="Name" required />
          <TextField id="adminEmail" label="Email (optional)" type="email" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="adminUsername" label="Login ID (optional)" placeholder="abc.admin" autoComplete="off" />
          <TextField
            id="adminPassword"
            label="Password (optional)"
            type="text"
            placeholder="Min 8 characters"
            autoComplete="new-password"
          />
        </div>

        <p className="-mt-1 text-xs text-slate-500">
          Leave either blank and one is generated for you. Whatever ends up being used is shown once on the next
          screen — the College Admin is asked to change the password at first sign-in.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Modules to enable</span>
        <p className="text-xs text-slate-500">
          Ticking a module also ticks whatever it needs to work; unticking one releases whatever depends on it.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-3">
          {modules.map((m) => (
            <label key={m.key} className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="moduleKeys"
                value={m.key}
                checked={selected.has(m.key)}
                onChange={(e) => toggleModule(m.key, e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span className="min-w-0">
                <span className="block">{m.name}</span>
                {(MODULE_DEPENDENCIES[m.key as Module] ?? []).length > 0 && (
                  <span className="block text-[11px] leading-tight text-slate-400">
                    needs {(MODULE_DEPENDENCIES[m.key as Module] ?? []).map(labelOf).join(", ")}
                  </span>
                )}
              </span>
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
