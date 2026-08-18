"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

export type FilterOption = { value: string; label: string };

type SelectFilter = {
  kind: "select";
  name: string;
  label: string;
  placeholder?: string;
  options: FilterOption[];
  // Params that stop making sense once this one changes (e.g. picking a
  // different section invalidates the chosen subject).
  resets?: string[];
};
type DateFilter = { kind: "date"; name: string; label: string };

export type Filter = SelectFilter | DateFilter;

// Shared query-string filter row. Filters live in the URL rather than in
// component state so every module's page stays a server component that can
// read its own filters straight from searchParams.
export function FilterBar({ filters }: { filters: Filter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(name: string, value: string, resets: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    for (const key of resets) params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  const inputClass =
    "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      {filters.map((filter) => (
        <div key={filter.name} className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label htmlFor={filter.name} className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {filter.label}
          </label>
          {filter.kind === "select" ? (
            <select
              id={filter.name}
              className={inputClass}
              value={searchParams.get(filter.name) ?? ""}
              onChange={(e) => update(filter.name, e.target.value, filter.resets)}
            >
              <option value="">{filter.placeholder ?? "All"}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={filter.name}
              type="date"
              className={inputClass}
              value={searchParams.get(filter.name) ?? ""}
              onChange={(e) => update(filter.name, e.target.value)}
            />
          )}
        </div>
      ))}
      {pending && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-slate-400" />}
    </div>
  );
}
