"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability, requireCollege } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";
import { can } from "@/lib/permissions";

const requestSchema = z
  .object({
    userId: z.string().optional(),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
    reason: z.string().trim().min(3, "A reason is required"),
    documentUrl: z.string().trim().url("Document must be a valid URL").optional().or(z.literal("")),
  })
  .refine((d) => d.toDate >= d.fromDate, { message: "End date cannot be before start date", path: ["toDate"] });

export type LeaveState = { error?: string; success?: boolean };

// Anyone with a login may request their own leave — that is not a
// privileged action. Filing on someone else's behalf is, and needs the
// `create` capability on the module.
export async function submitLeaveRequest(_prev: LeaveState, formData: FormData): Promise<LeaveState> {
  const ctx = await requireCollege();

  const parsed = requestSchema.safeParse({
    userId: formData.get("userId") || undefined,
    fromDate: formData.get("fromDate"),
    toDate: formData.get("toDate"),
    reason: formData.get("reason"),
    documentUrl: formData.get("documentUrl") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { userId, fromDate, toDate, reason, documentUrl } = parsed.data;

  const onBehalfOf = userId && userId !== ctx.userId;
  if (onBehalfOf && !can(ctx, "leave", "create")) {
    return { error: "You can only submit leave requests for yourself" };
  }

  const request = await ctx.db.leaveRequest.create({
    data: {
      userId: onBehalfOf ? userId : ctx.userId,
      fromDate: new Date(`${fromDate}T00:00:00.000Z`),
      toDate: new Date(`${toDate}T00:00:00.000Z`),
      reason,
      documentUrl: documentUrl || null,
    },
  });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "LEAVE_REQUESTED",
    module: "leave",
    recordId: request.id,
    newValue: { forUserId: request.userId, fromDate, toDate },
  });

  revalidatePath("/dashboard/leave");
  return { success: true };
}

// Approving or rejecting is always someone else's decision about your
// leave, so it is gated separately and never self-serviceable.
export async function decideLeaveRequest(
  id: string,
  decision: "APPROVED" | "REJECTED"
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCapability("leave", "approve");

  const request = await ctx.db.leaveRequest.findUnique({ where: { id } });
  if (!request) return { error: "Leave request not found" };
  if (request.status !== "PENDING") return { error: `This request was already ${request.status.toLowerCase()}` };
  if (request.userId === ctx.userId) return { error: "You cannot decide your own leave request" };

  await ctx.db.leaveRequest.update({
    where: { id },
    data: { status: decision, approvedById: ctx.userId, approvedAt: new Date() },
  });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: decision === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
    module: "leave",
    recordId: id,
    oldValue: { status: request.status },
    newValue: { status: decision },
  });

  revalidatePath("/dashboard/leave");
  return { success: true };
}

export async function withdrawLeaveRequest(id: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await requireCollege();

  const request = await ctx.db.leaveRequest.findUnique({ where: { id } });
  if (!request) return { error: "Leave request not found" };
  if (request.status !== "PENDING") return { error: "Only a pending request can be withdrawn" };
  // A decided request is a record; a pending one is just an ask, and the
  // person who made it (or someone who can delete) may take it back.
  if (request.userId !== ctx.userId && !can(ctx, "leave", "delete")) {
    return { error: "You can only withdraw your own request" };
  }

  await ctx.db.leaveRequest.delete({ where: { id } });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "LEAVE_WITHDRAWN",
    module: "leave",
    recordId: id,
  });

  revalidatePath("/dashboard/leave");
  return { success: true };
}
