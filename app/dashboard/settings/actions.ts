"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/dal";
import { writeCollegeAuditLog } from "@/lib/audit";

const schema = z.object({
  attendanceMinPercent: z.coerce.number().min(0).max(100),
});

export type SettingsState = {
  error?: string;
  success?: boolean;
};

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ctx = await requireCapability("settings", "edit");

  const parsed = schema.safeParse({
    attendanceMinPercent: formData.get("attendanceMinPercent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const settings = await ctx.db.settings.upsert({
    where: { id: "settings" },
    update: parsed.data,
    create: { id: "settings", ...parsed.data },
  });

  await writeCollegeAuditLog(ctx.db, {
    userId: ctx.userId,
    roleName: ctx.roleName,
    action: "SETTINGS_UPDATED",
    module: "settings",
    recordId: settings.id,
    newValue: parsed.data,
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
