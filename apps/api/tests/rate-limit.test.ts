/**
 * Tests M12 — rate limiting applicatif (Master Spec Partie 3.4).
 * Unitaires (pas de DB) : limiteur mémoire (fenêtre glissante), enveloppe 429 + Retry-After.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { memoryRateLimiter, _resetMemoryRateLimiter } from "../lib/rate-limit/memory";
import { enforceRateLimit } from "../lib/rate-limit/apply";
import { RATE_LIMITS } from "../lib/rate-limit";

beforeEach(() => _resetMemoryRateLimiter());

describe("memoryRateLimiter", () => {
  it("autorise jusqu'à max puis refuse avec un Retry-After", async () => {
    const opts = { max: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      expect((await memoryRateLimiter.limit("k", opts)).allowed).toBe(true);
    }
    const refus = await memoryRateLimiter.limit("k", opts);
    expect(refus.allowed).toBe(false);
    expect(refus.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("isole les clés entre elles", async () => {
    const opts = { max: 1, windowMs: 60_000 };
    expect((await memoryRateLimiter.limit("a", opts)).allowed).toBe(true);
    expect((await memoryRateLimiter.limit("b", opts)).allowed).toBe(true);
    expect((await memoryRateLimiter.limit("a", opts)).allowed).toBe(false);
  });
});

describe("enforceRateLimit", () => {
  it("renvoie null sous la limite, puis une 429 enveloppée avec Retry-After", async () => {
    const req = new Request("http://x/y", { headers: { "x-forwarded-for": "1.2.3.4" } });
    const opts = { max: 1, windowMs: 60_000 };
    expect(await enforceRateLimit(req, "test-bucket", opts)).toBeNull();
    const res = await enforceRateLimit(req, "test-bucket", opts);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("retry-after")).toBeTruthy();
    const body = await res!.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("sépare par identifiant explicite (téléphone/utilisateur), pas seulement par IP", async () => {
    const req = new Request("http://x/y", { headers: { "x-forwarded-for": "1.2.3.4" } });
    const opts = { max: 1, windowMs: 60_000 };
    expect(await enforceRateLimit(req, "b", opts, "+212600000001")).toBeNull();
    expect(await enforceRateLimit(req, "b", opts, "+212600000002")).toBeNull();
    expect(await enforceRateLimit(req, "b", opts, "+212600000001")).not.toBeNull();
  });
});

describe("RATE_LIMITS (env-surchargables)", () => {
  it("expose des défauts sains et lit la surcharge env", () => {
    expect(RATE_LIMITS.otpRequest().max).toBe(5);
    process.env.RATE_LIMIT_OTP_REQUEST_MAX = "9";
    expect(RATE_LIMITS.otpRequest().max).toBe(9);
    delete process.env.RATE_LIMIT_OTP_REQUEST_MAX;
  });
});
