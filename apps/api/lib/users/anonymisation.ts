/**
 * M13 — Anonymisation CNDP (Loi 09-08, Master Spec Partie 5.6/10.1).
 *
 * Anonymiser ≠ supprimer : les PII (`nom`, `prenom`, `email`, `telephone`, `raison_sociale`,
 * `rc_numero`) passent à NULL et le compte devient ANONYMISE, mais TOUTES les lignes
 * financières, votes et PV liées à l'utilisateur_id sont CONSERVÉES (intégrité comptable et
 * légale — 10 ans, Doc A §12.3). Prérequis : statut_compte = DESACTIVE.
 *
 * Deux chemins :
 *   - endpoint manuel POST /users/:id/anonymize (syndic/super_admin, demande explicite de la
 *     personne concernée) — `anonymiserUtilisateur` ;
 *   - job Inngest mensuel `executerAnonymisationCndp` : anonymise les comptes DESACTIVE dont
 *     la rétention est écoulée. ⚠️ `copropriete.retention_desactivation_mois` est LÉGALEMENT
 *     GATÉ (LEGAL_QUESTIONS_BRIEF §5) : toute copropriété non configurée est SAUTÉE (loggée),
 *     jamais de durée devinée — même discipline que les 422 du module AG.
 */
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { logger } from "../logging/logger";
import { PermissionRefuseeError, UtilisateurIntrouvableError } from "./users";

export class ContrainteMetierError extends Error {}

/** Acteur système conventionnel (jobs) — même convention que le webhook CMI / escalade. */
const ACTEUR_SYSTEME = "00000000-0000-0000-0000-000000000000";

async function anonymiserDansTransaction(
  db: TenantDb,
  ctx: TenantContext,
  utilisateurId: string,
  acteurId: string | null
) {
  const u = await db.utilisateur.findUnique({ where: { id: utilisateurId } });
  if (!u) throw new UtilisateurIntrouvableError("Utilisateur introuvable.");
  if (u.statutCompte === "ANONYMISE") {
    // Idempotent : déjà anonymisé — renvoyer l'état sans ré-écrire.
    return { utilisateur_id: u.id, statut_compte: u.statutCompte, anonymise_le: u.anonymiseLe };
  }
  if (u.statutCompte !== "DESACTIVE") {
    throw new ContrainteMetierError(
      `Anonymisation refusée : statut_compte=${u.statutCompte} — seul un compte DESACTIVE est anonymisable (machine à états Partie 5.2).`
    );
  }

  const maj = await db.utilisateur.update({
    where: { id: utilisateurId },
    data: {
      nom: null,
      prenom: null,
      email: null,
      telephone: null,
      raisonSociale: null,
      rcNumero: null,
      statutCompte: "ANONYMISE",
      anonymiseLe: new Date(),
    },
  });

  await ecrireAuditLog(db, {
    coproprieteId: ctx.coproprieteId,
    acteurId,
    action: "ANONYMISATION_CNDP",
    entite: "utilisateur",
    entiteId: utilisateurId,
    // Pas de PII dans l'audit : on trace le FAIT de l'anonymisation, jamais les valeurs effacées.
    apres: { statut_compte: "ANONYMISE", anonymise_le: maj.anonymiseLe?.toISOString() },
  });

  return { utilisateur_id: maj.id, statut_compte: maj.statutCompte, anonymise_le: maj.anonymiseLe };
}

