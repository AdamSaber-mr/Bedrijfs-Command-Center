// Gedeeld tussen de datalaag (lib/auth.ts) en de proxy (proxy.ts). Sinds
// Next.js 16 draait de proxy op de Node-runtime; deze losse module bestaat
// vooral om constanten licht te delen zonder de hele auth-laag te importeren.
export const SESSION_COOKIE = "vantage_session";

// Publieke paden die zonder sessie bereikbaar zijn.
export const PUBLIC_PATHS = ["/login", "/register", "/reset"];
