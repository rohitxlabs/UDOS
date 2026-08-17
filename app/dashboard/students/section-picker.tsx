"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/dashboard/form-field";

export type CourseTree = {
  id: string;
  name: string;
  semesters: { id: string; label: string; sections: { id: string; name: string }[] }[];
};

function findLocation(courses: CourseTree[], sectionId?: string) {
  if (!sectionId) return { courseId: "", semesterId: "" };
  for (const course of courses) {
    for (const semester of course.semesters) {
      if (semester.sections.some((sec) => sec.id === sectionId)) {
        return { courseId: course.id, semesterId: semester.id };
      }
    }
  }
  return { courseId: "", semesterId: "" };
}

export function SectionPicker({ courses, defaultSectionId }: { courses: CourseTree[]; defaultSectionId?: string }) {
  const initial = useMemo(() => findLocation(courses, defaultSectionId), [courses, defaultSectionId]);
  const [courseId, setCourseId] = useState(initial.courseId);
  const [semesterId, setSemesterId] = useState(initial.semesterId);

  const course = courses.find((c) => c.id === courseId);
  const semester = course?.semesters.find((s) => s.id === semesterId);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <SelectField
        id="courseId"
        label="Course"
        value={courseId}
        onChange={(e) => {
          setCourseId(e.target.value);
          setSemesterId("");
        }}
      >
        <option value="">Select course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="semesterPicker"
        label="Semester"
        value={semesterId}
        onChange={(e) => setSemesterId(e.target.value)}
        disabled={!course}
      >
        <option value="">Select semester</option>
        {course?.semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectField>
      <SelectField id="sectionId" label="Section" defaultValue={defaultSectionId ?? ""} key={semesterId} disabled={!semester} required>
        <option value="">Select section</option>
        {semester?.sections.map((sec) => (
          <option key={sec.id} value={sec.id}>
            {sec.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
