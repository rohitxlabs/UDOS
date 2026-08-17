"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createStudent, type CreateStudentState } from "../actions";
import { SectionPicker, type CourseTree } from "../section-picker";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

const initialState: CreateStudentState = {};

export function CreateStudentForm({
  courses,
  roles,
}: {
  courses: CourseTree[];
  roles: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createStudent, initialState);
  const [advanced, setAdvanced] = useState(false);
  const router = useRouter();

  if (state.success) {
    return (
      <CredentialsDialog
        name={state.success.name}
        username={state.success.username}
        password={state.success.password}
        onClose={() => router.push("/dashboard/students")}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-900">Enrollment</h2>
        <SectionPicker courses={courses} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField id="admissionNumber" label="Admission number" required />
          <TextField id="enrollmentNumber" label="Enrollment number (optional)" />
          <TextField id="rollNumber" label="Roll number (optional)" />
        </div>
        <TextField id="admissionDate" label="Admission date" type="date" />
        <SelectField id="roleId" label="Role" defaultValue="" required>
          <option value="" disabled>
            Select a role
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
      </section>

      <section className="flex flex-col gap-4 border-t border-slate-100 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
        <TextField id="name" label="Full name" required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField id="dob" label="Date of birth" type="date" />
          <SelectField id="gender" label="Gender" defaultValue="">
            <option value="">Not specified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </SelectField>
          <TextField id="bloodGroup" label="Blood group" placeholder="O+" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField id="fatherName" label="Father's name" />
          <TextField id="motherName" label="Mother's name" />
          <TextField id="guardianName" label="Guardian's name" />
        </div>
        <TextField id="category" label="Category" placeholder="General / OBC / SC / ST / EWS" />
      </section>

      <section className="flex flex-col gap-4 border-t border-slate-100 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="email" label="Email (optional)" type="email" />
          <TextField id="phone" label="Phone" />
        </div>
        <TextField id="address" label="Address" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField id="city" label="City" />
          <TextField id="state" label="State" />
          <TextField id="pincode" label="PIN code" />
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-100 pt-6">
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
      </section>

      <FormError message={state.error} />

      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create student account
      </SubmitButton>
    </form>
  );
}
