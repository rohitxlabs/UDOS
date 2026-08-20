"use server";

import { revalidatePath } from "next/cache";
import { requirePlatform } from "@/lib/auth/dal";
import { prisma as platformDb } from "@/lib/prisma";
import { collegeDb } from "@/lib/college-db";
import { COLLEGE_ID, COLLEGE_ADMIN_ROLE, FULL_ACCESS } from "@/lib/college";
import { generatePassword, hashPassword } from "@/lib/password";
import { writePlatformAuditLog } from "@/lib/audit";
import { moduleWithPrerequisites, moduleWithDependents, type Module } from "@/lib/permissions";
import type { PermissionAction } from "@/app/generated/college-prisma/client";

// Toggling one module moves everything that logically travels with it.
// Enabling pulls in whatever it cannot work without; disabling takes down
// whatever would be left broken. Both directions used to just throw
// "enable that first" / "disable that first", which pushed the dependency
// graph onto the Super Admin to solve by hand.
//
// Returns what actually changed so the UI can say so rather than silently
// ticking half the list.
//
// No schema work happens here any more. Every deployment carries the full
// ERP schema, so granting a module is a flag flip against a table that
// already exists — instant, reversible, and with no migration to fail
// halfway against live data.
export async function updateModuleAccess(moduleKey: string, enabled: boolean): Promise<{ changed: string[] }> {
  const ctx = await requirePlatform();
  await platformDb.module.findUniqueOrThrow({ where: { key: moduleKey } });

  // The closure is computed from the declaration in lib/permissions.ts, so
  // the cascade cannot drift from what the application actually requires.
  const affected = enabled
    ? moduleWithPrerequisites(moduleKey as Module)
    : moduleWithDependents(moduleKey as Module);

  const modules = await platformDb.module.findMany({ where: { key: { in: affected }, isActive: true } });
  const existing = await platformDb.moduleAccess.findMany({
    where: { moduleId: { in: modules.map((m) => m.id) } },
  });
  const stateByModuleId = new Map(existing.map((row) => [row.moduleId, row.enabled]));

  // Only touch modules not already in the target state — this keeps the
  // audit log meaningful and the "changed" list honest.
  const toChange = modules.filter((m) => (stateByModuleId.get(m.id) ?? false) !== enabled);
  if (toChange.length === 0) return { changed: [] };

  for (const target of toChange) {
    await platformDb.moduleAccess.upsert({
      where: { moduleId: target.id },
      update: { enabled, enabledAt: enabled ? new Date() : null, enabledById: enabled ? ctx.userId : null },
      create: {
        moduleId: target.id,
        enabled,
        enabledAt: enabled ? new Date() : null,
        enabledById: ctx.userId,
      },
    });
  }

  // Granting a module has to leave the college able to actually use it. The
  // seed gives the non-deletable "College Admin" role full access to every
  // module granted at deploy time; a module granted later must do the same,
  // or the platform hands over a module whose own administrator cannot open
  // it — and therefore cannot delegate it to anyone else either.
  //
  // This is not the platform configuring individual users' permissions: it
  // only keeps that one system role consistent. The College Admin remains
  // free to change it, and every other role's permissions stay entirely the
  // college's business.
  if (enabled) {
    const adminRole = await collegeDb.role.findFirst({ where: { isSystem: true } });
    if (adminRole) {
      await collegeDb.rolePermission.createMany({
        data: toChange.flatMap((target) =>
          FULL_ACCESS.map((action) => ({
            roleId: adminRole.id,
            moduleKey: target.key,
            action: action as PermissionAction,
          }))
        ),
        skipDuplicates: true,
      });
    }
  }
  // Disabling deliberately leaves those permissions in place: Layer 1 already
  // blocks the module outright, and keeping them means re-enabling restores
  // the college's setup rather than silently wiping it.

  await writePlatformAuditLog({
    userId: ctx.userId,
    action: enabled ? "MODULE_ENABLED" : "MODULE_DISABLED",
    module: "modules",
    newValue: { requested: moduleKey, cascaded: toChange.map((m) => m.key) },
  });

  revalidatePath("/platform");
  return { changed: toChange.map((m) => m.key) };
}

// Cuts off every college login at once without touching any data — for a
// deployment being wound down or between contracts. The Super Admin can
// still sign in, because their identity lives in the platform database.
export async function setCollegeActive(nextActive: boolean) {
  const ctx = await requirePlatform();
  const college = await platformDb.college.update({
    where: { id: COLLEGE_ID },
    data: { isActive: nextActive },
  });

  await writePlatformAuditLog({
    userId: ctx.userId,
    action: nextActive ? "COLLEGE_ACTIVATED" : "COLLEGE_SUSPENDED",
    module: "college",
    recordId: college.id,
  });

  revalidatePath("/platform");
}

// The College Admin's password is issued once, when the deployment is
// seeded. If it was never passed on — or has been lost — the college is
// simply locked out, because the password is bcrypt-hashed and nobody can
// read it back. This issues a fresh one.
//
// Deliberately narrow: it only ever targets the college's non-deletable
// system "College Admin" role, never an arbitrary user. The platform owner
// is restoring the college's access to their own ERP, not gaining the
// ability to reach into it and take over any account they like.
export async function resetCollegeAdminPassword(): Promise<{
  error?: string;
  success?: { username: string; password: string };
}> {
  const ctx = await requirePlatform();

  const adminRole = await collegeDb.role.findFirst({ where: { isSystem: true } });
  if (!adminRole) return { error: `This college has no "${COLLEGE_ADMIN_ROLE}" role — has the deployment been seeded?` };

  const admin = await collegeDb.user.findFirst({
    where: { roleId: adminRole.id },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) return { error: "This college has no College Admin account" };

  const password = generatePassword();
  await collegeDb.user.update({
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
    action: "COLLEGE_ADMIN_PASSWORD_RESET",
    module: "college",
    recordId: admin.id,
    newValue: { username: admin.username },
  });

  revalidatePath("/platform");
  return { success: { username: admin.username, password } };
}
