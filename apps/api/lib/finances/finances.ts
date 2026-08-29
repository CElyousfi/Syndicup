/**
 * Service moteur financier — M5 (Master Spec Partie 2.2/6, Doc A §3). Toute écriture passe par
 * withTenant (RLS + contexte tenant, CLAUDE.md §1.8). Toute arithmétique financière passe par
 * apps/api/lib/money (CLAUDE.md §1.1) — jamais de `number` natif sur un montant.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import { withTenantIdempotent } from "../http/idempotency";
import { emitEvent } from "../events/emit";
import type { TenantContext } from "../tenant/context";
import { money, repartirAuProrata, subtract, toApiString, isEqual, isGreaterThan } from "../money";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type {
  AppelDeFondsGenererInput,
  PaiementManuelCreateInput,
  PaiementCmiInitierInput,
  PaiementCmiWebhookInput,
  ContestationChargeCreateInput,
  ContestationChargeRepondreInput,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class RessourceIntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}
export class ConflitIdempotenceError extends Error {}

function estContrainteUnique(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function estContrainteCheck(e: unknown): boolean {
  return (
    (e instanceof Prisma.PrismaClientUnknownRequestError ||
      e instanceof Prisma.PrismaClientKnownRequestError) &&
    e.message.includes("appel_de_fonds_lot_montant_paye_check")
  );
}

/**
 * Génération batch d'un appel de fonds — Master Spec Partie 6.2, algorithme repris tel quel :
 *   1. budget_ag ACTIF doit couvrir l'exercice (année de la période) → sinon 422
 *   2. idempotence stricte sur (copropriete_id, periode, type) → sinon 409
 *   3. répartition au prorata des tantièmes sur les lots actifs (hors SINISTRE)
 *   4. lignes appel_de_fonds_lot créées, statut IMPAYE
 *   5. notification async (Inngest) — DIFFÉRÉ : aucune infra Inngest encore câblée dans ce repo
 *      (apps/api/inngest/ n'est qu'un README, voir ROADMAP_BACKLOG.md) ; pas de notification
 *      envoyée pour l'instant, à ajouter quand le job cron existera.
 *   6. audit_log APPEL_DE_FONDS_EMIS
 *
 * ⚠️ ÉCART SIGNALÉ : le Master Spec ne précise pas explicitement le statut de l'appel_de_fonds
 * créé par CET endpoint (brouillon vs émis) — la table `budget_ag` a un cycle propose→vote→actif
 * mais l'algorithme 6.2 ne mentionne aucune étape "émettre" séparée. On émet directement
 * (statut EMIS) puisque l'algorithme décrit la génération des lignes comme faite en une passe ;
 * à revoir si le produit veut un vrai brouillon éditable avant émission.
 */
