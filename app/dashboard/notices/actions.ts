"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeTenantAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const AUDIENCES = [
  "ALL",
  "STUDENTS",
  "TEACHERS",
  "ACCOUNTS",
  "MANAGEMENT",
  "DEPARTMENT",
  "COURSE",
  "SEMESTER",
  "SECTION",
] as const;

const schema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Title is required"),
    description: z.string().trim().min(2, "Description is required"),
    attachmentUrl: z.string().trim().url("Attachment must be a valid URL").optional().or(z.literal("")),
    publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Publish date is required"),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    audience: z.enum(AUDIENCES),
    targetId: z.string().optional(),
  })
  .refine((d) => !d.expiryDate || d.expiryDate >= d.publishDate, {
    message: "Expiry cannot be before the publish date",
    path: ["expiryDate"],
  })
  // The scoped audiences are meaningless without something to scope to.
  .refine((d) => !["DEPARTMENT", "COURSE", "SEMESTER", "SECTION"].includes(d.audience) || !!d.targetId, {
    message: "Choose which department, course, semester or section this notice is for",
    path: ["targetId"],
  });

export type NoticeState = { error?: string; success?: boolean };

export async function saveNotice(_prev: NoticeState, formData: FormData): Promise<NoticeState> {
  const ctx = await requireCapability("notices", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    description: formData.get("description"),
    attachmentUrl: formData.get("attachmentUrl") || "",
    publishDate: formData.get("publishDate"),
    expiryDate: formData.get("expiryDate") || "",
    audience: formData.get("audience"),
    targetId: formData.get("targetId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, title, description, attachmentUrl, publishDate, expiryDate, audience, targetId } = parsed.data;

  // One target column is populated according to the audience; the rest are
  // cleared so a notice re-targeted from one scope to another does not keep
  // a stale pointer from its previous audience.
  const data = {
    title,
    description,
    attachmentUrl: attachmentUrl || null,
    publishDate: new Date(`${publishDate}T00:00:00.000Z`),
    expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`) : null,
    audience,
    departmentId: audience === "DEPARTMENT" ? (targetId ?? null) : null,
    courseId: audience === "COURSE" ? (targetId ?? null) : null,
    semesterId: audience === "SEMESTER" ? (targetId ?? null) : null,
    sectionId: audience === "SECTION" ? (targetId ?? null) : null,
  };

  const notice = id
    ? await ctx.db.notice.update({ where: { id }, data })
    : await ctx.db.notice.create({ data: { ...data, createdById: ctx.userId } });

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: id ? "NOTICE_UPDATED" : "NOTICE_PUBLISHED",
    module: "notices",
    recordId: notice.id,
    newValue: { title, audience, publishDate, expiryDate },
  });

  revalidatePath("/dashboard/notices");
  return { success: true };
}

export async function deleteNotice(id: string) {
  const ctx = await requireCapability("notices", "delete");

  try {
    await ctx.db.notice.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "notice"));
  }

  await writeTenantAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "NOTICE_DELETED",
    module: "notices",
    recordId: id,
  });

  revalidatePath("/dashboard/notices");
}
