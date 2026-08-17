"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveCollegeSettings, type SettingsState } from "./actions";

type College = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  attendanceMinPercent: string;
} | null;

const initialState: SettingsState = {};

function Field({
  id,
  label,
  defaultValue,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      />
    </div>
  );
}

export function SettingsForm({ college }: { college: College }) {
  const [state, formAction, pending] = useActionState(saveCollegeSettings, initialState);

  useEffect(() => {
    if (state.success) toast.success("College settings saved");
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {college && <input type="hidden" name="id" value={college.id} />}

      <Field id="name" label="College name" defaultValue={college?.name} required />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="phone" label="Phone" defaultValue={college?.phone} />
        <Field id="email" label="Email" type="email" defaultValue={college?.email} />
      </div>

      <Field id="website" label="Website" defaultValue={college?.website} />
      <Field id="address" label="Address" defaultValue={college?.address} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field id="city" label="City" defaultValue={college?.city} />
        <Field id="state" label="State" defaultValue={college?.state} />
        <Field id="pincode" label="PIN code" defaultValue={college?.pincode} />
      </div>

      <Field
        id="attendanceMinPercent"
        label="Minimum attendance %"
        type="number"
        defaultValue={college?.attendanceMinPercent ?? "75"}
        required
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex w-fit items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save settings
      </button>
    </form>
  );
}
