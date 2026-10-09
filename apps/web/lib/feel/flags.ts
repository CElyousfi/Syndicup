/**
 * Drapeaux d'interface publics (GET /v1/config/client) lus CÔTÉ SERVEUR par la mise en page —
 * jamais d'attente réseau longue : la dernière valeur connue est servie aussitôt et rafraîchie en
 * arrière-plan (au plus une fois par minute, comme le cache de l'API). Sans aucune valeur (API
 * injoignable au premier rendu), `source = "default"` : le script d'amorçage du navigateur
 * applique alors la dernière valeur mémorisée sur l'appareil, sinon le défaut (ON).
 */
import { API_BASE_URL } from "../config/env";

export interface ClientFlags {
  alive_v1: boolean;
}
export type FlagSource = "api" | "default";

export const DEFAULT_CLIENT_FLAGS: ClientFlags = { alive_v1: true };

const TTL_MS = 60_000;
const DELAI_MS = 1_200;

let memo: { flags: ClientFlags; at: number } | null = null;
let enCours: Promise<void> | null = null;

async function charger(fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    const r = await fetchImpl(`${API_BASE_URL}/config/client`, { cache: "no-store", signal: AbortSignal.timeout(DELAI_MS) });
    if (!r.ok) return;
    const body = (await r.json()) as { data?: { flags?: Record<string, unknown> } };
    const f = body.data?.flags ?? {};
    memo = {
      flags: { alive_v1: typeof f.alive_v1 === "boolean" ? f.alive_v1 : (memo?.flags.alive_v1 ?? DEFAULT_CLIENT_FLAGS.alive_v1) },
      at: Date.now(),
    };
  } catch (e) {
    // API injoignable : la dernière valeur connue reste en vigueur (jamais d'exception au rendu).
    console.warn(JSON.stringify({ niveau: "warn", message: "config/client injoignable", erreur: String(e) }));
  }
}

export async function getClientFlags(fetchImpl?: typeof fetch): Promise<{ flags: ClientFlags; source: FlagSource }> {
  const frais = memo && Date.now() - memo.at < TTL_MS;
  if (!frais) {
    enCours ??= charger(fetchImpl).finally(() => {
      enCours = null;
    });
    // Valeur déjà connue : on la sert sans attendre (rafraîchissement en arrière-plan).
    if (!memo) await enCours;
  }
  return memo ? { flags: memo.flags, source: "api" } : { flags: DEFAULT_CLIENT_FLAGS, source: "default" };
}

/** Tests uniquement. */
export function __resetClientFlags() {
  memo = null;
  enCours = null;
}
