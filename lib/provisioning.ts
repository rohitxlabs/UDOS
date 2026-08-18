import "server-only";
import { prisma as platformDb } from "@/lib/prisma";
import { hashPassword, generatePassword, usernameBase } from "@/lib/password";
import type { Prisma as TenantPrisma, PrismaClient as TenantPrismaClient } from "@/app/generated/tenant-prisma/client";

type TenantDb = TenantPrismaClient | TenantPrisma.TransactionClient;

// Shared account-provisioning logic used anywhere a college's login gets
// created by an admin rather than through self-registration (there is no
// self-registration). Writes the real user record into the tenant's own
// database, and a thin routing entry into the platform's login directory
// so the single login form can find which tenant database to check a
// username against (tenant databases are not cross-queryable).
export async function createLoginAccount(
  collegeId: string,
  db: TenantDb,
  params: {
    name: string;
    roleId?: string | null;
    email?: string | null;
    phone?: string | null;
    customUsername?: string | null;
    customPassword?: string | null;
    // The tenant User who is creating this account. Null for the bootstrap
    // College Admin: that one is created by the platform owner during
    // onboarding, and a platform identity is not a tenant identity (spec
    // section 16) — storing its id here would point this column at a user
    // that does not exist in this database.
    createdById: string | null;
  }
): Promise<{ userId: string; username: string; password: string } | { error: string }> {
  // A username has to be free in two places: the platform's login-routing
  // directory (globally, so one username maps to exactly one tenant) and
  // this tenant's own user table. They can disagree — a rolled-back
  // onboarding cascade-deletes the directory entries but deliberately
  // leaves the tenant database intact, so a name can be absent from the
  // directory while still being taken inside the tenant.
  // Checked one after the other rather than with Promise.all: `db` may be a
  // transaction client, which is a single connection that cannot serve two
  // queries at once.
  const isTaken = async (candidate: string) => {
    const inDirectory = await platformDb.tenantUserDirectory.findUnique({ where: { username: candidate } });
    if (inDirectory) return true;
    const inTenant = await db.user.findUnique({ where: { username: candidate } });
    return Boolean(inTenant);
  };

  let username = params.customUsername?.trim();
  if (username) {
    if (await isTaken(username)) return { error: `Username "${username}" is already taken` };
  } else {
    const base = usernameBase(params.name);
    let candidate = "";
    let attempt = 0;
    do {
      const suffix = attempt === 0 ? String(Math.floor(100 + Math.random() * 900)) : String(Date.now()).slice(-6);
      candidate = `${base}.${suffix}`;
      attempt++;
    } while ((await isTaken(candidate)) && attempt < 5);
    if (await isTaken(candidate)) return { error: "Could not allocate a unique username — please try again" };
    username = candidate;
  }

  const password = params.customPassword?.trim() || generatePassword();
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      username,
      email: params.email || null,
      phone: params.phone || null,
      name: params.name,
      roleId: params.roleId || null,
      passwordHash,
      mustChangePassword: true,
      createdById: params.createdById,
    },
  });

  await platformDb.tenantUserDirectory.create({ data: { username, collegeId } });

  return { userId: user.id, username, password };
}
