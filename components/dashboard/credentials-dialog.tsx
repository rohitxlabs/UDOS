"use client";

import { useState } from "react";
import { Copy, Check, X } from "lucide-react";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <code className="text-sm font-medium text-slate-900">{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function CredentialsDialog({
  name,
  username,
  password,
  onClose,
}: {
  name: string;
  username: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-slate-900">Credentials for {name}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Share these with the user securely. The password will not be shown again.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <CopyField label="Username" value={username} />
          <CopyField label="Password" value={password} />
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}
