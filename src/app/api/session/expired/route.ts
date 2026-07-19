import { NextResponse, type NextRequest } from "next/server";
import { stripSecureCookiePrefix } from "better-auth/cookies";

const COOKIE_PREFIX = "better-auth";

/**
 * Terminal exit for a session the cookie claims exists but the database says
 * does not — expired, revoked, or signed with a rotated BETTER_AUTH_SECRET.
 *
 * `proxy.ts` only checks that a session cookie is *present* (a deliberately
 * cheap edge check, no DB). So while a stale cookie survives, proxy keeps
 * sending /login -> /todos while the (app) layout sends /todos -> /login:
 * an infinite redirect loop that burns one Turso round-trip per cycle.
 *
 * Cookies can only be deleted in a Route Handler or Server Function — never
 * during Server Component render — so the layout hands off to here instead of
 * redirecting to /login itself.
 */
export function GET(request: NextRequest) {
  // A relative Location keeps the browser on whatever host it is already on.
  // NextResponse.redirect() would force an absolute URL built from
  // request.url, which reports the server's canonical host and ignores the
  // Host header — sending a visitor on 127.0.0.1 over to localhost, a
  // different cookie jar, stranding the very cookie being cleared here.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: "/login?expired=1" },
  });

  // Clear every Better Auth cookie, not just the session token: the name may
  // carry a __Secure- prefix (HTTPS), use a "." or "-" separator, and the
  // session_data cache may be split into .0/.1/... chunks. Missing any one of
  // them leaves getSessionCookie() returning truthy and the loop intact.
  for (const cookie of request.cookies.getAll()) {
    const name = stripSecureCookiePrefix(cookie.name);
    if (
      name.startsWith(`${COOKIE_PREFIX}.`) ||
      name.startsWith(`${COOKIE_PREFIX}-`)
    ) {
      response.cookies.delete(cookie.name);
    }
  }

  return response;
}
