import { NextResponse, type NextRequest } from "next/server";
import { open } from "@/lib/auth/crypto";
import { isSupabaseMode } from "@/lib/supabase/mode";

const PUBLIC_PATHS = new Set(["/login", "/reset-password", "/update-password", "/menu"]);

function homeFor(role: string | undefined): string {
  if (role === "seller") return "/sell";
  if (role === "admin" || role === "super-admin") return "/admin";
  return "/overview";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.includes(".")) return NextResponse.next();

  const demoSession = open<{ purpose: "session"; exp: number; sub: string; role?: string }>(request.cookies.get("foodoo_session")?.value, "session");
  const supabaseSession = Boolean(request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token")));
  const signedIn = isSupabaseMode() ? supabaseSession : Boolean(demoSession);
  const isPublic = PUBLIC_PATHS.has(pathname);
  const role = demoSession?.role ?? "investor";

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (signedIn && !isSupabaseMode()) {
    const api = pathname.startsWith("/api/");
    if (role === "seller" && pathname !== "/sell" && pathname !== "/menu" && !api) {
      const url = request.nextUrl.clone();
      url.pathname = "/sell";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if ((role === "admin" || role === "super-admin") && pathname !== "/admin" && pathname !== "/menu" && !api) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (role === "investor" && (pathname === "/sell" || pathname === "/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/overview";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
