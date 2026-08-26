/**
 * Limiteur en mémoire (fenêtre glissante) — implémentation par défaut.
 * ⚠️ Limite connue et assumée : l'état est PAR INSTANCE (serverless : par lambda chaude) et
 * disparaît au redéploiement. Suffisant avant lancement public ; pour une limite globale
 * multi-instances, configurer Upstash (UPSTASH_REDIS_REST_URL/TOKEN — voir upstash.ts).
 */
import type { RateLimiter, RateLimitDecision } from "./types";

const buckets = new Map<string, number[]>();
let dernierNettoyage = Date.now();

function nettoyer(maintenant: number, windowMs: number): void {
  // Purge paresseuse pour borner la mémoire (pas de setInterval en serverless).
  if (maintenant - dernierNettoyage < 60_000) return;
  dernierNettoyage = maintenant;
  for (const [key, hits] of buckets) {
    const vivants = hits.filter((t) => maintenant - t < windowMs);
    if (vivants.length === 0) buckets.delete(key);
    else buckets.set(key, vivants);
  }
}

export const memoryRateLimiter: RateLimiter = {
  async limit(key, { max, windowMs }): Promise<RateLimitDecision> {
    const maintenant = Date.now();
    nettoyer(maintenant, windowMs);
    const hits = (buckets.get(key) ?? []).filter((t) => maintenant - t < windowMs);
    if (hits.length >= max) {
      const plusAncien = Math.min(...hits);
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((plusAncien + windowMs - maintenant) / 1000)),
      };
    }
    hits.push(maintenant);
    buckets.set(key, hits);
    return { allowed: true };
  },
};

/** Réservé aux tests : vide l'état du limiteur. */
export function _resetMemoryRateLimiter(): void {
  buckets.clear();
}
