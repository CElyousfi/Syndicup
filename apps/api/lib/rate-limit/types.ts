/**
 * Rate limiting applicatif (Master Spec Partie 3.4) — interface commune aux implémentations
 * mémoire (défaut) et Upstash Redis (env-gated, M0).
 */
export interface RateLimitDecision {
  allowed: boolean;
  /** Secondes avant réessai (header Retry-After) quand refusé. */
  retryAfterSec?: number;
}

export interface RateLimiter {
  limit(key: string, opts: { max: number; windowMs: number }): Promise<RateLimitDecision>;
}
