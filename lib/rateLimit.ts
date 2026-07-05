// Eenvoudige in-memory rate-limiter tegen brute-force op inloggen.
// Bewust in het geheugen (reset bij herstart) — prima voor een lokale app.
type Bucket = { count: number; first: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minuten
const MAX_FAILURES = 5;

// Retourneert of de sleutel nog mag proberen, en zo niet: over hoeveel seconden weer.
export function checkRateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.first > WINDOW_MS) return { ok: true, retryAfter: 0 };
  if (bucket.count >= MAX_FAILURES) {
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - bucket.first)) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.first > WINDOW_MS) {
    buckets.set(key, { count: 1, first: now });
  } else {
    bucket.count++;
  }
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
