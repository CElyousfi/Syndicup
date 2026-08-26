/**
 * Factory du rate limiter : Upstash si configuré (M0), mémoire sinon.
 * Les plafonds sont des paramètres TECHNIQUES (pas des valeurs légales) surchargables par env.
 */
import type { RateLimiter } from "./types";
import { memoryRateLimiter } from "./memory";
import { upstashRateLimiter } from "./upstash";

let limiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!limiter) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    limiter = url && token ? upstashRateLimiter(url, token) : memoryRateLimiter;
  }
  return limiter;
}

/** Réservé aux tests : force la re-résolution de l'implémentation. */
export function _resetRateLimiterFactory(): void {
  limiter = null;
}

function envInt(nom: string, defaut: number): number {
  const v = Number(process.env[nom]);
  return Number.isFinite(v) && v > 0 ? v : defaut;
}

/** Plafonds par catégorie — Master Spec Partie 3.4, surchargables par env (techniques). */
export const RATE_LIMITS = {
  /** OTP : 5 / heure / numéro (Partie 3.4 "Auth (OTP request)"). */
  otpRequest: () => ({ max: envInt("RATE_LIMIT_OTP_REQUEST_MAX", 5), windowMs: 60 * 60_000 }),
  /** Vérification OTP / login : borne les tentatives de force brute. */
  authAttempt: () => ({ max: envInt("RATE_LIMIT_AUTH_MAX", 10), windowMs: 15 * 60_000 }),
  /** Écriture financière : 30 / minute / utilisateur (Partie 3.4). */
  ecritureFinanciere: () => ({ max: envInt("RATE_LIMIT_FINANCE_MAX", 30), windowMs: 60_000 }),
  /** Webhook CMI : par IP — la vraie authentification est la signature HMAC. */
  webhookCmi: () => ({ max: envInt("RATE_LIMIT_CMI_WEBHOOK_MAX", 120), windowMs: 60_000 }),
} as const;
