"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { updateFaculty, resetFacultyPassword, type UpdateFacultyState } from "../actions";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

const initialState: UpdateFacultyState = {};

export type FacultyDetail = {
  id: string;
  name: string;
  username: string;
  employeeId: string;
  departmentId: string | null;
  designation: string | null;
  qualification: string | null;
  joiningDate: string | null;
  email: string | null;
  phone: string | null;
};

export function EditFacultyForm({
  faculty,
  departments,
}: {
  faculty: FacultyDetail;
  departments: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateFaculty, initialState);
  const [resetCreds, setResetCreds] = useState<{ password: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (state.success) toast.success("Faculty details saved");
  }, [state.success]);

  async function handleReset() {
    setResetting(true);
    try {
      const { password } = await resetFacultyPassword(faculty.id);
      setResetCreds({ password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={faculty.id} />

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span>
            Username: <span className="font-medium text-slate-900">{faculty.username}</span>
          </span>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Reset password
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="name" label="Full name" defaultValue={faculty.name} required />
          <TextField id="employeeId" label="Employee ID" defaultValue={faculty.employeeId} required />
        </div>

        <SelectField id="departmentId" label="Department" defaultValue={faculty.departmentId ?? ""}>
          <option value="">Not assigned</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="designation" label="Designation" defaultValue={faculty.designation ?? ""} />
          <TextField id="qualification" label="Qualification" defaultValue={faculty.qualification ?? ""} />
        </div>

        <TextField id="joiningDate" label="Joining date" type="date" defaultValue={faculty.joiningDate ?? ""} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="email" label="Email" type="email" defaultValue={faculty.email ?? ""} />
          <TextField id="phone" label="Phone" defaultValue={faculty.phone ?? ""} />
        </div>

        <FormError message={state.error} />

        <SubmitButton pending={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </SubmitButton>
      </form>

      {resetCreds && (
        <CredentialsDialog
          name={faculty.name}
          username={faculty.username}
          password={resetCreds.password}
          onClose={() => setResetCreds(null)}
        />
      )}
    </>
  );
}
