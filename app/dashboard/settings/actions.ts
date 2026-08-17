"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "College name is required"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().email("Invalid email")]).optional(),
  website: z.string().trim().optional(),
  attendanceMinPercent: z.coerce.number().min(0).max(100),
});

export type SettingsState = {
  error?: string;
  success?: boolean;
};

export async function saveCollegeSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireCapability("settings", "edit");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    website: formData.get("website"),
    attendanceMinPercent: formData.get("attendanceMinPercent"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, ...data } = parsed.data;
  const payload = { ...data, email: data.email || null };

  const college = id
    ? await prisma.college.update({ where: { id }, data: payload })
    : await prisma.college.create({ data: payload });

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: id ? "COLLEGE_SETTINGS_UPDATED" : "COLLEGE_CREATED",
    module: "settings",
    recordId: college.id,
    newValue: payload,
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
