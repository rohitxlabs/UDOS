import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/auth/session";

// Optimistic check only — it avoids a flash of protected UI for logged-out
// users and bounces logged-in users away from /login. The real
// authentication/authorization check happens in the DAL (lib/auth/dal.ts)
// on every server component, action and route handler.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decrypt(token);

  const wantsDashboard = pathname.startsWith("/dashboard");
  const wantsPlatform = pathname.startsWith("/platform");

  if ((wantsDashboard || wantsPlatform) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && wantsDashboard && session.scope !== "COLLEGE") {
    return NextResponse.redirect(new URL("/platform", request.url));
  }

  if (session && wantsPlatform && session.scope !== "PLATFORM") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(session.scope === "PLATFORM" ? "/platform" : "/dashboard", request.url));
  }

  if (session?.mustChangePassword) {
    const changePasswordPath = session.scope === "PLATFORM" ? "/platform/change-password" : "/dashboard/change-password";
    if ((wantsDashboard || wantsPlatform) && pathname !== changePasswordPath) {
      return NextResponse.redirect(new URL(changePasswordPath, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/platform/:path*", "/login"],
};
