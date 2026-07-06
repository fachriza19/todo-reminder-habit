import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_ROUTES = ["/login", "/signup"];
const APP_ROUTES = ["/todos", "/reminders", "/habits", "/settings"];

/**
 * Optimistic route protection (F-AUTH-5). Presence of the session cookie is
 * checked at the edge for fast redirects; the authoritative session check
 * still runs in the (app) layout and in every route handler (requireUserId).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  const isAppRoute = APP_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Not signed in, hitting a protected page -> go to login.
  if (isAppRoute && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Signed in, hitting login/signup -> go to the app.
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/todos", request.url));
  }

  // Root: route to app or login depending on session.
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSession ? "/todos" : "/login", request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/todos/:path*",
    "/reminders/:path*",
    "/habits/:path*",
    "/settings/:path*",
  ],
};
