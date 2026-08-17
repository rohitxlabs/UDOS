"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  title,
  description,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl`}>
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
