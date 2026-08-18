"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "pg";
import { prisma as platformDb } from "@/lib/prisma";
import { requirePlatform } from "@/lib/auth/dal";
import { encryptDatabaseUrl, withPgSchema, getTenantClient } from "@/lib/tenant-db";
import { createLoginAccount } from "@/lib/provisioning";
import { generatePassword, hashPassword } from "@/lib/password";
import { writePlatformAuditLog } from "@/lib/audit";
import type { PermissionAction } from "@/app/generated/tenant-prisma/client";

const execFileAsync = promisify(execFile);

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

// The college's own non-deletable administrator role. Named once here
// because provisioning creates it and updateCollegeModules has to find it
// again later to keep its permissions in step with the modules granted.
const COLLEGE_ADMIN_ROLE = "College Admin";
// Applying the tenant schema to a fresh hosted database takes ~20s; this is
// a generous ceiling so a slow provider fails with a clear error instead of
// hanging the onboarding form indefinitely.
const PROVISION_TIMEOUT_MS = 3 * 60 * 1000;
const FULL_ACCESS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "PRINT"] as const;

const createCollegeSchema = z.object({
  name: z.string().trim().min(2, "College name is required"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only")
    .transform((v) => v.toLowerCase()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid college email").optional()),
  databaseUrl: z.string().trim().min(10, "A database connection string is required"),
  adminName: z.string().trim().min(2, "Admin name is required"),
  adminEmail: z.preprocess(emptyToUndefined, z.string().trim().email("Invalid email").optional()),
  // Both optional: leave them blank and the platform issues a unique
  // username and a strong random password instead. Set them when the
  // credentials have already been agreed with the college.
  adminUsername: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .regex(/^[a-z0-9._-]+$/, "Lowercase letters, numbers, dots, hyphens and underscores only")
      .optional()
  ),
  adminPassword: z.preprocess(
    emptyToUndefined,
    z.string().min(8, "Password must be at least 8 characters").optional()
  ),
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
    email: formData.get("email"),
    databaseUrl: formData.get("databaseUrl"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    adminUsername: formData.get("adminUsername"),
    adminPassword: formData.get("adminPassword"),
    moduleKeys: formData.getAll("moduleKeys"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { name, slug, email, databaseUrl, adminName, adminEmail, adminUsername, adminPassword, moduleKeys } =
    parsed.data;

  const existingSlug = await platformDb.college.findUnique({ where: { slug } });
  if (existingSlug) return { error: `Slug "${slug}" is already in use` };

  // Checked before provisioning rather than after: a username clash found
  // halfway through would leave a database created for a college that then
  // fails to onboard.
  if (adminUsername) {
    const taken = await platformDb.tenantUserDirectory.findUnique({ where: { username: adminUsername } });
    if (taken) return { error: `Username "${adminUsername}" is already taken by another college` };
  }

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

    // Applying the schema takes ~20s against a hosted Postgres. It must be
    // awaited rather than run with execFileSync: the sync version blocks
    // the Node event loop for that whole time, which stalls the server's
    // response stream and kills this request ("destination stream closed
    // early") before provisioning can report back.
    await execFileAsync("npx", ["prisma", "db", "push", "--config", "prisma/tenant/prisma.config.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, TENANT_DATABASE_URL: tenantUrl },
      timeout: PROVISION_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Could not provision the college database: ${message.slice(0, 300)}` };
  }

  // 2. Register the tenant in the platform DB.
  const college = await platformDb.college.create({
    data: {
      name,
      slug,
      email: email ?? null,
      databaseUrlEncrypted: encryptDatabaseUrl(tenantUrl),
      status: "ACTIVE",
      isActive: true,
    },
  });

  try {
    const db = getTenantClient(college.id, college.databaseUrlEncrypted);

    // 3. Seed a non-deletable "College Admin" role with full access to
    // every module the platform just enabled, plus that admin's login.
    //
    // Every write here is idempotent (spec section 10: "Provisioning should
    // be idempotent. If provisioning fails halfway, the system should be
    // able to safely retry"). It has to be: when a later step fails, the
    // rollback below removes the platform's record of the college but
    // deliberately leaves the tenant schema alone — dropping a database
    // that may already hold real data is not something a failed onboarding
    // should do. Retrying the same slug therefore lands in a schema that
    // may already contain the role and admin this step creates, so it must
    // converge on that state rather than collide with its own leftovers.
    const adminRole = await db.role.upsert({
      where: { name: COLLEGE_ADMIN_ROLE },
      update: { isSystem: true },
      create: { name: COLLEGE_ADMIN_ROLE, isSystem: true },
    });

    await db.rolePermission.createMany({
      data: moduleKeys.flatMap((moduleKey) =>
        FULL_ACCESS.map((action) => ({ roleId: adminRole.id, moduleKey, action: action as PermissionAction }))
      ),
      skipDuplicates: true,
    });

    await db.settings.upsert({ where: { id: "settings" }, update: {}, create: { id: "settings" } });

    // An admin left behind by a previous failed attempt is adopted rather
    // than duplicated — a college must end up with exactly one College
    // Admin however many times onboarding was retried. Its password is
    // reissued regardless, since the old one was never successfully handed
    // over (the attempt that generated it failed).
    const leftoverAdmin = await db.user.findFirst({
      where: { roleId: adminRole.id },
      orderBy: { createdAt: "asc" },
    });

    let account: { username: string; password: string };

    if (leftoverAdmin) {
      // Honour a username chosen on this attempt even though the account
      // itself is being reused, so the credentials handed over are the ones
      // that were actually asked for.
      const username = adminUsername ?? leftoverAdmin.username;
      if (username !== leftoverAdmin.username) {
        const clash = await db.user.findUnique({ where: { username } });
        if (clash) throw new Error(`Username "${username}" is already taken inside this college`);
      }

      const password = adminPassword ?? generatePassword();
      await db.user.update({
        where: { id: leftoverAdmin.id },
        data: {
          username,
          name: adminName,
          email: adminEmail || null,
          passwordHash: await hashPassword(password),
          mustChangePassword: true,
          isActive: true,
        },
      });

      // The login-routing entry is cascade-deleted along with the rolled-back
      // college, so it has to be re-pointed at this new college record. Any
      // entry under the account's previous name is now dead and must go, or
      // it would keep routing that name at a college that no longer exists.
      if (username !== leftoverAdmin.username) {
        await platformDb.tenantUserDirectory.deleteMany({ where: { username: leftoverAdmin.username } });
      }
      await platformDb.tenantUserDirectory.upsert({
        where: { username },
        update: { collegeId: college.id },
        create: { username, collegeId: college.id },
      });
      account = { username, password };
    } else {
      const created = await createLoginAccount(college.id, db, {
        name: adminName,
        roleId: adminRole.id,
        email: adminEmail,
        customUsername: adminUsername,
        customPassword: adminPassword,
        // Not ctx.userId: that is the *platform* admin, who has no record in
        // this college's database. User.createdById is a tenant-side foreign
        // key, so the college's first admin simply has no creator.
        createdById: null,
      });
      if ("error" in created) throw new Error(created.error);
      account = created;
    }

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
  const targetModule = await platformDb.module.findUniqueOrThrow({ where: { key: moduleKey } });

  if (enabled) {
    const dependencies = await platformDb.moduleDependency.findMany({
      where: { moduleId: targetModule.id },
      include: { dependsOnModule: true },
    });
    for (const dep of dependencies) {
      const depEnabled = await platformDb.tenantModule.findUnique({
        where: { collegeId_moduleId: { collegeId, moduleId: dep.dependsOnId } },
      });
      if (!depEnabled?.enabled) {
        throw new Error(`"${targetModule.name}" depends on "${dep.dependsOnModule.name}" — enable that first`);
      }
    }
  } else {
    const dependents = await platformDb.moduleDependency.findMany({
      where: { dependsOnId: targetModule.id },
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
    where: { collegeId_moduleId: { collegeId, moduleId: targetModule.id } },
    update: { enabled, enabledAt: enabled ? new Date() : null, enabledById: enabled ? ctx.userId : null },
    create: {
      collegeId,
      moduleId: targetModule.id,
      enabled,
      enabledAt: enabled ? new Date() : null,
      enabledById: ctx.userId,
    },
  });

  // Granting a module has to leave the college able to actually use it.
  // Provisioning gives the non-deletable "College Admin" role full access to
  // every module enabled at creation; a module enabled later must do the same,
  // or the platform hands over a module whose own administrator cannot open it
  // — and therefore cannot delegate it to anyone else either.
  //
  // This is not the platform configuring individual users' permissions
  // (spec section 2/14): it only keeps that one system role consistent. The
  // College Admin remains free to change it, and every other role's
  // permissions stay entirely the college's business.
  if (enabled) {
    const college = await platformDb.college.findUniqueOrThrow({ where: { id: collegeId } });
    const db = getTenantClient(college.id, college.databaseUrlEncrypted);
    const adminRole = await db.role.findFirst({ where: { isSystem: true } });
    if (adminRole) {
      await db.rolePermission.createMany({
        data: FULL_ACCESS.map((action) => ({
          roleId: adminRole.id,
          moduleKey,
          action: action as PermissionAction,
        })),
        skipDuplicates: true,
      });
    }
  }
  // Disabling deliberately leaves those permissions in place: Layer 1 already
  // blocks the module outright, and keeping them means re-enabling restores
  // the college's setup rather than silently wiping it (spec section 20).

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

// The College Admin's password is shown exactly once, at onboarding. If the
// platform admin closed that dialog before passing it on, the college was
// simply locked out — there was no way back in, because the password is
// bcrypt-hashed and nobody can read it. This issues a fresh one.
//
// Deliberately narrow: it only ever targets the college's non-deletable
// system "College Admin" role, never an arbitrary user. The platform owner
// is restoring a tenant's access to their own ERP, not gaining the ability
// to reach into a college and take over any account they like
// (spec section 27 — platform authority is not tenant authority).
export async function resetCollegeAdminPassword(
  collegeId: string
): Promise<{ error?: string; success?: { username: string; password: string } }> {
  const ctx = await requirePlatform();

  const college = await platformDb.college.findUnique({ where: { id: collegeId } });
  if (!college) return { error: "College not found" };

  const db = getTenantClient(college.id, college.databaseUrlEncrypted);

  const adminRole = await db.role.findFirst({ where: { isSystem: true } });
  if (!adminRole) return { error: "This college has no College Admin role" };

  const admin = await db.user.findFirst({
    where: { roleId: adminRole.id },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) return { error: "This college has no College Admin account" };

  const password = generatePassword();
  await db.user.update({
    where: { id: admin.id },
    data: {
      passwordHash: await hashPassword(password),
      // Force a change on next sign-in: a password that has passed through
      // the platform owner's hands should not stay in use.
      mustChangePassword: true,
      isActive: true,
    },
  });

  await writePlatformAuditLog({
    userId: ctx.userId,
    collegeId: college.id,
    action: "COLLEGE_ADMIN_PASSWORD_RESET",
    module: "colleges",
    recordId: college.id,
    newValue: { username: admin.username },
  });

  revalidatePath(`/platform/colleges/${collegeId}`);
  return { success: { username: admin.username, password } };
}
