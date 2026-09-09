/**
 * M0 — configuration d'environnement (lib/config/env.ts) : erreurs par variable, obligatoires en
 * production seulement, APP_ENV avec repli NODE_ENV, repli déprécié RESEND_FROM_EMAIL (une fois
 * loggé), Upstash exigé en production par le rate limiter, CMI en 501 tant qu'absent.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetDeprecationResend, appEnvDe, cmiEstConfigure, EnvironnementInvalideError, parseEnv, resendFromDe } from "../lib/config/env";
import { _resetRateLimiterFactory, getRateLimiter } from "../lib/rate-limit";
import { memoryRateLimiter } from "../lib/rate-limit/memory";
import { logger } from "../lib/logging/logger";

const DEV = { NODE_ENV: "development", DATABASE_URL: "postgresql://x", DIRECT_URL: "postgresql://x" };
const PROD_OK = {
  APP_ENV: "production",
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://app_prod:x@host/db",
  DIRECT_URL: "postgresql://postgres:x@host/db",
  JWT_SECRET: "s".repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  INNGEST_EVENT_KEY: "ev",
  INNGEST_SIGNING_KEY: "sk",
  NEXT_PUBLIC_APP_URL: "https://app.syndicup.ma",
  UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "tok",
};

afterEach(() => {
  vi.restoreAllMocks();
  _resetDeprecationResend();
  _resetRateLimiterFactory();
});

describe("lib/config/env", () => {
  it("développement : rien d'obligatoire, formats vérifiés quand présents (un message par variable)", () => {
    expect(() => parseEnv(DEV)).not.toThrow();
    try {
      parseEnv({ ...DEV, NEXT_PUBLIC_SUPABASE_URL: "pas-une-url", JWT_SECRET: "court", SMTP_URL: "http://x", UPSTASH_REDIS_REST_URL: "https://u.upstash.io" });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect(e).toBeInstanceOf(EnvironnementInvalideError);
      const p = (e as EnvironnementInvalideError).problemes;
      expect(p.some((m) => m.startsWith("NEXT_PUBLIC_SUPABASE_URL"))).toBe(true);
      expect(p.some((m) => m.startsWith("JWT_SECRET"))).toBe(true);
      expect(p.some((m) => m.startsWith("SMTP_URL"))).toBe(true);
      expect(p.some((m) => m.includes("UPSTASH_REDIS_REST_TOKEN"))).toBe(true);
      expect((e as Error).message).toContain("JWT_SECRET : au moins 32 caractères");
    }
  });

  it("production : chaque variable obligatoire manquante est nommée ; INNGEST_DEV interdit ; config complète acceptée", () => {
    try {
      parseEnv({ APP_ENV: "production", INNGEST_DEV: "1" });
      throw new Error("aurait dû lever");
    } catch (e) {
      const p = (e as EnvironnementInvalideError).problemes;
      for (const nom of ["DATABASE_URL", "DIRECT_URL", "JWT_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY", "NEXT_PUBLIC_APP_URL", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
        expect(p.some((m) => m.startsWith(`${nom} :`))).toBe(true);
      }
      expect(p.some((m) => m.startsWith("INNGEST_DEV"))).toBe(true);
    }
    expect(() => parseEnv(PROD_OK)).not.toThrow();
    // NODE_ENV=production sans APP_ENV compte comme production (APP_ENV alors exigé).
    expect(() => parseEnv({ ...PROD_OK, APP_ENV: "" })).toThrow(/APP_ENV : obligatoire/);
    // CMI reste optionnel en production.
    expect(cmiEstConfigure(PROD_OK)).toBe(false);
    expect(cmiEstConfigure({ CMI_WEBHOOK_HMAC_SECRET: "s" })).toBe(true);
  });

  it("APP_ENV : valeur explicite, sinon dérivé de NODE_ENV", () => {
    expect(appEnvDe({ APP_ENV: "staging", NODE_ENV: "production" })).toBe("staging");
    expect(appEnvDe({ NODE_ENV: "production" })).toBe("production");
    expect(appEnvDe({ NODE_ENV: "test" })).toBe("development");
    expect(appEnvDe({})).toBe("development");
  });

  it("RESEND_FROM prime ; RESEND_FROM_EMAIL encore lu avec un avertissement (une seule fois)", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(resendFromDe({ RESEND_FROM: "a@x.ma", RESEND_FROM_EMAIL: "b@x.ma" })).toBe("a@x.ma");
    expect(warn).not.toHaveBeenCalled();
    expect(resendFromDe({ RESEND_FROM_EMAIL: "b@x.ma" })).toBe("b@x.ma");
    expect(resendFromDe({ RESEND_FROM_EMAIL: "b@x.ma" })).toBe("b@x.ma");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("RESEND_FROM_EMAIL est déprécié");
    // Clé Resend sans adresse d'expédition : signalé.
    expect(() => parseEnv({ ...DEV, RESEND_API_KEY: "re_x" })).toThrow(/RESEND_FROM : requis/);
    expect(() => parseEnv({ ...DEV, RESEND_API_KEY: "re_x", RESEND_FROM_EMAIL: "b@x.ma" })).not.toThrow();
  });

  it("rate limiter : mémoire hors production sans Upstash, refus explicite en production", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("APP_ENV", "development");
    _resetRateLimiterFactory();
    expect(getRateLimiter()).toBe(memoryRateLimiter);
    vi.stubEnv("APP_ENV", "production");
    _resetRateLimiterFactory();
    expect(() => getRateLimiter()).toThrow(/UPSTASH_REDIS_REST_URL/);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://eu1-x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    _resetRateLimiterFactory();
    expect(getRateLimiter()).not.toBe(memoryRateLimiter);
    vi.unstubAllEnvs();
  });
});
