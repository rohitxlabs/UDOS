import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { PlatformRole } from "@/app/generated/prisma/client";

const secretKey = process.env.AUTH_SECRET;
if (!secretKey) throw new Error("AUTH_SECRET environment variable is not set");
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_COOKIE = "erp_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Two completely separate identity spaces share one login form (spec
// section 16): a platform admin's session vs a college's own user session.
// Which branch applies is decided once, at login, from which database the
// username was found in — never trusted from client input afterwards.
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
      scope: "TENANT";
      userId: string;
      username: string;
      name: string;
      collegeId: string;
      collegeSlug: string;
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
// pass a PLATFORM payload missing `collegeId` and a TENANT payload missing
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
