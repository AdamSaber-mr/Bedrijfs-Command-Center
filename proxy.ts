import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE } from "@/lib/authConstants";

// Proxy (voorheen "middleware") schermt de hele app af achter een sessie.
// Dit is een optimistische check op enkel de cookie; de echte validatie
// gebeurt server-side in de datalaag (lib/auth.ts).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthApi = pathname.startsWith("/api/auth");
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  if (!hasSession) {
    if (isAuthApi || isPublicPage) return NextResponse.next();
    // API-aanvragen krijgen 401 (geen redirect, dat verwart fetch).
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    }
    // Pagina's leiden naar de loginpagina, met een terugkeer-pad.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search =
      pathname && pathname !== "/" ? `?from=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  // Al ingelogd: houd de gebruiker weg van login/register.
  if (isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Draai op alles behalve Next-interne paden en bestanden met een extensie
  // (statics zoals /icon.svg, /manifest.webmanifest, afbeeldingen).
  matcher: ["/((?!_next|.*\\..*).*)"],
};
