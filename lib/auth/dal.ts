import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { decrypt, getSessionCookie, type SessionPayload } from "@/lib/auth/session";
import { prisma as platformDb } from "@/lib/prisma";
import { collegeDb, type CollegeDb } from "@/lib/college-db";
import { COLLEGE_ID } from "@/lib/college";
import { can, permissionKey, type Capability, type Module } from "@/lib/permissions";

// Data Access Layer: the single source of truth for "who is logged in and
// what can they do." Every server component / server action / route handler
// that needs auth should go through here rather than trusting proxy.ts alone.
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

export type CollegeAccessContext = {
  scope: "COLLEGE";
  userId: string;
  username: string;
  name: string;
  mustChangePassword: boolean;
  college: { id: string; name: string; code: string; logoUrl: string | null };
  roleId: string | null;
  roleName: string | null;
  db: CollegeDb;
  enabledModules: Set<string>;
  permissions: Set<string>;
};

export type AccessContext = PlatformAccessContext | CollegeAccessContext;

// Everything a request needs to answer "what is this user allowed to see and
// do," resolved once per request.
//
// There is no tenant resolution step here any more: `db` is this
// deployment's one college database, fixed at process start. What still has
// to be resolved per request is the two access layers — which modules the
// platform granted this college (Layer 1, platform database) and what this
// user's role may do inside them (Layer 2, college database).
export const getAccessContext = cache(async (): Promise<AccessContext> => {
  const session = await verifySession();

  if (session.scope === "PLATFORM") {
    // Read the account rather than trusting the token's copy of it. A signed
    // session proves who signed in, not that they are still allowed in — and
    // a token outlives the row it describes by up to its full 12 hours.
    //
    // Without this check a Super Admin who was deactivated, deleted, or whose
    // id belongs to a different database keeps full platform authority until
    // the token expires, and every audit write they trigger fails a foreign
    // key on the way out.
    const platformUser = await platformDb.platformUser.findUnique({ where: { id: session.userId } });
    if (!platformUser || !platformUser.isActive) redirect("/session-expired");

    return {
      scope: "PLATFORM",
      userId: platformUser.id,
      username: platformUser.username,
      name: platformUser.name,
      platformRole: platformUser.platformRole,
      mustChangePassword: platformUser.mustChangePassword,
    };
  }

  // Same reasoning as the PLATFORM branch: confirm the account still exists
  // and is active, rather than taking the token's word for it.
  const [college, collegeUser] = await Promise.all([
    platformDb.college.findUnique({ where: { id: COLLEGE_ID } }),
    collegeDb.user.findUnique({ where: { id: session.userId }, include: { role: true } }),
  ]);

  // No college row means the deployment was never seeded, and an unseeded
  // deployment has no modules granted either — every screen would render
  // empty and unexplained. Bounce to login rather than serve that.
  if (!college || !college.isActive || !collegeUser || !collegeUser.isActive) {
    redirect("/session-expired");
  }

  const [moduleGrants, rolePermissions] = await Promise.all([
    platformDb.moduleAccess.findMany({
      where: { enabled: true, module: { isActive: true } },
      select: { module: { select: { key: true } } },
    }),
    collegeUser.roleId
      ? collegeDb.rolePermission.findMany({ where: { roleId: collegeUser.roleId } })
      : Promise.resolve([]),
  ]);

  const enabledModules = new Set(moduleGrants.map((row) => row.module.key));
  const permissions = new Set(
    rolePermissions.map((rp) => permissionKey(rp.moduleKey as Module, rp.action.toLowerCase() as Capability))
  );

  return {
    scope: "COLLEGE",
    userId: collegeUser.id,
    username: collegeUser.username,
    name: collegeUser.name,
    mustChangePassword: collegeUser.mustChangePassword,
    college: { id: college.id, name: college.name, code: college.code, logoUrl: college.logoUrl },
    roleId: collegeUser.roleId,
    roleName: collegeUser.role?.name ?? null,
    db: collegeDb,
    enabledModules,
    permissions,
  };
});

// Guard for pages/actions that only make sense for the college's own users
// (i.e. almost everything under /dashboard). Redirects a platform admin who
// wanders in — holding the module switches is not the same as holding an
// account inside the college, and the Super Admin has no record in the
// college database at all.
export async function requireCollege(): Promise<CollegeAccessContext> {
  const ctx = await getAccessContext();
  if (ctx.scope !== "COLLEGE") redirect("/platform");
  return ctx;
}

// Guard for /platform/* pages/actions.
export async function requirePlatform(): Promise<PlatformAccessContext> {
  const ctx = await getAccessContext();
  if (ctx.scope !== "PLATFORM") redirect("/dashboard");
  return ctx;
}

// The guard for server actions: module must be enabled for this college AND
// the caller's role must be granted this action on it. Throwing is right
// here — a rejected mutation surfaces to the client as an action error the
// caller already handles with a toast.
export async function requireCapability(moduleName: Module, capability: Capability): Promise<CollegeAccessContext> {
  const ctx = await requireCollege();
  if (!can(ctx, moduleName, capability)) {
    throw new Error(`Forbidden: role "${ctx.roleName ?? "none"}" lacks ${capability} on ${moduleName}`);
  }
  return ctx;
}

// The same two-layer check, for pages. A page the caller may not open is a
// 403, not a crash: throwing here would render the "server error" screen and
// make a correctly-denied request look like a broken app. forbidden() renders
// app/forbidden.tsx with a real 403 status instead.
//
// This is the backend check, not a cosmetic one — the sidebar already hides
// links the caller cannot use, but typing the URL directly lands here.
export async function requirePageAccess(
  moduleName: Module,
  capability: Capability = "view"
): Promise<CollegeAccessContext> {
  const ctx = await requireCollege();
  if (!can(ctx, moduleName, capability)) forbidden();
  return ctx;
}
