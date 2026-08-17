"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma as platformDb } from "@/lib/prisma";
import { requirePlatform } from "@/lib/auth/dal";
import { writePlatformAuditLog } from "@/lib/audit";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const schema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Key is required")
    .regex(/^[a-z][a-zA-Z]*$/, "camelCase, letters only"),
  name: z.string().trim().min(2, "Name is required"),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  dependsOnKeys: z.array(z.string()).optional(),
});

export type CreateModuleState = { error?: string; success?: boolean };

export async function createModule(_prev: CreateModuleState, formData: FormData): Promise<CreateModuleState> {
  const ctx = await requirePlatform();

  const parsed = schema.safeParse({
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description"),
    dependsOnKeys: formData.getAll("dependsOnKeys"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { key, name, description, dependsOnKeys } = parsed.data;

  const existing = await platformDb.module.findUnique({ where: { key } });
  if (existing) return { error: `Module key "${key}" already exists` };

  const dependsOn = dependsOnKeys?.length
    ? await platformDb.module.findMany({ where: { key: { in: dependsOnKeys } } })
    : [];

  const module = await platformDb.module.create({
    data: {
      key,
      name,
      description,
      dependsOn: { create: dependsOn.map((d) => ({ dependsOnId: d.id })) },
    },
  });

  await writePlatformAuditLog({
    userId: ctx.userId,
    action: "MODULE_CREATED",
    module: "modules",
    recordId: module.id,
    newValue: { key, name },
  });

  revalidatePath("/platform/modules");
  return { success: true };
}

export async function toggleModuleActive(moduleId: string, nextActive: boolean) {
  const ctx = await requirePlatform();
  const module = await platformDb.module.update({ where: { id: moduleId }, data: { isActive: nextActive } });

  await writePlatformAuditLog({
    userId: ctx.userId,
    action: nextActive ? "MODULE_CATALOG_ACTIVATED" : "MODULE_CATALOG_DEACTIVATED",
    module: "modules",
    recordId: module.id,
  });

  revalidatePath("/platform/modules");
}
