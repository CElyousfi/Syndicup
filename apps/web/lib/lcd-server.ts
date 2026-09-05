/**
 * Aides SERVEUR du module Location courte durée — accès API (Server Components uniquement).
 * Séparé de `lib/lcd.ts`, importable par les composants client (aucun accès réseau ici).
 */
import { apiFetch } from "./api/client";
import type { MembreCopropriete } from "./api/types";
import { annuaireMembres } from "./membres";
import { nomComplet } from "./format";
import type { VueLcd } from "./lcd";

/**
 * Noms des membres pour l'affichage (déclarant, gestionnaire, acteur du journal). Le syndic
 * lit l'annuaire complet (GET /users — inclut les gestionnaires LCD, jamais rattachés à un
 * lot) ; les autres rôles se contentent des rattachements de lots visibles par eux.
 */
export async function nomsMembres(vue: VueLcd): Promise<Map<string, string>> {
  if (vue === "gestion") {
    const res = await apiFetch<MembreCopropriete[]>("/users", { searchParams: { limit: 200 } });
    if (res.ok) {
      return new Map(
        res.data.map((u) => [u.id, nomComplet(u) ?? u.raison_sociale ?? u.id.slice(0, 8)])
      );
    }
  }
  if (vue === "aucune") return new Map();
  try {
    return new Map((await annuaireMembres()).map((m) => [m.id, m.nom]));
  } catch {
    return new Map();
  }
}
