/**
 * Application du rate limiting dans une route : renvoie une Response 429 (enveloppe
 * RATE_LIMITED + Retry-After) si la limite est atteinte, null sinon.
 */
import { fail, avecRetryAfter } from "../http/respond";
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
  const secondes = decision.retryAfterSec ?? 60;
  return avecRetryAfter(
    fail("RATE_LIMITED", `Trop de requêtes — réessayez dans ${dureeLisible(secondes)}.`),
    secondes
  );
}

function dureeLisible(secondes: number): string {
  if (secondes < 60) return `${Math.max(1, Math.ceil(secondes))} s`;
  const minutes = Math.ceil(secondes / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
