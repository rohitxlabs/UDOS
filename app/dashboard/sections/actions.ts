"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/dal";
import { writeAuditLog } from "@/lib/audit";
import { friendlyDeleteError } from "@/lib/prisma-errors";

const schema = z.object({
  id: z.string().optional(),
  semesterId: z.string().min(1, "Semester is required"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .transform((v) => v.toUpperCase()),
});

export type SectionState = { error?: string; success?: boolean };

export async function saveSection(_prev: SectionState, formData: FormData): Promise<SectionState> {
  const session = await requireCapability("sections", formData.get("id") ? "edit" : "create");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    semesterId: formData.get("semesterId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, semesterId, name } = parsed.data;

  try {
    const section = id
      ? await prisma.section.update({ where: { id }, data: { name, semesterId } })
      : await prisma.section.create({ data: { name, semesterId } });

    await writeAuditLog({
      userId: session.userId,
      role: session.role,
      action: id ? "SECTION_UPDATED" : "SECTION_CREATED",
      module: "sections",
      recordId: section.id,
      newValue: { name, semesterId },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      return { error: `Section "${name}" already exists for this semester` };
    }
    throw err;
  }

  revalidatePath("/dashboard/sections");
  return { success: true };
}

export async function deleteSection(id: string) {
  const session = await requireCapability("sections", "delete");

  try {
    await prisma.section.delete({ where: { id } });
  } catch (err) {
    throw new Error(friendlyDeleteError(err, "section"));
  }

  await writeAuditLog({
    userId: session.userId,
    role: session.role,
    action: "SECTION_DELETED",
    module: "sections",
    recordId: id,
  });

  revalidatePath("/dashboard/sections");
}
