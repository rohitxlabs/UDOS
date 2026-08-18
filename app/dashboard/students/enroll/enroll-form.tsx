"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, CornerDownRight } from "lucide-react";
import { enrollStudent, type EnrollState } from "../enroll-actions";
import { TextField, SelectField, FormError } from "@/components/dashboard/form-field";
import { CredentialsDialog } from "@/components/dashboard/credentials-dialog";

export type Option = { id: string; label: string; parentId?: string };
export type EnrollOptions = {
  academicYears: Option[];
  departments: Option[];
  courses: Option[];
  semesters: Option[];
  sections: Option[];
  roles: Option[];
};

const NEW = "__new__";

// One row per level of the hierarchy: choose an existing record, or switch
// to "Create new" and fill it in without leaving the page. Lower levels only
// offer records that sit under the choice above them, which is what keeps
// the resulting chain coherent before it ever reaches the server.
function Level({
  label,
  value,
  onChange,
  options,
  disabled,
  disabledHint,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled?: boolean;
  disabledHint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <SelectField id={label} label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="" disabled>
          {disabled ? (disabledHint ?? "Choose the level above first") : `Select ${label.toLowerCase()}`}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        <option value={NEW}>+ Create new…</option>
      </SelectField>
      {value === NEW && (
        <div className="mt-3 flex gap-2 border-l-2 border-blue-200 pl-3">
          <CornerDownRight className="mt-2 h-4 w-4 shrink-0 text-blue-400" />
          <div className="flex-1 space-y-3">{children}</div>
        </div>
      )}
    </div>
  );
}

