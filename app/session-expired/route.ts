import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Where the DAL sends a session whose identity no longer exists in the
// database — an account deleted or deactivated since sign-in, or a token
// minted against a different database than the one this deployment now points
// at.
//
// It cannot simply redirect to /login. The cookie is still cryptographically
// valid, so proxy.ts would see a logged-in user on /login and bounce them
// straight back to /platform, which would fail the same DAL check and redirect
// here again — an infinite loop. The cookie has to actually be cleared, and
// clearing a cookie is only possible in a Route Handler or Server Action,
// never during a Server Component render. Hence this endpoint.
//
// It is deliberately outside proxy.ts's matcher, so nothing intercepts the one
// request whose whole job is to break the cycle.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