/** Endpoint manuel — syndic/super_admin sur un membre DESACTIVE de sa copropriété. */
export async function anonymiserUtilisateur(ctx: TenantContext, utilisateurId: string) {
  if (can("users.anonymiser", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic (ou super_admin) peut anonymiser un compte.");
  }
  return withTenant(ctx, (db) =>
    anonymiserDansTransaction(db, ctx, utilisateurId, ctx.utilisateurId)
  );
}

/** Valeur de remplacement du nom du voyageur principal après anonymisation (M15). */
export const ANONYME_VOYAGEUR = "Voyageur anonymisé";

export interface ResultatAnonymisation {
  coproprietesTraitees: number;
  /** M15 — séjours LCD dont les données voyageur ont été effacées. */
  sejoursAnonymises: number;
  coproprietesSautees: { coproprieteId: string; raison: string }[];
  utilisateursAnonymises: string[];
  erreurs: { utilisateurId: string; erreur: string }[];
}

/**
 * Job mensuel : pour chaque copropriété CONFIGURÉE (retention_desactivation_mois non null),
 * anonymise les comptes DESACTIVE dont desactive_le + rétention est échu, à condition que
 * TOUTES les copropriétés où l'utilisateur a des rôles soient configurées et échues (un
 * utilisateur multi-copropriétés n'est anonymisé que quand plus personne n'a besoin de lui).
 */
export async function executerAnonymisationCndp(): Promise<ResultatAnonymisation> {
  const { PrismaClient } = await import("@prisma/client");
  // DIRECT_URL (BYPASSRLS) : lecture transverse d'inventaire uniquement — les ÉCRITURES passent
  // par withTenant + RLS ci-dessous, même pattern que executerEscaladeImpayesToutesCoproprietes.
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const resultat: ResultatAnonymisation = {
    coproprietesTraitees: 0,
    sejoursAnonymises: 0,
    coproprietesSautees: [],
    utilisateursAnonymises: [],
    erreurs: [],
  };
  try {
    const maintenant = Date.now();
    const candidats = await raw.utilisateur.findMany({
      where: { statutCompte: "DESACTIVE", anonymiseLe: null },
      select: {
        id: true,
        desactiveLe: true,
        roles: { select: { coproprieteId: true, copropriete: { select: { retentionDesactivationMois: true } } } },
      },
    });

    const coproSautees = new Set<string>();
    for (const u of candidats) {
      if (!u.desactiveLe) {
        resultat.erreurs.push({
          utilisateurId: u.id,
          erreur: "desactive_le absent — impossible de calculer la rétention.",
        });
        continue;
      }
      if (u.roles.length === 0) continue;

      let eligible = true;
      for (const r of u.roles) {
        const retention = r.copropriete.retentionDesactivationMois;
        if (retention == null) {
          // Valeur légale non confirmée pour cette copropriété : on saute (discipline 422).
          if (!coproSautees.has(r.coproprieteId)) {
            coproSautees.add(r.coproprieteId);
            resultat.coproprietesSautees.push({
              coproprieteId: r.coproprieteId,
              raison: "retention_desactivation_mois non configurée (LEGAL_QUESTIONS_BRIEF §5).",
            });
            logger.warn("Anonymisation CNDP sautée — rétention non configurée", {
              copropriete_id: r.coproprieteId,
            });
          }
          eligible = false;
          continue;
        }
        const echeance = new Date(u.desactiveLe);
        echeance.setMonth(echeance.getMonth() + retention);
        if (echeance.getTime() > maintenant) eligible = false;
      }
      if (!eligible) continue;

      // Anonymisation via le contexte tenant de la PREMIÈRE copropriété (l'update de la table
      // globale `utilisateur` est unique) ; audit écrit dans chacune des copropriétés.
      try {
        const premiere = u.roles[0]!.coproprieteId;
        const ctxSysteme: TenantContext = {
          utilisateurId: ACTEUR_SYSTEME,
          coproprieteId: premiere,
          role: "SUPER_ADMIN",
        };
        await withTenant(ctxSysteme, (db) =>
          anonymiserDansTransaction(db, ctxSysteme, u.id, null)
        );
        for (const r of u.roles.slice(1)) {
          const ctxAudit: TenantContext = {
            utilisateurId: ACTEUR_SYSTEME,
            coproprieteId: r.coproprieteId,
            role: "SUPER_ADMIN",
          };
          await withTenant(ctxAudit, (db) =>
            ecrireAuditLog(db, {
              coproprieteId: r.coproprieteId,
              acteurId: null,
              action: "ANONYMISATION_CNDP",
              entite: "utilisateur",
              entiteId: u.id,
              apres: { statut_compte: "ANONYMISE" },
            })
          );
        }
        resultat.utilisateursAnonymises.push(u.id);
      } catch (e) {
        resultat.erreurs.push({
          utilisateurId: u.id,
          erreur: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const coproConfigurees = new Set(
      candidats.flatMap((u) =>
        u.roles
          .filter((r) => r.copropriete.retentionDesactivationMois != null)
          .map((r) => r.coproprieteId)
      )
    );
    resultat.coproprietesTraitees = coproConfigurees.size;

    // M15 — données voyageur des séjours LCD (CNDP, minimisation) : même rétention que les
    // comptes (retention_desactivation_mois, PROVISOIRE — LEGAL_QUESTIONS_BRIEF §7), à partir de
    // la date de départ ; copropriété non configurée = sautée, jamais de durée devinée.
    const coprosLcd = await raw.copropriete.findMany({
      where: { retentionDesactivationMois: { not: null }, sejoursLcd: { some: { voyageurPrincipalNom: { not: ANONYME_VOYAGEUR } } } },
      select: { id: true, retentionDesactivationMois: true },
    });
    for (const c of coprosLcd) {
      const limite = new Date(maintenant);
      limite.setMonth(limite.getMonth() - (c.retentionDesactivationMois ?? 0));
      const ctxSysteme: TenantContext = { utilisateurId: ACTEUR_SYSTEME, coproprieteId: c.id, role: "SUPER_ADMIN" };
      try {
        const n = await withTenant(ctxSysteme, async (db) => {
          const cibles = await db.sejourCourteDuree.findMany({
            where: { coproprieteId: c.id, statut: { in: ["TERMINE", "ANNULE"] }, dateDepart: { lt: limite }, voyageurPrincipalNom: { not: ANONYME_VOYAGEUR } },
            select: { id: true },
          });
          if (cibles.length === 0) return 0;
          await db.sejourCourteDuree.updateMany({
            where: { id: { in: cibles.map((s) => s.id) } },
            data: { voyageurPrincipalNom: ANONYME_VOYAGEUR, voyageurTelephone: null, voyageurNationalite: null, pieceIdentiteType: null, pieceIdentiteFin: null, plaqueVehicule: null },
          });
          for (const s of cibles) {
            await ecrireAuditLog(db, {
              coproprieteId: c.id,
              acteurId: null,
              action: "ANONYMISATION_CNDP",
              entite: "sejour_courte_duree",
              entiteId: s.id,
              apres: { voyageur: "ANONYMISE" },
            });
          }
          return cibles.length;
        });
        resultat.sejoursAnonymises += n;
      } catch (e) {
        resultat.erreurs.push({ utilisateurId: `sejours:${c.id}`, erreur: e instanceof Error ? e.message : String(e) });
      }
    }
    return resultat;
  } finally {
    await raw.$disconnect();
  }
}
