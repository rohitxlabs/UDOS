import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { decrypt, getSessionCookie, type SessionPayload } from "@/lib/auth/session";
import { prisma as platformDb } from "@/lib/prisma";
import { getTenantClient } from "@/lib/tenant-db";
import { can, permissionKey, type Capability, type Module } from "@/lib/permissions";

// Data Access Layer: the single source of truth for "who is logged in, for
// which tenant (if any), and what can they do." Every server component /
// server action / route handler that needs auth should go through here
// rather than trusting proxy.ts alone.
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const token = await getSessionCookie();
  const payload = await decrypt(token);

  if (!payload?.userId) {
    redirect("/login");
  }

  return payload;
});

export type PlatformAccessContext = {
  scope: "PLATFORM";
  userId: string;
  username: string;
  name: string;
  platformRole: string;
  mustChangePassword: boolean;
};

export type TenantAccessContext = {
  scope: "TENANT";
  userId: string;
  username: string;
  name: string;
  mustChangePassword: boolean;
  collegeId: string;
  college: { id: string; name: string; slug: string; logoUrl: string | null };
  roleId: string | null;
  roleName: string | null;
  db: ReturnType<typeof getTenantClient>;
  enabledModules: Set<string>;
  permissions: Set<string>;
};

export type AccessContext = PlatformAccessContext | TenantAccessContext;

// Everything a request needs to answer "what is this user allowed to see
// and do," resolved once per request. This is the ONLY place collegeId
// flows into a database connection — always from the signed session, never
// from anything the client sent.
export const getAccessContext = cache(async (): Promise<AccessContext> => {
  const session = await verifySession();

  if (session.scope === "PLATFORM") {
    return {
      scope: "PLATFORM",
      userId: session.userId,
      username: session.username,
      name: session.name,
      platformRole: session.platformRole,
      mustChangePassword: session.mustChangePassword,
    };
  }

  const college = await platformDb.college.findUnique({ where: { id: session.collegeId } });
  if (!college || !college.isActive) {
    redirect("/login");
  }

  const db = getTenantClient(college.id, college.databaseUrlEncrypted);

  const [tenantModules, rolePermissions] = await Promise.all([
    platformDb.tenantModule.findMany({
      where: { collegeId: college.id, enabled: true, module: { isActive: true } },
      select: { module: { select: { key: true } } },
    }),
    session.roleId
      ? db.rolePermission.findMany({ where: { roleId: session.roleId } })
      : Promise.resolve([]),
  ]);

  const enabledModules = new Set(tenantModules.map((tm) => tm.module.key));
  const permissions = new Set(
    rolePermissions.map((rp) => permissionKey(rp.moduleKey as Module, rp.action.toLowerCase() as Capability))
  );

  return {
    scope: "TENANT",
    userId: session.userId,
    username: session.username,
    name: session.name,
    mustChangePassword: session.mustChangePassword,
    collegeId: college.id,
    college: { id: college.id, name: college.name, slug: college.slug, logoUrl: college.logoUrl },
    roleId: session.roleId,
    roleName: session.roleName,
    db,
    enabledModules,
    permissions,
  };
});

// Guard for pages/actions that only make sense for a college's own users
// (i.e. almost everything under /dashboard). Redirects a platform admin who
// wanders in — platform admins have no automatic tenant data access
// (spec section 27).
export async function requireTenant(): Promise<TenantAccessContext> {
  const ctx = await getAccessContext();
  if (ctx.scope !== "TENANT") redirect("/platform");
  return ctx;
}

// Guard for /platform/* pages/actions.
export async function requirePlatform(): Promise<PlatformAccessContext> {
  const ctx = await getAccessContext();
  if (ctx.scope !== "PLATFORM") redirect("/dashboard");
  return ctx;
}

// The main guard used by tenant modules: module must be enabled for this
// college AND the caller's role must be granted this action on it.
export async function requireCapability(moduleName: Module, capability: Capability): Promise<TenantAccessContext> {
  const ctx = await requireTenant();
  if (!can(ctx, moduleName, capability)) {
    throw new Error(`Forbidden: role "${ctx.roleName ?? "none"}" lacks ${capability} on ${moduleName}`);
  }
  return ctx;
}
