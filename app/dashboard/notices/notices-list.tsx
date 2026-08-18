"use client";

import { Trash2, Paperclip } from "lucide-react";
import { deleteNotice } from "./actions";
import { EditNoticeButton, type NoticeTarget, type Targets } from "./notice-form";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { Badge } from "@/components/dashboard/page-header";

export type NoticeRow = NoticeTarget & {
  audienceLabel: string;
  publishLabel: string;
  expiryLabel: string | null;
  authorName: string;
  state: "Scheduled" | "Active" | "Expired";
};

const STATE_TONES = { Scheduled: "blue", Active: "green", Expired: "slate" } as const;

export function NoticesList({
  notices,
  targets,
  canEdit,
  canDelete,
}: {
  notices: NoticeRow[];
  targets: Targets;
  canEdit: boolean;
  canDelete: boolean;
}) {
  if (notices.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No notices published yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notices.map((notice) => (
        <div key={notice.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{notice.title}</h2>
                <Badge tone={STATE_TONES[notice.state]}>{notice.state}</Badge>
                <Badge tone="violet">{notice.audienceLabel}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{notice.description}</p>
              <p className="mt-3 text-xs text-slate-400">
                Published {notice.publishLabel}
                {notice.expiryLabel ? ` · expires ${notice.expiryLabel}` : ""} · by {notice.authorName}
              </p>
              {notice.attachmentUrl && (
                <a
                  href={notice.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Attachment
                </a>
              )}
            </div>

            <div className="flex gap-1">
              {canEdit && <EditNoticeButton targets={targets} target={notice} />}
              {canDelete && (
                <ConfirmButton
                  title={`Delete "${notice.title}"?`}
                  description="The notice is removed for everyone it was addressed to."
                  onConfirm={() => deleteNotice(notice.id)}
                  successMessage="Notice deleted"
                  trigger={
                    <button title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
