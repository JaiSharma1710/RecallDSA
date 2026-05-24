import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, isSessionTokenValid } from "@/lib/auth";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/extension/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = isSessionTokenValid(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};
