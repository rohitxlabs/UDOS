"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createFaculty, type CreateFacultyState } from "../actions";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

const initialState: CreateFacultyState = {};

export function CreateFacultyForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createFaculty, initialState);
  const [advanced, setAdvanced] = useState(false);
  const router = useRouter();

  if (state.success) {
    return (
      <CredentialsDialog
        name={state.success.name}
        username={state.success.username}
        password={state.success.password}
        onClose={() => router.push("/dashboard/faculty")}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="name" label="Full name" required />
        <TextField id="employeeId" label="Employee ID" required />
      </div>

      <SelectField id="departmentId" label="Department" defaultValue="">
        <option value="">Not assigned yet</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="designation" label="Designation" placeholder="Assistant Professor" />
        <TextField id="qualification" label="Qualification" placeholder="M.Tech, Ph.D" />
      </div>

      <TextField id="joiningDate" label="Joining date" type="date" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="email" label="Email (optional)" type="email" />
        <TextField id="phone" label="Phone (optional)" />
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="self-start text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        {advanced ? "Hide" : "Set"} custom username / password
      </button>

      {advanced && (
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
          <TextField id="customUsername" label="Username" />
          <TextField id="customPassword" label="Password" />
        </div>
      )}

      <FormError message={state.error} />

      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create faculty account
      </SubmitButton>
    </form>
  );
}
