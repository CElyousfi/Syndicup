/**
 * Limiteur Upstash Redis (REST, sans SDK) — activé quand UPSTASH_REDIS_REST_URL et
 * UPSTASH_REDIS_REST_TOKEN sont définis (provisioning M0). Fenêtre fixe via INCR+EXPIRE :
 * moins précis qu'une fenêtre glissante mais un seul round-trip, et global multi-instances.
 */
import type { RateLimiter, RateLimitDecision } from "./types";
import { logger } from "../logging/logger";

/**
 * Temps réel restant avant la réouverture : la clé Redis est indexée sur la fenêtre fixe
 * floor(t / windowMs), donc le compteur repart à zéro à la frontière suivante — pas une fenêtre
 * entière après le refus (ancien comportement : Retry-After = fenêtre complète).
 */
export function secondesAvantFinFenetre(maintenantMs: number, windowMs: number): number {
  const fin = (Math.floor(maintenantMs / windowMs) + 1) * windowMs;
  return Math.max(1, Math.ceil((fin - maintenantMs) / 1000));
}

export function upstashRateLimiter(url: string, token: string): RateLimiter {
  return {
    async limit(key, { max, windowMs }): Promise<RateLimitDecision> {
      const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
      const maintenant = Date.now();
      const fenetre = Math.floor(maintenant / windowMs);
      const redisKey = `rl:${key}:${fenetre}`;
      try {
        const res = await fetch(`${url}/pipeline`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify([
            ["INCR", redisKey],
            ["EXPIRE", redisKey, String(windowSec), "NX"],
          ]),
        });
        if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
        const rows = (await res.json()) as Array<{ result: number }>;
        const count = rows[0]?.result ?? 0;
        if (count > max) {
          return { allowed: false, retryAfterSec: secondesAvantFinFenetre(maintenant, windowMs) };
        }
        return { allowed: true };
      } catch (e) {
        // Fail-open : une panne Redis ne doit pas rendre l'API indisponible — loggée pour alerte.
        logger.warn("Rate limiter Upstash indisponible — requête autorisée (fail-open)", {
          erreur: e instanceof Error ? e.message : String(e),
        });
        return { allowed: true };
      }
    },
  };
}
