import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-400";

export function TextField({
  id,
  label,
  ...props
}: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={id} name={id} className={inputClass} {...props} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  children,
  ...props
}: { id: string; label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={id} name={id} className={inputClass} {...props}>
        {children}
      </select>
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea id={id} name={id} className={inputClass} rows={3} {...props} />
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
