/**
 * Application du rate limiting dans une route : renvoie une Response 429 (enveloppe
 * RATE_LIMITED + Retry-After) si la limite est atteinte, null sinon.
 */
import { fail } from "../http/respond";
import { getRateLimiter } from "./index";

export async function enforceRateLimit(
  req: Request,
  bucket: string,
  opts: { max: number; windowMs: number },
  identifiant?: string
): Promise<Response | null> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-inconnue";
  const key = `${bucket}:${identifiant ?? ip}`;
  const decision = await getRateLimiter().limit(key, opts);
  if (decision.allowed) return null;
  const res = fail("RATE_LIMITED", "Trop de requêtes — réessayez plus tard.");
  const headers = new Headers(res.headers);
  headers.set("Retry-After", String(decision.retryAfterSec ?? 60));
  return new Response(res.body, { status: res.status, headers });
}
