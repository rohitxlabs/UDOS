import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { PlatformRole } from "@/app/generated/prisma/client";

const secretKey = process.env.AUTH_SECRET;
if (!secretKey) throw new Error("AUTH_SECRET environment variable is not set");
const encodedKey = new TextEncoder().encode(secretKey);

// Exported so proxy.ts and the session-expired route name the same cookie as
// this module rather than each keeping their own copy of the string.
export const SESSION_COOKIE = "erp_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Two completely separate identity spaces share one login form: the platform
// owner's Super Admin session vs a college user's session. Which branch
// applies is decided once, at login, by which of the two databases the
// username was found in — never trusted from client input afterwards.
//
// The COLLEGE branch carries no collegeId: this deployment serves exactly one
// college, so there is nothing to identify. A session simply cannot name a
// different college, because the concept does not exist at runtime.
export type SessionPayload =
  | {
      scope: "PLATFORM";
      userId: string;
      username: string;
      name: string;
      platformRole: PlatformRole;
      mustChangePassword: boolean;
      expiresAt: number;
    }
  | {
      scope: "COLLEGE";
      userId: string;
      username: string;
      name: string;
      roleId: string | null;
      roleName: string | null;
      mustChangePassword: boolean;
      expiresAt: number;
    };

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(encodedKey);
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

async function setSessionCookie(sessionToken: string, expiresAt: number) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

// Plain Omit doesn't distribute over a union — it collapses SessionPayload
// to the intersection of its branches' keys first, which would let callers
// pass a COLLEGE payload missing `roleId` and a PLATFORM payload missing
// `platformRole` without a type error. Distribute manually instead.
type NewSession = { [K in SessionPayload["scope"]]: Omit<Extract<SessionPayload, { scope: K }>, "expiresAt"> }[SessionPayload["scope"]];

export async function createSession(payload: NewSession) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const sessionToken = await encrypt({ ...payload, expiresAt } as SessionPayload);
  await setSessionCookie(sessionToken, expiresAt);
}

export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
