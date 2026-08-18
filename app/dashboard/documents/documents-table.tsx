"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Check, X, Loader2, ExternalLink } from "lucide-react";
import { deleteDocument, setDocumentVerified } from "./actions";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { Badge } from "@/components/dashboard/page-header";

export type DocumentRow = {
  id: string;
  studentName: string;
  roll: string;
  type: string;
  fileUrl: string;
  verified: boolean;
  uploadedLabel: string;
};

function VerifyToggle({ row }: { row: DocumentRow }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setDocumentVerified(row.id, !row.verified);
      if (result.error) toast.error(result.error);
      else toast.success(row.verified ? "Marked unverified" : "Document verified");
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={row.verified ? "Mark unverified" : "Verify"}
      className={`rounded-md p-1.5 text-slate-400 disabled:opacity-50 ${
        row.verified ? "hover:bg-amber-50 hover:text-amber-600" : "hover:bg-emerald-50 hover:text-emerald-600"
      }`}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : row.verified ? (
        <X className="h-4 w-4" />
      ) : (
        <Check className="h-4 w-4" />
      )}
    </button>
  );
}

export function DocumentsTable({
  documents,
  canVerify,
  canDelete,
}: {
  documents: DocumentRow[];
  canVerify: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Document</th>
            <th className="px-4 py-3 font-medium">Uploaded</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No documents on file.
              </td>
            </tr>
          )}
          {documents.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{row.studentName}</p>
                <p className="text-xs text-slate-500">{row.roll}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{row.type}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.uploadedLabel}</td>
              <td className="px-4 py-3">
                {row.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Unverified</Badge>}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <a
                    href={row.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open document"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {canVerify && <VerifyToggle row={row} />}
                  {canDelete && (
                    <ConfirmButton
                      title={`Delete ${row.type}?`}
                      description={`This removes the document from ${row.studentName}'s file.`}
                      onConfirm={() => deleteDocument(row.id)}
                      successMessage="Document deleted"
                      trigger={
                        <button title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      }
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