export async function genererAppelDeFonds(
  ctx: TenantContext,
  input: AppelDeFondsGenererInput,
  idempotencyKey?: string
) {
  if (can("finances.creer_appel_de_fonds", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut générer un appel de fonds (Partie 6.2).");
  }
  const exercice = input.periode.slice(0, 4);

  const appel = await withTenantIdempotent(
    ctx,
    { cle: idempotencyKey, endpoint: "POST /finances/appels-de-fonds", payload: input },
    async (db) => {
    const budgetActif = await db.budgetAg.findFirst({
      where: { coproprieteId: ctx.coproprieteId, exercice, statut: "ACTIF" },
    });
    if (!budgetActif) {
      throw new ContrainteMetierError(
        `Aucun budget_ag ACTIF pour l'exercice ${exercice} — impossible de générer l'appel de fonds (Partie 6.2, étape 1).`
      );
    }

    const lots = await db.lot.findMany({
      where: { coproprieteId: ctx.coproprieteId, statut: { not: "SINISTRE" } },
      select: { id: true, tantiemes: true },
    });
    if (lots.length === 0) {
      throw new ContrainteMetierError("Aucun lot éligible dans cette copropriété.");
    }

    const lignes = repartirAuProrata(
      input.montant_total,
      lots.map((l) => ({ lotId: l.id, tantiemes: l.tantiemes.toString() }))
    );

    let appel;
    try {
      appel = await db.appelDeFonds.create({
        data: {
          coproprieteId: ctx.coproprieteId,
          periode: input.periode,
          type: input.type,
          montantTotal: money(input.montant_total).toString(),
          dateEcheance: new Date(input.date_echeance),
          statut: "EMIS",
          lignes: {
            create: lignes.map((l) => ({
              lotId: l.lotId,
              montantDu: l.montant.toString(),
            })),
          },
        },
        include: { lignes: true },
      });
    } catch (e) {
      if (estContrainteUnique(e)) {
        throw new ConflitIdempotenceError(
          `Un appel de fonds existe déjà pour (période=${input.periode}, type=${input.type}).`
        );
      }
      throw e;
    }
    // Audit dans la MÊME transaction que l'écriture (et que le claim d'idempotence) : un rejeu
    // Idempotency-Key renvoie la réponse stockée sans ré-écrire de ligne d'audit.
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "APPEL_DE_FONDS_EMIS",
      entite: "appel_de_fonds",
      entiteId: appel.id,
      apres: { periode: appel.periode, type: appel.type, montant_total: appel.montantTotal.toString() },
    });
    return appel;
  });

  // Étape 5 du Master Spec Partie 6.2 : notification asynchrone (fan-out Inngest). Émis APRÈS
  // le commit ; le fan-out est idempotent côté lib (un rejeu Idempotency-Key ou un retry Inngest
  // ne double jamais les notifications). L'émission n'échoue jamais la requête (emitEvent).
  await emitEvent("finances/appel_de_fonds.emis", {
    copropriete_id: ctx.coproprieteId,
    appel_de_fonds_id: appel.id,
  });
  return appel;
}

