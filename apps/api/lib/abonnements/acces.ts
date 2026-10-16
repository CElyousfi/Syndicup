/**
 * Contrôle d'accès par abonnement (M29) — appliqué à chaque requête tenant (lib/http/request-context).
 *
 *  - Résidence sans abonnement : accès normal (clients historiques, démos) — signalée à l'opérateur.
 *  - Niveau BLOQUE : toute requête de la résidence répond 402 ABONNEMENT_SUSPENDU, sauf les routes
 *    nécessaires pour AFFICHER l'écran de suspension (profil, état d'abonnement, version d'app).
 *  - L'opérateur (SUPER_ADMIN) n'est jamais bloqué.
 *
 * Lecture sous le contexte tenant de la résidence (policy RLS `lecture_copropriete_courante`),
 * mise en cache 60 s par résidence ; toute action de la console invalide le cache.
 */
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { etatAcces, type EtatAcces } from "./etat";
import { routeLibre } from "./routes-libres";

export class AbonnementBloqueError extends Error {
  constructor(public etat: EtatAcces) {
    super(
      etat.etat === "RESILIE"
        ? "L'abonnement SyndicUp de cette résidence est résilié."
        : "L'accès à cette résidence est suspendu : l'abonnement SyndicUp n'est pas à jour. Le syndic peut contacter SyndicUp pour le réactiver."
    );
  }
}

export interface AbonnementCourant {
  etat: EtatAcces;
  abonnement: {
    id: string;
    statut: "ESSAI" | "ACTIF" | "SUSPENDU" | "RESILIE";
    formule: string;
    periodicite: string;
    fin_essai: string | null;
    fin_periode: string | null;
  } | null;
}

const TTL_MS = 60_000;
type Ligne = {
  id: string;
  statut: "ESSAI" | "ACTIF" | "SUSPENDU" | "RESILIE";
  formule: string;
  periodicite: string;
  finEssai: Date | null;
  finPeriode: Date | null;
  delaiGraceJours: number;
  accesProlongeJusquAu: Date | null;
};
/** Cache de la LECTURE en base (pas de l'état : il dépend de la date et est recalculé à chaque appel). */
const cache = new Map<string, { expire: number; ligne: Ligne | null }>();

export function invaliderCacheAcces(coproprieteIds?: string[]) {
  if (!coproprieteIds) {
    cache.clear();
    return;
  }
  for (const id of coproprieteIds) cache.delete(id);
}

async function lire(ctx: TenantContext): Promise<Ligne | null> {
  const hit = cache.get(ctx.coproprieteId);
  if (hit && hit.expire > Date.now()) return hit.ligne;
  const lien = await withTenant(ctx, (db) =>
    db.abonnementCopropriete.findFirst({
      where: { coproprieteId: ctx.coproprieteId, actif: true },
      select: {
        abonnement: {
          select: { id: true, statut: true, formule: true, periodicite: true, finEssai: true, finPeriode: true, delaiGraceJours: true, accesProlongeJusquAu: true },
        },
      },
    })
  );
  const ligne = lien?.abonnement ?? null;
  cache.set(ctx.coproprieteId, { expire: Date.now() + TTL_MS, ligne });
  return ligne;
}

export async function abonnementDeLaCopropriete(ctx: TenantContext, maintenant = new Date()): Promise<AbonnementCourant> {
  const a = await lire(ctx);
  if (!a) return { etat: etatAcces(null, maintenant), abonnement: null };
  return {
    etat: etatAcces(a, maintenant),
    abonnement: {
      id: a.id,
      statut: a.statut,
      formule: a.formule,
      periodicite: a.periodicite,
      fin_essai: a.finEssai ? a.finEssai.toISOString().slice(0, 10) : null,
      fin_periode: a.finPeriode ? a.finPeriode.toISOString().slice(0, 10) : null,
    },
  };
}

export async function verifierAccesAbonnement(ctx: TenantContext, req: Request): Promise<void> {
  if (ctx.role === "SUPER_ADMIN") return;
  if (routeLibre(new URL(req.url).pathname)) return;
  const { etat } = await abonnementDeLaCopropriete(ctx);
  if (etat.niveau === "BLOQUE") throw new AbonnementBloqueError(etat);
}

/** Rôles qui gèrent la résidence (voient le détail de l'abonnement et les rappels). */
export const ROLES_GESTION = new Set(["SYNDIC", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE"]);

/** GET /v1/abonnement — vue « résidence » : les gestionnaires voient le détail, les autres seulement le niveau. */
export async function etatPourLaResidence(ctx: TenantContext) {
  const { etat, abonnement } = await abonnementDeLaCopropriete(ctx);
  const gestion = ROLES_GESTION.has(ctx.role) || ctx.role === "SUPER_ADMIN";
  return {
    niveau: etat.niveau,
    etat: etat.etat,
    gestionnaire: gestion,
    date_blocage: gestion ? etat.date_blocage : null,
    jours_avant_blocage: gestion ? etat.jours_avant_blocage : null,
    echeance: gestion ? etat.echeance : null,
    jours_avant_echeance: gestion ? etat.jours_avant_echeance : null,
    abonnement: gestion && abonnement ? { statut: abonnement.statut, formule: abonnement.formule, periodicite: abonnement.periodicite } : null,
    contact: {
      email: process.env.ABONNEMENTS_CONTACT_EMAIL ?? null,
      whatsapp: process.env.ABONNEMENTS_CONTACT_WHATSAPP ?? null,
    },
  };
}
