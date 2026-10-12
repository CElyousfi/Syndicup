/**
 * M26 — Activités en direct : un téléphone suit un objet et reçoit ses changements d'état sans
 * ouvrir l'app — Live Activity / île dynamique sur iOS, notification persistante à progression
 * sur Android. Trois objets : la séance d'AG (résolution en cours, votes), une ligne d'appel de
 * fonds (dû → payé), un incident (ouvert → en cours → résolu).
 *
 * Le téléphone s'inscrit (`POST /users/me/appareils/activite`) ; les mutations métier appellent
 * `pousserActivite` dans leur transaction (best-effort : un transport absent ou un jeton mort ne
 * fait jamais échouer l'écriture). L'état est un dictionnaire de chaînes (contrat stable, FR/AR
 * rendus par le téléphone — les libellés du résumé sont rendus ici dans la langue du destinataire).
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyeurBrutPush } from "./transports";
import { construireMessageActivite } from "./transports/fcm";
import { logger } from "../logging/logger";
import type { ActiviteDirectCreateInput } from "../users/schemas";

export { etatAgSeance, etatAppelDeFonds, etatIncident } from "./activites-compose";

export type TypeActivite = "AG_SEANCE" | "APPEL_DE_FONDS" | "INCIDENT";

function activitePublique(a: { id: string; type: string; objetId: string; plateforme: string; creeLe: Date; termineeLe: Date | null }) {
  return { id: a.id, type: a.type, objet_id: a.objetId, plateforme: a.plateforme, cree_le: a.creeLe, terminee_le: a.termineeLe };
}

/** POST /users/me/appareils/activite — idempotent par (utilisateur, type, objet, plateforme) : le jeton est rafraîchi. */
export async function enregistrerActivite(ctx: TenantContext, input: ActiviteDirectCreateInput) {
  return withTenant(ctx, async (db) => {
    const a = await db.activiteEnDirect.upsert({
      where: { utilisateurId_type_objetId_plateforme: { utilisateurId: ctx.utilisateurId, type: input.type, objetId: input.objet_id, plateforme: input.plateforme } },
      create: { utilisateurId: ctx.utilisateurId, coproprieteId: ctx.coproprieteId, type: input.type, objetId: input.objet_id, token: input.token, plateforme: input.plateforme },
      update: { token: input.token, termineeLe: null },
    });
    return activitePublique(a);
  });
}

/** DELETE /users/me/appareils/activite/:id — l'utilisateur a fermé l'activité. */
export async function terminerActivite(ctx: TenantContext, id: string) {
  return withTenant(ctx, async (db) => {
    const r = await db.activiteEnDirect.deleteMany({ where: { id, utilisateurId: ctx.utilisateurId } });
    return { supprime: r.count > 0 };
  });
}

export interface MiseAJourActivite {
  type: TypeActivite;
  objetId: string;
  /** État poussé tel quel (chaînes) — même contrat que l'affichage mobile. */
  etat: Record<string, string>;
  /** Dernière mise à jour : l'activité se termine (iOS `end`, Android notification retirée après un dernier affichage). */
  fin?: boolean;
  /** Résumé lisible (bannière Android, alerte de l'activité iOS) — par langue. */
  titre: { FR: string; AR: string };
  corps: { FR: string; AR: string };
  /** Restreindre aux destinataires (ex. le propriétaire du lot) ; sinon tous les suiveurs de l'objet. */
  utilisateurIds?: string[];
}

/**
 * Pousse une mise à jour à tous les téléphones qui suivent l'objet (lecture RLS : membres de la
 * copropriété courante). Jamais bloquant pour l'appelant.
 */
export async function pousserActivite(db: TenantDb, ctx: TenantContext, maj: MiseAJourActivite): Promise<{ envoyes: number }> {
  const envoyer = envoyeurBrutPush();
  let envoyes = 0;
  try {
    const suiveurs = await db.activiteEnDirect.findMany({
      where: { coproprieteId: ctx.coproprieteId, type: maj.type, objetId: maj.objetId, termineeLe: null, ...(maj.utilisateurIds ? { utilisateurId: { in: maj.utilisateurIds } } : {}) },
      select: { id: true, token: true, plateforme: true, utilisateurId: true, utilisateur: { select: { languePreferee: true } } },
    });
    if (!suiveurs.length) return { envoyes: 0 };
    const morts: string[] = [];
    for (const s of suiveurs) {
      const langue = (s.utilisateur.languePreferee ?? "FR") as "FR" | "AR";
      const message = construireMessageActivite(s, { type: maj.type, objetId: maj.objetId, etat: maj.etat, fin: maj.fin ?? false, titre: maj.titre[langue], corps: maj.corps[langue] });
      if (!envoyer) continue;
      const r = await envoyer(message);
      if (r.ok) envoyes += 1;
      if (r.invalide) morts.push(s.id);
    }
    if (morts.length) await db.activiteEnDirect.deleteMany({ where: { id: { in: morts } } });
    if (maj.fin) await db.activiteEnDirect.updateMany({ where: { id: { in: suiveurs.map((s) => s.id) } }, data: { termineeLe: new Date() } });
  } catch (e) {
    logger.warn("Activité en direct : mise à jour impossible", { type: maj.type, objet_id: maj.objetId, erreur: e instanceof Error ? e.message : String(e) });
  }
  return { envoyes };
}
