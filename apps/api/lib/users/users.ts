/**
 * M13 — Module utilisateurs (Master Spec Partie 5/10.1, Loi 09-08 CNDP) :
 * profil (droit d'accès + rectification), export des données personnelles, fiche syndic.
 * L'anonymisation vit dans ./anonymisation.ts (partagée avec le job Inngest mensuel).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type { RoleClaim } from "../tenant/jwt";
import { ecrireAuditLog } from "../audit/audit";
import type { ProfilUpdateInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class UtilisateurIntrouvableError extends Error {}

function profilPublic(u: {
  id: string;
  email: string | null;
  telephone: string | null;
  nom: string | null;
  prenom: string | null;
  languePreferee: string;
  statutCompte: string;
  raisonSociale: string | null;
}) {
  return {
    id: u.id,
    email: u.email,
    telephone: u.telephone,
    nom: u.nom,
    prenom: u.prenom,
    langue_preferee: u.languePreferee,
    statut_compte: u.statutCompte,
    raison_sociale: u.raisonSociale,
  };
}

/** GET /users/me — profil + rôles actifs (chaque claim vient du JWT vérifié). */
export async function obtenirMonProfil(ctx: TenantContext) {
  return withTenant(ctx, async (db) => {
    const u = await db.utilisateur.findUnique({ where: { id: ctx.utilisateurId } });
    if (!u) throw new UtilisateurIntrouvableError("Utilisateur introuvable.");
    const roles = await db.roleUtilisateur.findMany({
      where: { utilisateurId: ctx.utilisateurId },
      select: { coproprieteId: true, role: true, actif: true },
    });
    return {
      ...profilPublic(u),
      roles: roles.map((r) => ({
        copropriete_id: r.coproprieteId,
        role: r.role,
        actif: r.actif,
      })),
    };
  });
}

/** PATCH /users/me — rectification CNDP (nom/prenom/langue uniquement). */
export async function modifierMonProfil(ctx: TenantContext, input: ProfilUpdateInput) {
  return withTenant(ctx, async (db) => {
    const avant = await db.utilisateur.findUnique({ where: { id: ctx.utilisateurId } });
    if (!avant) throw new UtilisateurIntrouvableError("Utilisateur introuvable.");
    const maj = await db.utilisateur.update({
      where: { id: ctx.utilisateurId },
      data: {
        ...(input.nom !== undefined ? { nom: input.nom } : {}),
        ...(input.prenom !== undefined ? { prenom: input.prenom } : {}),
        ...(input.langue_preferee !== undefined ? { languePreferee: input.langue_preferee } : {}),
      },
    });
    return profilPublic(maj);
  });
}

/** GET /users/:id — fiche membre, syndic uniquement, même copropriété (RLS en profondeur). */
export async function obtenirFicheUtilisateur(ctx: TenantContext, utilisateurId: string) {
  if (can("users.lire_fiche", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut consulter la fiche d'un membre.");
  }
  const u = await withTenant(ctx, (db) =>
    // La policy utilisateur_visibilite limite déjà aux membres de la copropriété du contexte —
    // un id hors tenant renvoie null (introuvable, anti-énumération).
    db.utilisateur.findUnique({ where: { id: utilisateurId } })
  );
  if (!u) throw new UtilisateurIntrouvableError("Utilisateur introuvable.");
  return profilPublic(u);
}

/**
 * GET /users/me/export — droit d'accès CNDP (Partie 10.1) : agrège les données de l'appelant
 * copropriété par copropriété (une transaction tenant par claim — la RLS ne couvre qu'un
 * tenant à la fois). Audit EXPORT_DONNEES_CNDP par copropriété.
 */
export async function exporterMesDonnees(utilisateurId: string, roles: RoleClaim[]) {
  let profil: ReturnType<typeof profilPublic> | null = null;
  const coproprietes = [];

  for (const claim of roles) {
    const ctx: TenantContext = {
      utilisateurId,
      coproprieteId: claim.copropriete_id,
      role: claim.role,
    };
    const bloc = await withTenant(ctx, async (db) => {
      if (!profil) {
        const u = await db.utilisateur.findUnique({ where: { id: utilisateurId } });
        if (u) profil = profilPublic(u);
      }
      const [lotsProprietaire, lotsOccupant, paiements, votes, notifications] = await Promise.all([
        db.lotProprietaire.findMany({
          where: { utilisateurId },
          select: { lotId: true, quotePart: true, typePropriete: true, dateDebut: true, dateFin: true },
        }),
        db.lotOccupant.findMany({
          where: { utilisateurId },
          select: { lotId: true, typeOccupation: true, dateDebut: true, dateFin: true },
        }),
        db.paiement.findMany({
          where: { payeurUtilisateurId: utilisateurId },
          select: { id: true, lotId: true, montant: true, methode: true, statut: true, horodatage: true },
        }),
        db.agVote.findMany({
          where: { utilisateurId },
          select: { id: true, resolutionId: true, lotId: true, valeur: true, horodatage: true },
        }),
        db.notification.findMany({
          where: { utilisateurId },
          select: { id: true, canal: true, templateCode: true, statutEnvoi: true, horodatageEnvoi: true },
        }),
      ]);
      await ecrireAuditLog(db, {
        coproprieteId: claim.copropriete_id,
        acteurId: utilisateurId,
        action: "EXPORT_DONNEES_CNDP",
        entite: "utilisateur",
        entiteId: utilisateurId,
      });
      return {
        copropriete_id: claim.copropriete_id,
        role: claim.role,
        lots_proprietaire: lotsProprietaire,
        lots_occupant: lotsOccupant,
        paiements,
        votes,
        notifications,
      };
    });
    coproprietes.push(bloc);
  }

  if (!profil) throw new UtilisateurIntrouvableError("Utilisateur introuvable.");
  return { profil, genere_le: new Date().toISOString(), coproprietes };
}
