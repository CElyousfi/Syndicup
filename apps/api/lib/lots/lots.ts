/**
 * Service lots/propriété/occupation — M3 (Master Spec Partie 2.2, Doc A §1, §2). Toutes les
 * écritures passent par withTenant (RLS + contexte tenant, CLAUDE.md §1.8). Les contraintes
 * "somme des quote_part = 100%" et "somme des tantièmes ≤ total du règlement" sont appliquées en
 * base par des triggers (migration M3) — ce service se contente de remonter une erreur métier
 * explicite (422) quand le trigger rejette l'écriture, jamais un 500 générique.
 */
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import { withTenantIdempotent } from "../http/idempotency";
import type { TenantContext } from "../tenant/context";
import { money, toApiString } from "../money";
import { genererCode, expiration } from "../auth/invitations";
import { ecrireAuditLog } from "../audit/audit";
import type {
  LotCreateInput,
  LotUpdateInput,
  LotProprietaireCreateInput,
  LotOccupantCreateInput,
  LotTransfertProprieteInput,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class LotIntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}

/**
 * Les triggers de contrainte (quote_part=100%, tantiemes≤total) lèvent une exception Postgres
 * avec un message métier explicite — on la fait remonter telle quelle en 422 plutôt que de la
 * traiter comme un bug (CLAUDE.md §5 / Definition of Done).
 */
function rethrowContrainteMetier(e: unknown): never {
  if (
    e instanceof Prisma.PrismaClientUnknownRequestError ||
    e instanceof Prisma.PrismaClientKnownRequestError
  ) {
    const message = e.message;
    if (message.includes("Somme des quote_part") || message.includes("Somme des tantièmes")) {
      // Le driver Postgres embarque le message RAISE EXCEPTION dans un champ `message: "..."`
      // au sein d'un blob de debug — on l'extrait proprement plutôt que de remonter tout le blob.
      const match = message.match(/message: "([^"]*)"/);
      throw new ContrainteMetierError(match ? match[1]! : message);
    }
  }
  throw e as Error;
}

export async function creerLot(ctx: TenantContext, input: LotCreateInput) {
  if (can("lots.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut créer un lot (Doc A §1).");
  }
  try {
    return await withTenant(ctx, (db) =>
      db.lot.create({
        data: {
          coproprieteId: ctx.coproprieteId,
          typeLot: input.type_lot,
          typeUsage: input.type_usage ?? null,
          numero: input.numero,
          etage: input.etage ?? null,
          tantiemes: money(input.tantiemes).toString(),
          superficie: input.superficie ? money(input.superficie).toString() : null,
          lotParentId: input.lot_parent_id ?? null,
        },
      })
    );
  } catch (e) {
    rethrowContrainteMetier(e);
  }
}

