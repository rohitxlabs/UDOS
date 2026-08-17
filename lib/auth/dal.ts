import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { decrypt, getSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma";
import { can, type Capability, type Module } from "@/lib/permissions";

// Data Access Layer: the single source of truth for "who is logged in".
// Every server component / server action / route handler that needs auth
// should go through here rather than trusting proxy.ts alone.
export const verifySession = cache(async () => {
  const token = await getSessionCookie();
  const payload = await decrypt(token);

  if (!payload?.userId) {
    redirect("/login");
  }

  return {
    isAuth: true,
    userId: payload.userId,
    role: payload.role,
    name: payload.name,
    username: payload.username,
    mustChangePassword: payload.mustChangePassword,
  };
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      phone: true,
      student: { select: { id: true } },
      teacher: { select: { id: true } },
      parent: { select: { id: true } },
    },
  });

  if (!user || !user.isActive) {
    redirect("/login");
  }

  return user;
});

export async function requireRole(...roles: Role[]) {
  const session = await verifySession();
  if (!roles.includes(session.role)) {
    redirect("/dashboard");
  }
  return session;
}

// Use in server components/actions/route handlers that back a specific
// module — throws (rather than redirecting) so server actions surface a
// clear error instead of silently no-op-ing.
export async function requireCapability(moduleName: Module, capability: Capability) {
  const session = await verifySession();
  if (!can(session.role, moduleName, capability)) {
    throw new Error(`Forbidden: role ${session.role} lacks ${capability} on ${moduleName}`);
  }
  return session;
}
