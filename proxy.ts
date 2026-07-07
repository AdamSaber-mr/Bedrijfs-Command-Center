import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE } from "@/lib/authConstants";
import { isValidSessionToken } from "@/lib/auth";

// Proxy (voorheen "middleware") schermt de hele app af achter een sessie.
// Sinds Next.js 16 draait de proxy standaard op de Node-runtime, dus we
// valideren het token hier écht tegen data/sessions.json (inclusief TTL) in
// plaats van alleen optimistisch te checken of de cookie bestaat. Verlopen of
// ingetrokken sessies gaan zo netjes terug naar /login (met opgeruimde cookie)
// in plaats van "leeg" te laden op louter 401's. De datalaag (lib/auth.ts)
// blijft per request de definitieve autoriteit.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? null;
  // Eén bestandslees per request; prima voor deze lokale app.
  const isLoggedIn = token !== null && (await isValidSessionToken(token));
  const isAuthApi = pathname.startsWith("/api/auth");
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  if (!isLoggedIn) {
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
    const response = NextResponse.redirect(url);
    // Aanwezige maar ongeldige/verlopen cookie meteen wissen, zodat de
    // browser geen dood token blijft meesturen.
    if (token !== null) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  // Al ingelogd (écht geldig token): houd de gebruiker weg van login/register.
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
