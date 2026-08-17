import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/app/generated/prisma";

const secretKey = process.env.AUTH_SECRET;
if (!secretKey) throw new Error("AUTH_SECRET environment variable is not set");
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_COOKIE = "erp_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

export type SessionPayload = {
  userId: string;
  role: Role;
  username: string;
  name: string;
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

export async function createSession(user: { id: string; role: Role; username: string; name: string }) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const sessionToken = await encrypt({
    userId: user.id,
    role: user.role,
    username: user.username,
    name: user.name,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function refreshSession() {
  const token = await getSessionCookie();
  const payload = await decrypt(token);
  if (!token || !payload) return;

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}
