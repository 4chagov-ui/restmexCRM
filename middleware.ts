import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessRoute,
  getHomePathForRole,
  normalizeRole,
} from "@/lib/auth/permissions";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set(["/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, role: rawRole } = await updateSession(request);
  const role = normalizeRole(rawRole);

  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = getHomePathForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && !role && pathname !== "/profile-not-configured") {
    const url = request.nextUrl.clone();
    url.pathname = "/profile-not-configured";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    role &&
    pathname !== "/profile-not-configured" &&
    !canAccessRoute(role, pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = getHomePathForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match app routes; skip Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