export function EnrollForm({ options }: { options: EnrollOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<EnrollState>({});

  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [semId, setSemId] = useState("");
  const [secId, setSecId] = useState("");

  const [f, setF] = useState<Record<string, string>>({
    yearName: "", yearStart: "", yearEnd: "",
    deptName: "", deptCode: "",
    courseName: "", courseCode: "", courseDuration: "8",
    semNumber: "1",
    sectionName: "A",
    name: "", admissionNumber: "", rollNumber: "", email: "", phone: "",
    roleId: "", username: "", password: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Only offer records that actually descend from the chosen parent.
  const courses = courseId === NEW ? [] : options.courses.filter((c) => !deptId || deptId === NEW || c.parentId === deptId);
  const semesters = options.semesters.filter((s) => courseId && courseId !== NEW && s.parentId === courseId);
  const sections = options.sections.filter((s) => semId && semId !== NEW && s.parentId === semId);

  const levelInput = (id: string, create: object) => (id === NEW ? { create } : { id });

  function submit() {
    setState({});
    startTransition(async () => {
      const result = await enrollStudent({
        chain: {
          academicYear: levelInput(yearId, { name: f.yearName, startDate: f.yearStart, endDate: f.yearEnd }),
          department: levelInput(deptId, { name: f.deptName, code: f.deptCode }),
          course: levelInput(courseId, {
            name: f.courseName,
            code: f.courseCode,
            durationSemesters: Number(f.courseDuration) || 8,
          }),
          semester: levelInput(semId, { number: Number(f.semNumber) || 1 }),
          section: levelInput(secId, { name: f.sectionName }),
        },
        student: {
          name: f.name,
          admissionNumber: f.admissionNumber,
          rollNumber: f.rollNumber,
          email: f.email,
          phone: f.phone,
          roleId: f.roleId,
          customUsername: f.username,
          customPassword: f.password,
        },
      } as Parameters<typeof enrollStudent>[0]);
      setState(result);
    });
  }

  if (state.success) {
    const s = state.success;
    return (
      <>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">{s.name} is enrolled</p>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-emerald-900">
            {s.chainCreated.length > 0 && (
              <li>Created along the way: {s.chainCreated.join(", ")}</li>
            )}
            <li>Attached {s.attached.assignments} assignment(s) already set for the section</li>
            <li>Registered for {s.attached.exams} scheduled examination(s)</li>
            <li>Billed {s.attached.fees} applicable fee structure(s)</li>
          </ul>
        </div>
        <CredentialsDialog
          name={s.name}
          username={s.username}
          password={s.password}
          onClose={() => router.push("/dashboard/students")}
        />
      </>
    );
  }

  const ready = f.name && f.admissionNumber && f.roleId && yearId && deptId && courseId && semId && secId;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Academic placement</h2>
        <p className="-mt-2 text-xs text-slate-500">
          Each level must exist before the one below it. Anything missing can be created right here — it is all saved
          together, so a half-built structure never reaches the database.
        </p>

        <Level label="Academic year" value={yearId} onChange={setYearId} options={options.academicYears}>
          <TextField id="yearName" label="Name" placeholder="2026-27" value={f.yearName} onChange={(e) => set("yearName", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="yearStart" label="Starts" type="date" value={f.yearStart} onChange={(e) => set("yearStart", e.target.value)} />
            <TextField id="yearEnd" label="Ends" type="date" value={f.yearEnd} onChange={(e) => set("yearEnd", e.target.value)} />
          </div>
        </Level>

        <Level label="Department" value={deptId} onChange={(v) => { setDeptId(v); setCourseId(""); setSemId(""); setSecId(""); }} options={options.departments}>
          <TextField id="deptName" label="Name" placeholder="Computer Science" value={f.deptName} onChange={(e) => set("deptName", e.target.value)} />
          <TextField id="deptCode" label="Code" placeholder="CSE" value={f.deptCode} onChange={(e) => set("deptCode", e.target.value)} />
        </Level>

        <Level
          label="Course"
          value={courseId}
          onChange={(v) => { setCourseId(v); setSemId(""); setSecId(""); }}
          options={courses}
          disabled={!deptId}
          disabledHint="Choose a department first"
        >
          <TextField id="courseName" label="Name" placeholder="B.Tech CSE" value={f.courseName} onChange={(e) => set("courseName", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="courseCode" label="Code" placeholder="BTCSE" value={f.courseCode} onChange={(e) => set("courseCode", e.target.value)} />
            <TextField id="courseDuration" label="Total semesters" type="number" min={1} max={20} value={f.courseDuration} onChange={(e) => set("courseDuration", e.target.value)} />
          </div>
        </Level>

        <Level
          label="Semester"
          value={semId}
          onChange={(v) => { setSemId(v); setSecId(""); }}
          options={semesters}
          disabled={!courseId}
          disabledHint="Choose a course first"
        >
          <TextField id="semNumber" label="Semester number" type="number" min={1} max={20} value={f.semNumber} onChange={(e) => set("semNumber", e.target.value)} />
        </Level>

        <Level
          label="Section"
          value={secId}
          onChange={setSecId}
          options={sections}
          disabled={!semId}
          disabledHint="Choose a semester first"
        >
          <TextField id="sectionName" label="Section name" placeholder="A" value={f.sectionName} onChange={(e) => set("sectionName", e.target.value)} />
        </Level>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Student</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="name" label="Full name" value={f.name} onChange={(e) => set("name", e.target.value)} required />
          <TextField id="admissionNumber" label="Admission number" value={f.admissionNumber} onChange={(e) => set("admissionNumber", e.target.value)} required />
          <TextField id="rollNumber" label="Roll number (optional)" value={f.rollNumber} onChange={(e) => set("rollNumber", e.target.value)} />
          <SelectField id="roleId" label="Role" value={f.roleId} onChange={(e) => set("roleId", e.target.value)} required>
            <option value="" disabled>Select role</option>
            {options.roles.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </SelectField>
          <TextField id="email" label="Email (optional)" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          <TextField id="phone" label="Phone (optional)" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          <TextField id="username" label="Login ID (optional)" value={f.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" />
          <TextField id="password" label="Password (optional)" value={f.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" placeholder="Min 8 characters" />
        </div>
      </div>

      <FormError message={state.error} />

      <button
        onClick={submit}
        disabled={pending || !ready}
        className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enrol student
      </button>
    </div>
  );
}