export async function listerLots(ctx: TenantContext, page: number, limit: number) {
  if (can("lots.lire", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les lots.");
  }
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([
      db.lot.count({ where: { coproprieteId: ctx.coproprieteId } }),
      db.lot.findMany({
        where: { coproprieteId: ctx.coproprieteId },
        orderBy: { numero: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, rows };
  });
}

export async function obtenirLot(ctx: TenantContext, lotId: string) {
  if (can("lots.lire", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter ce lot.");
  }
  const lot = await withTenant(ctx, (db) => db.lot.findUnique({ where: { id: lotId } }));
  if (!lot) throw new LotIntrouvableError("Lot introuvable.");
  return lot;
}

export async function modifierLot(ctx: TenantContext, lotId: string, input: LotUpdateInput) {
  if (can("lots.modifier", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut modifier un lot.");
  }
  try {
    return await withTenant(ctx, async (db) => {
      const existant = await db.lot.findUnique({ where: { id: lotId } });
      if (!existant) throw new LotIntrouvableError("Lot introuvable.");
      return db.lot.update({
        where: { id: lotId },
        data: {
          typeLot: input.type_lot,
          typeUsage: input.type_usage === undefined ? undefined : input.type_usage,
          numero: input.numero,
          etage: input.etage === undefined ? undefined : input.etage,
          tantiemes: input.tantiemes ? money(input.tantiemes).toString() : undefined,
          superficie:
            input.superficie === undefined
              ? undefined
              : input.superficie
                ? money(input.superficie).toString()
                : null,
          statut: input.statut,
          lotParentId: input.lot_parent_id === undefined ? undefined : input.lot_parent_id,
        },
      });
    });
  } catch (e) {
    if (e instanceof LotIntrouvableError) throw e;
    rethrowContrainteMetier(e);
  }
}

/**
 * Ajoute un copropriétaire (plein, indivision ou SCI — Doc A §2.4). La contrainte "somme des
 * quote_part actives = 100%" est vérifiée au commit de la transaction par le trigger DEFERRABLE
 * (migration M3) : plusieurs appels d'indivisaires peuvent donc se succéder tant que le total
 * final atteint 100% — mais chaque appel HTTP est sa propre transaction Prisma, donc en pratique
 * seul le DERNIER ajout qui complète le total à 100% réussit ; les précédents restent en attente
 * côté métier tant que la somme n'est pas complète (le trigger rejette l'écriture qui, seule,
 * ferait déjà dépasser 100%, mais accepte les écritures intermédiaires tant que la somme ≤ 100%
 * n'est PAS encore vérifiée avant la fin de la transaction HTTP — voir tests/lots.test.ts).
 */
export async function ajouterProprietaire(
  ctx: TenantContext,
  lotId: string,
  input: LotProprietaireCreateInput
) {
  if (can("lots.gerer_proprietaires", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut gérer les copropriétaires d'un lot.");
  }
  try {
    return await withTenant(ctx, async (db) => {
      const lot = await db.lot.findUnique({ where: { id: lotId } });
      if (!lot) throw new LotIntrouvableError("Lot introuvable.");
      return db.lotProprietaire.create({
        data: {
          lotId,
          utilisateurId: input.utilisateur_id,
          quotePart: money(input.quote_part).toString(),
          typePropriete: input.type_propriete,
          estRepresentantIndivision: input.est_representant_indivision ?? false,
          dateDebut: new Date(input.date_debut),
          dateFin: input.date_fin ? new Date(input.date_fin) : null,
        },
      });
    });
  } catch (e) {
    if (e instanceof LotIntrouvableError) throw e;
    rethrowContrainteMetier(e);
  }
}

export async function ajouterOccupant(
  ctx: TenantContext,
  lotId: string,
  input: LotOccupantCreateInput
) {
  if (can("lots.gerer_occupants", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut gérer les occupants d'un lot.");
  }
  return withTenant(ctx, async (db) => {
    const lot = await db.lot.findUnique({ where: { id: lotId } });
    if (!lot) throw new LotIntrouvableError("Lot introuvable.");
    return db.lotOccupant.create({
      data: {
        lotId,
        utilisateurId: input.utilisateur_id,
        typeOccupation: input.type_occupation,
        dateDebut: new Date(input.date_debut),
        dateFin: input.date_fin ? new Date(input.date_fin) : null,
        accesFinancesAccorde: input.acces_finances_accorde ?? false,
        recoitConvocations: input.recoit_convocations ?? false,
      },
    });
  });
}

/**
 * Transfert de propriété (vente d'un lot) — M4 (Master Spec Partie 5.4).
 *
 * Étape 2 du Master Spec ("vérification solde de charges soldé ou transféré comme dette") —
 * câblée sur le moteur financier M5 : le solde réel du lot (Σ montant_du - montant_paye sur les
 * lignes `appel_de_fonds_lot`) est calculé ici. Si le lot a une dette et que le syndic n'a PAS
 * attesté `dette_reprise_acquereur = true`, le transfert est bloqué (422 explicite) — le flag
 * n'est plus pris pour argent comptant, il n'est exigé que quand une dette existe réellement.
 *
 * ⚠️ ÉCART SIGNALÉ (interprétation) : le Master Spec dit "Ancien compte propriétaire → DESACTIVE"
 * ce qui pourrait lire comme `utilisateur.statut_compte = DESACTIVE` (compte global). On ne fait
 * PAS ça ici : `utilisateur` est une table globale (Master Spec Partie 1.6) — une personne peut
 * avoir des rôles dans plusieurs copropriétés ou plusieurs lots dans la même copropriété ;
 * désactiver tout son compte parce qu'elle vend UN lot couperait son accès ailleurs à tort. On
 * désactive uniquement la ligne `role_utilisateur` (PROPRIETAIRE, cette copropriété) —
 * interprétation plus sûre, mais à confirmer humainement si elle diverge de l'intention du spec.
 *
 * ⚠️ LIMITE CONNUE : l'indivision (>1 copropriétaire actif) n'est pas gérée par cet endpoint —
 * rejet explicite en 422, à traiter manuellement via `lot_proprietaire` (Doc A §2.4).
 *
 * ⚠️ LIMITE CONNUE : la ligne `lot_proprietaire` du NOUVEAU propriétaire n'est PAS créée ici — le
 * flux `invitation_accepter` (M2) ne crée que `role_utilisateur`, jamais `lot_proprietaire` (pas
 * de quote_part/type_propriete portés par `invitation`). Une fois l'invitation acceptée, le
 * syndic doit appeler `POST /lots/:id/proprietaires` (M3) pour finaliser l'enregistrement.
 */
export async function transfererPropriete(
  ctx: TenantContext,
  lotId: string,
  input: LotTransfertProprieteInput,
  idempotencyKey?: string
) {
  if (can("lots.transferer_propriete", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut initier un transfert de propriété (Partie 5.4).");
  }
  return withTenantIdempotent(
    ctx,
    { cle: idempotencyKey, endpoint: "POST /lots/:id/transfert-propriete", payload: { lotId, ...input } },
    async (db) => {
    const lot = await db.lot.findUnique({ where: { id: lotId } });
    if (!lot) throw new LotIntrouvableError("Lot introuvable.");

    // Master Spec Partie 5.4 étape 2 — solde réel du lot via le moteur M5.
    const lignesFinancieres = await db.appelDeFondsLot.findMany({
      where: { lotId },
      select: { montantDu: true, montantPaye: true },
    });
    const soldeDu = lignesFinancieres.reduce(
      (acc, l) => acc.plus(money(l.montantDu).minus(money(l.montantPaye))),
      money(0)
    );
    if (soldeDu.isPositive() && !soldeDu.isZero() && !input.dette_reprise_acquereur) {
      throw new ContrainteMetierError(
        `Le lot a un solde de charges impayé de ${toApiString(soldeDu)} MAD — transfert bloqué tant que le solde n'est pas réglé ou que la reprise de dette par l'acquéreur n'est pas attestée (dette_reprise_acquereur=true, Master Spec Partie 5.4 étape 2).`
      );
    }

    const proprietairesActifs = await db.lotProprietaire.findMany({
      where: { lotId, dateFin: null },
    });
    if (proprietairesActifs.length === 0) {
      throw new ContrainteMetierError(
        "Aucun copropriétaire actif sur ce lot — rien à transférer."
      );
    }
    if (proprietairesActifs.length > 1) {
      throw new ContrainteMetierError(
        "Transfert d'un lot en indivision non supporté par cet endpoint (Doc A §2.4) — à traiter manuellement via lot_proprietaire."
      );
    }
    const ancien = proprietairesActifs[0]!;

    await db.lotProprietaire.update({
      where: { id: ancien.id },
      data: { dateFin: new Date() },
    });

    await db.roleUtilisateur.updateMany({
      where: {
        utilisateurId: ancien.utilisateurId,
        coproprieteId: ctx.coproprieteId,
        role: "PROPRIETAIRE",
        actif: true,
      },
      data: { actif: false },
    });

    const canal = input.nouveau_proprietaire.email ? "EMAIL" : "SMS";
    const invitation = await db.invitation.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId,
        roleCible: "PROPRIETAIRE",
        emetteurId: ctx.utilisateurId,
        canal,
        code: genererCode(),
        expireLe: expiration(canal),
      },
    });

    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LOT_TRANSFERT_PROPRIETE",
      entite: "lot",
      entiteId: lotId,
      avant: {
        ancien_proprietaire_utilisateur_id: ancien.utilisateurId,
        quote_part: ancien.quotePart.toString(),
      },
      apres: {
        invitation_id: invitation.id,
        dette_reprise_acquereur: input.dette_reprise_acquereur,
        solde_charges_verifie_automatiquement: true,
        solde_du_au_transfert: toApiString(soldeDu),
      },
    });

    return invitation;
  });
}
