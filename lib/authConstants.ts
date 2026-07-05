// Gedeeld tussen de Node-serverlaag (lib/auth.ts) en de edge-proxy (proxy.ts).
// Hier bewust GEEN imports van fs/next-headers, zodat dit ook op de edge werkt.
export const SESSION_COOKIE = "vantage_session";

// Publieke paden die zonder sessie bereikbaar zijn.
export const PUBLIC_PATHS = ["/login", "/register"];
