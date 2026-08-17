"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { updateStudent, resetStudentPassword, type UpdateStudentState } from "../actions";
import { SectionPicker, type CourseTree } from "../section-picker";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";
import { TextField, SelectField, FormError, SubmitButton } from "@/components/dashboard/form-field";

const initialState: UpdateStudentState = {};

export type StudentDetail = {
  id: string;
  name: string;
  username: string;
  admissionNumber: string;
  enrollmentNumber: string | null;
  rollNumber: string | null;
  sectionId: string;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  category: string | null;
  admissionDate: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

export function EditStudentForm({ student, courses }: { student: StudentDetail; courses: CourseTree[] }) {
  const [state, formAction, pending] = useActionState(updateStudent, initialState);
  const [resetCreds, setResetCreds] = useState<{ password: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (state.success) toast.success("Student details saved");
  }, [state.success]);

  async function handleReset() {
    setResetting(true);
    try {
      const { password } = await resetStudentPassword(student.id);
      setResetCreds({ password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={student.id} />

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span>
            Username: <span className="font-medium text-slate-900">{student.username}</span>
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

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-slate-900">Enrollment</h2>
          <SectionPicker courses={courses} defaultSectionId={student.sectionId} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField id="admissionNumber" label="Admission number" defaultValue={student.admissionNumber} required />
            <TextField id="enrollmentNumber" label="Enrollment number" defaultValue={student.enrollmentNumber ?? ""} />
            <TextField id="rollNumber" label="Roll number" defaultValue={student.rollNumber ?? ""} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField id="admissionDate" label="Admission date" type="date" defaultValue={student.admissionDate ?? ""} />
            <SelectField id="status" label="Status" defaultValue={student.status} required>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </SelectField>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-slate-100 pt-6">
          <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
          <TextField id="name" label="Full name" defaultValue={student.name} required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField id="dob" label="Date of birth" type="date" defaultValue={student.dob ?? ""} />
            <SelectField id="gender" label="Gender" defaultValue={student.gender ?? ""}>
              <option value="">Not specified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </SelectField>
            <TextField id="bloodGroup" label="Blood group" defaultValue={student.bloodGroup ?? ""} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField id="fatherName" label="Father's name" defaultValue={student.fatherName ?? ""} />
            <TextField id="motherName" label="Mother's name" defaultValue={student.motherName ?? ""} />
            <TextField id="guardianName" label="Guardian's name" defaultValue={student.guardianName ?? ""} />
          </div>
          <TextField id="category" label="Category" defaultValue={student.category ?? ""} />
        </section>

        <section className="flex flex-col gap-4 border-t border-slate-100 pt-6">
          <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField id="email" label="Email" type="email" defaultValue={student.email ?? ""} />
            <TextField id="phone" label="Phone" defaultValue={student.phone ?? ""} />
          </div>
          <TextField id="address" label="Address" defaultValue={student.address ?? ""} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField id="city" label="City" defaultValue={student.city ?? ""} />
            <TextField id="state" label="State" defaultValue={student.state ?? ""} />
            <TextField id="pincode" label="PIN code" defaultValue={student.pincode ?? ""} />
          </div>
        </section>

        <FormError message={state.error} />

        <SubmitButton pending={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </SubmitButton>
      </form>

      {resetCreds && (
        <CredentialsDialog
          name={student.name}
          username={student.username}
          password={resetCreds.password}
          onClose={() => setResetCreds(null)}
        />
      )}
    </>
  );
}