export async function listerAppelsDeFonds(ctx: TenantContext, page: number, limit: number) {
  if (can("finances.lister_appels_de_fonds", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les appels de fonds.");
  }
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([
      db.appelDeFonds.count({ where: { coproprieteId: ctx.coproprieteId } }),
      db.appelDeFonds.findMany({
        where: { coproprieteId: ctx.coproprieteId },
        orderBy: { periode: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, rows };
  });
}

/**
 * Détail d'un appel de fonds AVEC ses lignes — GET /finances/appels-de-fonds/:id.
 * La confidentialité fine reste portée par la RLS sur `appel_de_fonds_lot` : un résident qui
 * lit un appel ne reçoit que les lignes de ses propres lots, le syndic/conseil les reçoit toutes.
 */
export async function obtenirAppelDeFonds(ctx: TenantContext, appelId: string) {
  if (can("finances.lister_appels_de_fonds", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter un appel de fonds.");
  }
  const appel = await withTenant(ctx, (db) =>
    db.appelDeFonds.findUnique({
      where: { id: appelId },
      include: { lignes: { orderBy: { creeLe: "asc" } } },
    })
  );
  if (!appel) throw new RessourceIntrouvableError("Appel de fonds introuvable.");
  return appel;
}

/**
 * GET /finances/synthese — la photographie financière du périmètre visible de l'appelant en UN
 * appel : tous les appels de fonds (métadonnées) + toutes les lignes que la RLS lui laisse voir
 * (syndic/conseil : toutes ; résident : ses lots uniquement). Conçu pour supprimer les N+1 du
 * frontend (tableaux de bord, listes, soldes) — aucune agrégation monétaire côté client au-delà
 * de l'affichage.
 */
/**
 * GET /finances/paiements — journal des paiements (comptabilité autonome, export CSV).
 * Même périmètre que la synthèse : la RLS sur `paiement` (via le lot) limite un résident à
 * ses propres lots ; syndic/conseil voient tout. Filtre optionnel par exercice (année civile).
 */
export async function listerPaiements(ctx: TenantContext, exercice?: string) {
  if (can("finances.lister_appels_de_fonds", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter les paiements.");
  }
  const annee = exercice && /^\d{4}$/.test(exercice) ? Number(exercice) : null;
  return withTenant(ctx, (db) =>
    db.paiement.findMany({
      where: {
        lot: { coproprieteId: ctx.coproprieteId },
        ...(annee
          ? { horodatage: { gte: new Date(`${annee}-01-01T00:00:00Z`), lt: new Date(`${annee + 1}-01-01T00:00:00Z`) } }
          : {}),
      },
      orderBy: { horodatage: "desc" },
      take: 2000,
    })
  );
}

export async function syntheseFinanciere(ctx: TenantContext) {
  if (can("finances.lister_appels_de_fonds", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter la synthèse financière.");
  }
  return withTenant(ctx, async (db) => {
    const [appels, lignes] = await Promise.all([
      db.appelDeFonds.findMany({
        where: { coproprieteId: ctx.coproprieteId },
        orderBy: { periode: "desc" },
      }),
      db.appelDeFondsLot.findMany({
        where: { appelDeFonds: { coproprieteId: ctx.coproprieteId } },
        orderBy: { creeLe: "asc" },
      }),
    ]);
    return { appels, lignes };
  });
}

/**
 * Solde d'un lot — GET /finances/lots/:id/solde (Master Spec Partie 4.2). Somme des
 * (montant_du - montant_paye) sur toutes les lignes non closes du lot. La confidentialité
 * (un résident ne voit que son propre lot) est appliquée par la policy RLS sur
 * `appel_de_fonds_lot` (défense en profondeur, Partie 1.6) — ce service ne fait que vérifier
 * l'action au niveau applicatif.
 */
export async function obtenirSoldeLot(ctx: TenantContext, lotId: string) {
  if (can("finances.voir_solde_lot", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter un solde de lot.");
  }
  return withTenant(ctx, async (db) => {
    const lot = await db.lot.findUnique({ where: { id: lotId } });
    if (!lot) throw new RessourceIntrouvableError("Lot introuvable.");

    const lignes = await db.appelDeFondsLot.findMany({
      where: { lotId },
      select: { id: true, montantDu: true, montantPaye: true, statut: true, conteste: true },
    });

    const solde = lignes.reduce(
      (acc, l) => acc.plus(money(l.montantDu).minus(money(l.montantPaye))),
      money(0)
    );

    return {
      lot_id: lotId,
      solde_du: toApiString(solde),
      lignes: lignes.map((l) => ({
        appel_de_fonds_lot_id: l.id,
        montant_du: toApiString(l.montantDu),
        montant_paye: toApiString(l.montantPaye),
        statut: l.statut,
        conteste: l.conteste,
      })),
    };
  });
}

/** Notification « paiement reçu » aux copropriétaires actifs du lot (flux temps réel + boîte). */
async function notifierPaiementLot(
  db: TenantDb,
  ctx: TenantContext,
  lotId: string,
  montant: string,
  quittanceId: string | null
) {
  const proprietaires = await db.lotProprietaire.findMany({
    where: { lotId, dateFin: null },
    select: { utilisateurId: true },
  });
  await Promise.all(
    proprietaires.map((p) =>
      envoyerNotification(db, {
        coproprieteId: ctx.coproprieteId,
        utilisateurId: p.utilisateurId,
        templateCode: "PAIEMENT_RECU",
        canal: "PUSH",
        contenuJson: { lot_id: lotId, montant, quittance_id: quittanceId },
      })
    )
  );
}

/**
 * Applique un paiement (quel que soit le canal) sur une ligne appel_de_fonds_lot :
 *   - crée la ligne `paiement` (append-only)
 *   - met à jour montant_paye / statut
 *   - génère la quittance si montant_paye == montant_du (Partie 6.4 étape 4 / Partie 9)
 *   - audit_log PAIEMENT_RECU
 *
 * ⚠️ LIMITE CONNUE (Doc A §3.4) : l'imputation FIFO multi-lignes ("paiement partiel imputé sur
 * les charges les plus anciennes") N'EST PAS implémentée — chaque paiement cible EXPLICITEMENT
 * une seule `appel_de_fonds_lot_id` (le modèle `paiement` a une FK non-nullable vers une seule
 * ligne, cohérent avec le flux CMI de la Partie 6.4 qui prend `appel_de_fonds_lot_id` en entrée).
 * Un vrai FIFO multi-lignes nécessiterait soit une FK nullable + table de répartition, soit un
 * champ dédié — à construire explicitement si le produit le demande, pas deviné ici.
 */
async function appliquerPaiement(
  db: TenantDb,
  ctx: TenantContext,
  params: {
    appelDeFondsLotId: string;
    montant: Prisma.Decimal | string;
    methode: "CMI" | "VIREMENT" | "ESPECES" | "CHEQUE";
    referenceCmi?: string | null;
    payeurUtilisateurId?: string | null;
    accepterTropPercu?: boolean;
    // null explicite pour l'acteur système (webhook CMI — pas d'utilisateur réel, et le nil UUID
    // conventionnel de ctxSysteme ne correspond à aucune ligne `utilisateur`, ce qui violerait la
    // FK audit_log_acteur_id_fkey si on le passait tel quel). Master Spec Partie 2.2 : acteur_id
    // "nullable si système" — exactement ce cas.
    acteurId?: string | null;
    /** false = l'appelant notifie lui-même (FIFO : une notification pour tout le paiement). */
    notifier?: boolean;
  }
) {
  // Idempotence AVANT toute autre vérification métier (Partie 6.4 étape 5) : un callback CMI
  // rejoué doit être un no-op idempotent, jamais réévalué contre l'état déjà mis à jour par le
  // premier appel (qui rejetterait à tort pour "dépassement du montant dû").
  if (params.referenceCmi) {
    const existant = await db.paiement.findUnique({ where: { referenceCmi: params.referenceCmi } });
    if (existant) {
      throw new ConflitIdempotenceError("Paiement déjà enregistré pour cette référence CMI.");
    }
  }

  const ligne = await db.appelDeFondsLot.findUnique({ where: { id: params.appelDeFondsLotId } });
  if (!ligne) throw new RessourceIntrouvableError("Ligne d'appel de fonds introuvable.");

  const montantPaieMaj = money(ligne.montantPaye).plus(money(params.montant));
  const depasse = isGreaterThan(montantPaieMaj, ligne.montantDu.toString());

  if (depasse && !ligne.tropPercuAutorise && !params.accepterTropPercu) {
    throw new ContrainteMetierError(
      `Paiement de ${toApiString(params.montant)} dépasserait le montant dû (${toApiString(
        ligne.montantDu
      )}) — trop-perçu non autorisé sur cette ligne (Doc A §3.4). Passer accepter_trop_percu=true pour l'autoriser explicitement.`
    );
  }

  try {
    const paiement = await db.paiement.create({
      data: {
        lotId: ligne.lotId,
        appelDeFondsLotId: ligne.id,
        montant: money(params.montant).toString(),
        methode: params.methode,
        referenceCmi: params.referenceCmi ?? null,
        statut: "VALIDE",
        payeurUtilisateurId: params.payeurUtilisateurId ?? null,
      },
    });

    const nouveauStatut = isEqual(montantPaieMaj, ligne.montantDu.toString())
      ? "PAYE"
      : montantPaieMaj.isZero()
        ? "IMPAYE"
        : "PARTIEL";

    await db.appelDeFondsLot.update({
      where: { id: ligne.id },
      data: {
        montantPaye: montantPaieMaj.toString(),
        statut: nouveauStatut,
        tropPercuAutorise: depasse ? true : undefined,
      },
    });

    let quittance = null;
    if (nouveauStatut === "PAYE") {
      quittance = await db.quittance.upsert({
        where: { appelDeFondsLotId: ligne.id },
        create: {
          appelDeFondsLotId: ligne.id,
          numero: `QT-${ligne.id.slice(0, 8).toUpperCase()}-${Date.now()}`,
        },
        update: {},
      });
    }

    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: params.acteurId !== undefined ? params.acteurId : ctx.utilisateurId,
      action: "PAIEMENT_RECU",
      entite: "appel_de_fonds_lot",
      entiteId: ligne.id,
      avant: { montant_paye: ligne.montantPaye.toString(), statut: ligne.statut },
      apres: { montant_paye: montantPaieMaj.toString(), statut: nouveauStatut, paiement_id: paiement.id },
    });

    // Les copropriétaires actifs du lot sont prévenus (sauf en mode FIFO, qui notifie une fois
    // pour l'ensemble des affectations — voir enregistrerPaiementManuel).
    if (params.notifier !== false) {
      await notifierPaiementLot(db, ctx, ligne.lotId, toApiString(money(params.montant)), quittance?.id ?? null);
    }

    return { paiement, statut: nouveauStatut, quittance };
  } catch (e) {
    if (estContrainteUnique(e)) {
      // reference_cmi déjà utilisée — idempotence webhook CMI (Partie 6.4 étape 5).
      throw new ConflitIdempotenceError("Paiement déjà enregistré pour cette référence CMI.");
    }
    if (estContrainteCheck(e)) {
      throw new ContrainteMetierError(
        "Montant payé dépasserait le montant dû et le trop-perçu n'est pas autorisé sur cette ligne."
      );
    }
    throw e;
  }
}

export async function enregistrerPaiementManuel(
  ctx: TenantContext,
  input: PaiementManuelCreateInput,
  idempotencyKey?: string
) {
  if (can("finances.enregistrer_paiement_manuel", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut enregistrer un paiement manuel.");
  }
  return withTenantIdempotent(
    ctx,
    { cle: idempotencyKey, endpoint: "POST /finances/paiements", payload: input },
    async (db) => {
      if (input.lot_id) {
        return appliquerPaiementFifo(db, ctx, {
          lotId: input.lot_id,
          montant: input.montant,
          methode: input.methode,
          payeurUtilisateurId: input.payeur_utilisateur_id ?? null,
        });
      }
      return appliquerPaiement(db, ctx, {
        // Le refine Zod garantit qu'exactement un des deux modes est présent.
        appelDeFondsLotId: input.appel_de_fonds_lot_id!,
        montant: input.montant,
        methode: input.methode,
        payeurUtilisateurId: input.payeur_utilisateur_id ?? null,
        accepterTropPercu: input.accepter_trop_percu,
      });
    }
  );
}

/**
 * Imputation FIFO (Doc A §3.4 "règle du droit commun") : le montant est réparti sur les lignes
 * impayées/partielles du lot, par date d'échéance croissante — une ligne `paiement` append-only
 * par affectation (le grand livre reste lisible ligne à ligne).
 *
 * ⚠️ ÉCART SIGNALÉ : le "paiement en avance" (Doc A §3.4 — surplus porté en avoir, déduit du
 * prochain appel) n'est PAS implémenté : un montant dépassant le dû total du lot est rejeté 422
 * plutôt que silencieusement tronqué ou transformé en avance sans mécanisme d'avoir tracé.
 */
async function appliquerPaiementFifo(
  db: TenantDb,
  ctx: TenantContext,
  input: {
    lotId: string;
    montant: string;
    methode: "VIREMENT" | "ESPECES" | "CHEQUE";
    payeurUtilisateurId: string | null;
  }
) {
  const lot = await db.lot.findUnique({ where: { id: input.lotId } });
  if (!lot) throw new RessourceIntrouvableError("Lot introuvable.");

  const lignes = await db.appelDeFondsLot.findMany({
    where: { lotId: input.lotId, statut: { in: ["IMPAYE", "PARTIEL"] } },
    include: { appelDeFonds: { select: { dateEcheance: true } } },
  });
  lignes.sort(
    (a, b) => a.appelDeFonds.dateEcheance.getTime() - b.appelDeFonds.dateEcheance.getTime()
  );

  const duTotal = lignes.reduce(
    (acc, l) => acc.plus(subtract(l.montantDu.toString(), l.montantPaye.toString())),
    money(0)
  );
  if (isGreaterThan(input.montant, duTotal)) {
    throw new ContrainteMetierError(
      `Montant (${toApiString(input.montant)}) supérieur au dû total du lot (${toApiString(duTotal)}) — ` +
        "l'avance (Doc A §3.4) n'est pas encore supportée : ajuster le montant ou cibler une ligne avec accepter_trop_percu."
    );
  }

  let restant = money(input.montant);
  const affectations: Array<{ appel_de_fonds_lot_id: string; montant: string; statut: string }> =
    [];
  let derniereQuittance = null;
  for (const ligne of lignes) {
    if (restant.lessThanOrEqualTo(0)) break;
    const du = subtract(ligne.montantDu.toString(), ligne.montantPaye.toString());
    if (du.lessThanOrEqualTo(0)) continue;
    const part = isGreaterThan(restant, du) ? du : restant;
    const res = await appliquerPaiement(db, ctx, {
      appelDeFondsLotId: ligne.id,
      montant: toApiString(part),
      methode: input.methode,
      payeurUtilisateurId: input.payeurUtilisateurId,
      accepterTropPercu: false,
      notifier: false,
    });
    affectations.push({
      appel_de_fonds_lot_id: ligne.id,
      montant: toApiString(part),
      statut: res.statut,
    });
    derniereQuittance = res.quittance ?? derniereQuittance;
    restant = subtract(restant, part);
  }

  await ecrireAuditLog(db, {
    coproprieteId: ctx.coproprieteId,
    acteurId: ctx.utilisateurId,
    action: "PAIEMENT_FIFO_AFFECTE",
    entite: "lot",
    entiteId: input.lotId,
    apres: { montant: toApiString(input.montant), affectations },
  });
  if (affectations.length > 0) {
    await notifierPaiementLot(db, ctx, input.lotId, toApiString(input.montant), derniereQuittance?.id ?? null);
  }

  return {
    lot_id: input.lotId,
    montant: toApiString(input.montant),
    affectations,
    quittance: derniereQuittance,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CMI — Master Spec Partie 6.4.
//
// La cible du paiement est persistée dans `paiement_cmi_session` (migration M12) : le webhook
// résout la ligne d'appel de fonds via la session (oid UNIQUE), plus par décodage de l'oid.
// ⚠️ Le payload webhook (oid/montant/hash) reste une hypothèse : jamais testé contre un vrai
// bac à sable CMI (credentials commerçant absents de ce repo) — à ajuster à la nomenclature
// exacte du contrat commerçant dès que les credentials CMI seront fournis.
// ────────────────────────────────────────────────────────────────────────────

function cmiSecret(): string {
  const secret = process.env.CMI_WEBHOOK_HMAC_SECRET;
  if (!secret) throw new Error("CMI_WEBHOOK_HMAC_SECRET manquant (voir .env.example).");
  return secret;
}

function signerCmi(oid: string, montant: string): string {
  return createHmac("sha256", cmiSecret()).update(`${oid}.${montant}`).digest("hex");
}

/** Comparaison HMAC en temps constant (jamais de `!==` sur une signature). */
function signatureValide(attendu: string, recu: string): boolean {
  const a = Buffer.from(attendu, "hex");
  const b = Buffer.from(recu ?? "", "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function initierPaiementCmi(
  ctx: TenantContext,
  input: PaiementCmiInitierInput,
  idempotencyKey?: string
) {
  if (can("finances.paiement_cmi_initier", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à initier un paiement CMI.");
  }
  return withTenantIdempotent(
    ctx,
    { cle: idempotencyKey, endpoint: "POST /finances/paiements/cmi/initier", payload: input },
    async (db) => {
    const ligne = await db.appelDeFondsLot.findUnique({ where: { id: input.appel_de_fonds_lot_id } });
    if (!ligne) throw new RessourceIntrouvableError("Ligne d'appel de fonds introuvable.");
    if (ligne.statut === "PAYE") {
      throw new ContrainteMetierError("Cette ligne d'appel de fonds est déjà payée.");
    }

    const montant = money(input.montant).toString();
    const oid = `${ligne.id}.${randomUUID()}`;
    const hash = signerCmi(oid, montant);

    await db.paiementCmiSession.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        appelDeFondsLotId: ligne.id,
        oid,
        montant,
      },
    });

    return { oid, montant, hash, appel_de_fonds_lot_id: ligne.id };
  });
}

/**
 * Webhook CMI — Master Spec Partie 6.4 étapes 3-5. Pas de JWT tenant (appel machine-à-machine
 * depuis les serveurs CMI) : le contexte tenant est dérivé du lot associé à la ligne encodée
 * dans `oid`, avec un acteur système (rôle SUPER_ADMIN pour franchir la policy RLS, utilisateurId
 * nil UUID conventionnel — voir apps/api/app/v1/finances/paiements/cmi/webhook/route.ts).
 */
export async function traiterWebhookCmi(input: PaiementCmiWebhookInput) {
  const attendu = signerCmi(input.oid, money(input.montant).toString());
  if (!signatureValide(attendu, input.hash)) {
    throw new PermissionRefuseeError("Signature CMI invalide.");
  }

  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient();
  try {
    // Le client Prisma "brut" ci-dessus est SOUMIS à la policy RLS (rôle app_local, pas de
    // BYPASSRLS) — sans contexte tenant encore posé (poule/œuf : il faut le coproprieteId pour
    // ouvrir la transaction withTenant), un SELECT direct renverrait 0 ligne. La fonction
    // SECURITY DEFINER cmi_session_copropriete_id (migration M12) bootstrappe le contexte
    // depuis la session persistée — même pattern que lot_copropriete_id (M3).
    const rows = await raw.$queryRaw<{ copropriete_id: string | null }[]>`
      SELECT public.cmi_session_copropriete_id(${input.oid}) AS copropriete_id
    `;
    const coproprieteId = rows[0]?.copropriete_id;
    if (!coproprieteId) throw new RessourceIntrouvableError("Session CMI introuvable pour cet oid.");

    const ctxSysteme: TenantContext = {
      utilisateurId: "00000000-0000-0000-0000-000000000000",
      coproprieteId,
      role: "SUPER_ADMIN",
    };

    return await withTenant(ctxSysteme, async (db) => {
      const session = await db.paiementCmiSession.findUnique({ where: { oid: input.oid } });
      if (!session) throw new RessourceIntrouvableError("Session CMI introuvable pour cet oid.");
      // Défense en profondeur : le montant confirmé doit être celui de la session initiée
      // (le HMAC couvre déjà oid+montant, ceci bloque une session rejouée avec un autre oid).
      if (!isEqual(session.montant.toString(), input.montant)) {
        throw new PermissionRefuseeError("Montant du webhook différent du montant de la session CMI.");
      }
      const paiement = await appliquerPaiement(db, ctxSysteme, {
        appelDeFondsLotId: session.appelDeFondsLotId,
        montant: input.montant,
        methode: "CMI",
        referenceCmi: input.oid,
        acteurId: null,
      });
      await db.paiementCmiSession.update({
        where: { oid: input.oid },
        data: { statut: "CONFIRMEE", confirmeeLe: new Date() },
      });
      return paiement;
    });
  } finally {
    await raw.$disconnect();
  }
}

export async function obtenirQuittance(ctx: TenantContext, quittanceId: string) {
  if (can("finances.voir_quittance", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter une quittance.");
  }
  const quittance = await withTenant(ctx, (db) => db.quittance.findUnique({ where: { id: quittanceId } }));
  if (!quittance) throw new RessourceIntrouvableError("Quittance introuvable.");
  return quittance;
}

/**
 * GET /finances/quittances/:id/pdf — rendu PDF à la demande (déterministe : quittance,
 * paiements et ligne sont immuables). Même confidentialité que la consultation (RLS +
 * permission) : un résident n'atteint que les quittances de ses lots.
 */
export async function obtenirQuittancePdf(ctx: TenantContext, quittanceId: string) {
  if (can("finances.voir_quittance", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter une quittance.");
  }
  return withTenant(ctx, async (db) => {
    const quittance = await db.quittance.findUnique({ where: { id: quittanceId } });
    if (!quittance) throw new RessourceIntrouvableError("Quittance introuvable.");
    const ligne = await db.appelDeFondsLot.findUnique({
      where: { id: quittance.appelDeFondsLotId },
    });
    if (!ligne) throw new RessourceIntrouvableError("Ligne d'appel de fonds introuvable.");
    const [appel, lot, copropriete, paiements] = await Promise.all([
      db.appelDeFonds.findUnique({ where: { id: ligne.appelDeFondsId } }),
      db.lot.findUnique({ where: { id: ligne.lotId } }),
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId } }),
      db.paiement.findMany({
        where: { appelDeFondsLotId: ligne.id, statut: "VALIDE" },
        orderBy: { horodatage: "asc" },
      }),
    ]);
    const { genererQuittancePdfBuffer } = await import("./quittance-pdf");
    const buffer = await genererQuittancePdfBuffer({
      numero: quittance.numero,
      coproprieteNom: copropriete?.nom ?? "Copropriété",
      coproprieteAdresse: copropriete ? `${copropriete.adresse}, ${copropriete.ville}` : "",
      lotNumero: lot?.numero ?? "—",
      lotType: lot?.typeLot ?? "",
      periode: appel?.periode ?? "—",
      typeAppel: appel?.type ?? "—",
      montant: toApiString(money(ligne.montantDu)),
      dateEmission: quittance.dateEmission.toISOString(),
      paiements: paiements.map((p) => ({
        montant: toApiString(money(p.montant)),
        methode: p.methode,
        horodatage: p.horodatage.toISOString(),
      })),
    });
    return { buffer, numero: quittance.numero };
  });
}

export async function creerContestation(ctx: TenantContext, input: ContestationChargeCreateInput) {
  if (can("finances.contester_charge", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à contester une charge.");
  }
  return withTenant(ctx, async (db) => {
    const ligne = await db.appelDeFondsLot.findUnique({ where: { id: input.appel_de_fonds_lot_id } });
    if (!ligne) throw new RessourceIntrouvableError("Ligne d'appel de fonds introuvable.");

    // withTenant ouvre déjà une transaction (voir lib/tenant/db.ts) — pas de $transaction imbriqué
    // ici, les deux écritures suivantes s'exécutent dans la même transaction tenant.
    const contestation = await db.contestationCharge.create({
      data: {
        appelDeFondsLotId: input.appel_de_fonds_lot_id,
        utilisateurId: ctx.utilisateurId,
        motif: input.motif,
      },
    });
    await db.appelDeFondsLot.update({ where: { id: input.appel_de_fonds_lot_id }, data: { conteste: true } });
    // Le syndic est prévenu à l'instant qu'une réponse est attendue.
    const syndics = await db.roleUtilisateur.findMany({
      where: { coproprieteId: ctx.coproprieteId, actif: true, role: "SYNDIC" },
      select: { utilisateurId: true },
    });
    await Promise.all(
      syndics.map((s) =>
        envoyerNotification(db, {
          coproprieteId: ctx.coproprieteId,
          utilisateurId: s.utilisateurId,
          templateCode: "CONTESTATION_NOUVELLE",
          canal: "PUSH",
          contenuJson: {
            contestation_id: contestation.id,
            appel_de_fonds_lot_id: ligne.id,
            lot_id: ligne.lotId,
            motif: input.motif.slice(0, 140),
          },
        })
      )
    );
    return contestation;
  });
}

/**
 * GET /finances/contestations — le syndic (répondant) voit toutes les contestations du tenant,
 * un résident voit les siennes. La RLS sur contestation_charge reste la seconde couche.
 */
export async function listerContestations(ctx: TenantContext) {
  const peutRepondre = can("finances.repondre_contestation", ctx.role) === true;
  const peutContester = can("finances.contester_charge", ctx.role) !== false;
  if (!peutRepondre && !peutContester) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter les contestations.");
  }
  return withTenant(ctx, (db) =>
    db.contestationCharge.findMany({
      where: peutRepondre ? {} : { utilisateurId: ctx.utilisateurId },
      orderBy: { creeLe: "desc" },
    })
  );
}

export async function repondreContestation(
  ctx: TenantContext,
  contestationId: string,
  input: ContestationChargeRepondreInput
) {
  if (can("finances.repondre_contestation", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut répondre à une contestation.");
  }
  return withTenant(ctx, async (db) => {
    const existante = await db.contestationCharge.findUnique({ where: { id: contestationId } });
    if (!existante) throw new RessourceIntrouvableError("Contestation introuvable.");
    const maj = await db.contestationCharge.update({
      where: { id: contestationId },
      data: { statut: input.statut, reponseSyndic: input.reponse_syndic },
    });
    // Le résident reçoit la réponse à l'instant.
    await envoyerNotification(db, {
      coproprieteId: ctx.coproprieteId,
      utilisateurId: existante.utilisateurId,
      templateCode: "CONTESTATION_REPONSE",
      canal: "PUSH",
      contenuJson: {
        contestation_id: contestationId,
        appel_de_fonds_lot_id: existante.appelDeFondsLotId,
        statut: input.statut,
      },
    });
    return maj;
  });
}
