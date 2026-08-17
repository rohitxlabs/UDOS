"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { prisma as platformDb } from "@/lib/prisma";
import { requirePlatform } from "@/lib/auth/dal";
import { encryptDatabaseUrl, withPgSchema, getTenantClient } from "@/lib/tenant-db";
import { createLoginAccount } from "@/lib/provisioning";
import { writePlatformAuditLog } from "@/lib/audit";
import type { PermissionAction } from "@/app/generated/tenant-prisma/client";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const createCollegeSchema = z.object({
  name: z.string().trim().min(2, "College name is required"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only")
    .transform((v) => v.toLowerCase()),
  databaseUrl: z.string().trim().min(10, "A database connection string is required"),
  adminName: z.string().trim().min(2, "Admin name is required"),
  adminEmail: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email").optional()),
  moduleKeys: z.array(z.string()).min(1, "Select at least one module"),
});

export type CreateCollegeState = {
  error?: string;
  success?: { collegeName: string; adminUsername: string; adminPassword: string };
};

export async function createCollege(_prev: CreateCollegeState, formData: FormData): Promise<CreateCollegeState> {
  const ctx = await requirePlatform();

  const parsed = createCollegeSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    databaseUrl: formData.get("databaseUrl"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    moduleKeys: formData.getAll("moduleKeys"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { name, slug, databaseUrl, adminName, adminEmail, moduleKeys } = parsed.data;

  const existingSlug = await platformDb.college.findUnique({ where: { slug } });
  if (existingSlug) return { error: `Slug "${slug}" is already in use` };

  const modules = await platformDb.module.findMany({ where: { key: { in: moduleKeys } } });
  if (modules.length !== moduleKeys.length) return { error: "One or more selected modules are invalid" };

  const schemaName = `tenant_${slug.replace(/-/g, "_")}`;
  const tenantUrl = withPgSchema(databaseUrl, schemaName);

  // 1. Ensure the Postgres namespace exists, then apply the tenant schema
  // to it. This is the actual "provision a database for this college"
  // step (spec section 10/12) — additive only, never touches other schemas.
  try {
    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    await pg.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await pg.end();

    execFileSync("npx", ["prisma", "db", "push", "--config", "prisma/tenant/prisma.config.ts", "--skip-generate"], {
      cwd: process.cwd(),
      env: { ...process.env, TENANT_DATABASE_URL: tenantUrl },
      stdio: "pipe",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Could not provision the college database: ${message.slice(0, 300)}` };
  }

  // 2. Register the tenant in the platform DB.
  const college = await platformDb.college.create({
    data: { name, slug, databaseUrlEncrypted: encryptDatabaseUrl(tenantUrl), status: "ACTIVE", isActive: true },
  });

  try {
    const db = getTenantClient(college.id, college.databaseUrlEncrypted);

    // 3. Seed a non-deletable "College Admin" role with full access to
    // every module the platform just enabled, plus that admin's login.
    const adminRole = await db.role.create({
      data: {
        name: "College Admin",
        isSystem: true,
        permissions: {
          create: moduleKeys.flatMap((moduleKey) =>
            (["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "PRINT"] as const).map((action) => ({
              moduleKey,
              action: action as PermissionAction,
            }))
          ),
        },
      },
    });

    await db.settings.upsert({ where: { id: "settings" }, update: {}, create: { id: "settings" } });

    const account = await createLoginAccount(college.id, db, {
      name: adminName,
      roleId: adminRole.id,
      email: adminEmail,
      createdById: ctx.userId,
    });
    if ("error" in account) throw new Error(account.error);

    // 4. Layer 1: turn on exactly the modules the platform admin selected.
    await platformDb.tenantModule.createMany({
      data: modules.map((m) => ({
        collegeId: college.id,
        moduleId: m.id,
        enabled: true,
        enabledAt: new Date(),
        enabledById: ctx.userId,
      })),
    });

    await writePlatformAuditLog({
      userId: ctx.userId,
      collegeId: college.id,
      action: "COLLEGE_CREATED",
      module: "colleges",
      recordId: college.id,
      newValue: { name, slug, modules: moduleKeys },
    });

    revalidatePath("/platform/colleges");
    return { success: { collegeName: name, adminUsername: account.username, adminPassword: account.password } };
  } catch (err) {
    // Roll back the platform-side registration so a failed provisioning
    // attempt doesn't leave a half-set-up, unusable tenant behind.
    await platformDb.college.delete({ where: { id: college.id } }).catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return { error: `College database was created but setup failed: ${message.slice(0, 300)}` };
  }
}

export async function toggleCollegeActive(collegeId: string, nextActive: boolean) {
  const ctx = await requirePlatform();
  const college = await platformDb.college.update({
    where: { id: collegeId },
    data: { isActive: nextActive, status: nextActive ? "ACTIVE" : "SUSPENDED" },
  });

  await writePlatformAuditLog({
    userId: ctx.userId,
    collegeId: college.id,
    action: nextActive ? "COLLEGE_ACTIVATED" : "COLLEGE_SUSPENDED",
    module: "colleges",
    recordId: college.id,
  });

  revalidatePath("/platform/colleges");
}

export async function updateCollegeModules(collegeId: string, moduleKey: string, enabled: boolean) {
  const ctx = await requirePlatform();
  const module = await platformDb.module.findUniqueOrThrow({ where: { key: moduleKey } });

  if (enabled) {
    const dependencies = await platformDb.moduleDependency.findMany({
      where: { moduleId: module.id },
      include: { dependsOnModule: true },
    });
    for (const dep of dependencies) {
      const depEnabled = await platformDb.tenantModule.findUnique({
        where: { collegeId_moduleId: { collegeId, moduleId: dep.dependsOnId } },
      });
      if (!depEnabled?.enabled) {
        throw new Error(`"${module.name}" depends on "${dep.dependsOnModule.name}" — enable that first`);
      }
    }
  } else {
    const dependents = await platformDb.moduleDependency.findMany({
      where: { dependsOnId: module.id },
      include: { module: true },
    });
    for (const dependent of dependents) {
      const dependentEnabled = await platformDb.tenantModule.findUnique({
        where: { collegeId_moduleId: { collegeId, moduleId: dependent.moduleId } },
      });
      if (dependentEnabled?.enabled) {
        throw new Error(`"${dependent.module.name}" depends on this module — disable that first`);
      }
    }
  }

  await platformDb.tenantModule.upsert({
    where: { collegeId_moduleId: { collegeId, moduleId: module.id } },
    update: { enabled, enabledAt: enabled ? new Date() : null, enabledById: enabled ? ctx.userId : null },
    create: { collegeId, moduleId: module.id, enabled, enabledAt: enabled ? new Date() : null, enabledById: ctx.userId },
  });

  await writePlatformAuditLog({
    userId: ctx.userId,
    collegeId,
    action: enabled ? "MODULE_ENABLED" : "MODULE_DISABLED",
    module: "colleges",
    recordId: collegeId,
    newValue: { moduleKey },
  });

  revalidatePath(`/platform/colleges/${collegeId}`);
}
