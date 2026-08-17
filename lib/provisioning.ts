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
    createdById: string;
  }
): Promise<{ userId: string; username: string; password: string } | { error: string }> {
  let username = params.customUsername?.trim();
  if (username) {
    const existing = await platformDb.tenantUserDirectory.findUnique({ where: { username } });
    if (existing) return { error: `Username "${username}" is already taken` };
  } else {
    const base = usernameBase(params.name);
    let candidate = "";
    let attempt = 0;
    do {
      const suffix = attempt === 0 ? String(Math.floor(100 + Math.random() * 900)) : String(Date.now()).slice(-6);
      candidate = `${base}.${suffix}`;
      attempt++;
    } while ((await platformDb.tenantUserDirectory.findUnique({ where: { username: candidate } })) && attempt < 5);
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
