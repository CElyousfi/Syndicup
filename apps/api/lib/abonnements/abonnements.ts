/**
 * M29 — Abonnements SyndicUp : service de la console opérateur (SUPER_ADMIN uniquement).
 *
 * Les clients ne paient pas dans l'application. L'opérateur :
 *   1. ouvre l'abonnement (essai gratuit de 30 jours par défaut, prix figé depuis la grille) ;
 *   2. émet la facture de la période suivante (numérotation sans trou SU-AAAA-NNNN) ;
 *   3. enregistre le paiement reçu → la période payée avance, l'abonnement passe ACTIF ;
 *   4. pilote les exceptions : prolonger l'essai, accorder un délai (vote en AG), suspendre,
 *      réactiver, résilier.
 * L'accès des résidences se déduit des dates (etat.ts) ; chaque geste est journalisé dans
 * abonnement_evenement (append-only).
 */
import type { Prisma } from "@prisma/client";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { withIdempotency } from "../http/idempotency";
import { add, isGreaterThan, money, multiply, subtract, toApiString } from "../money";
import { calculerFacture, moisParPeriode } from "./calcul";
import { ajouterJours, ajouterMois, etatAcces, jourCasablanca, jourIso, type EtatAbonnement, ALERTE_OPERATEUR_RENOUVELLEMENT_JOURS } from "./etat";
import { DELAI_GRACE_DEFAUT_JOURS, DUREE_ESSAI_JOURS, DUREE_PRIX_GARANTI_MOIS, tarifSuggere, type Formule } from "./tarifs";
import { invaliderCacheAcces } from "./acces";
import type {
  AbonnementActionInput,
  AbonnementCreateInput,
  AbonnementUpdateInput,
  ClientCreateInput,
  ClientUpdateInput,
  FactureCreateInput,
  PaiementCreateInput,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class AbonnementError extends Error {
  constructor(
    public code: "ABONNEMENT_EXISTANT" | "ABONNEMENT_STATUT_INVALIDE" | "FACTURE_STATUT_INVALIDE" | "PAIEMENT_SUPERIEUR_RESTE_DU" | "UNPROCESSABLE_ENTITY",
    message: string
  ) {
    super(message);
  }
}

/** Seuil de dépassement de lots signalé à l'opérateur (lots créés vs contractés). */
export const SEUIL_DEPASSEMENT_LOTS = 0.05;

function exigerOperateur(ctx: TenantContext) {
  if (ctx.role !== "SUPER_ADMIN") throw new PermissionRefuseeError("Console opérateur : réservée au super_admin.");
}

function enOperateur<T>(ctx: TenantContext, fn: (db: TenantDb) => Promise<T>): Promise<T> {
  exigerOperateur(ctx);
  return withTenant({ ...ctx, role: "SUPER_ADMIN" }, fn);
}

const dateDb = (jour: string) => new Date(`${jour}T00:00:00Z`);
const jourOuNull = (d: Date | null | undefined) => (d ? jourIso(d) : null);
const nul = <T>(v: T | null | undefined): T | null => (v === undefined ? null : v);

type Abo = Prisma.AbonnementGetPayload<{ include: { client: true; coproprietes: { include: { copropriete: { select: { id: true; nom: true; ville: true; nbLots: true } } } } } }>;

async function journaliser(
  db: TenantDb,
  abonnementId: string,
  type: Prisma.AbonnementEvenementCreateInput["type"],
  acteurId: string | null,
  details?: Record<string, unknown>,
  cle?: string
) {
  await db.abonnementEvenement.create({
    data: { abonnementId, type, acteurId, cle: cle ?? null, detailsJson: (details ?? undefined) as Prisma.InputJsonValue | undefined },
  });
}

/** Lots réellement créés par résidence (pour la facturation et l'alerte de dépassement). */
async function lotsReelsParCopro(db: TenantDb, coproIds: string[]): Promise<Map<string, number>> {
  if (coproIds.length === 0) return new Map();
  const rows = await db.lot.groupBy({ by: ["coproprieteId"], where: { coproprieteId: { in: coproIds } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.coproprieteId, r._count._all]));
}

function mensuelHt(a: Pick<Abo, "formule" | "basePrix" | "prixLot" | "tauxTva" | "minimumMensuel" | "forfaitAccompagne" | "lotsContractes" | "tarifFondateur">) {
  return calculerFacture({
    formule: a.formule as Formule,
    basePrix: a.basePrix,
    prixLot: a.prixLot.toString(),
    tauxTva: a.tauxTva.toString(),
    minimumMensuel: a.minimumMensuel?.toString() ?? null,
    forfaitAccompagne: a.forfaitAccompagne?.toString() ?? null,
    lots: a.lotsContractes,
    mois: 1,
    tarifFondateur: a.tarifFondateur,
  }).montant_ht;
}

function serialiser(a: Abo, lotsReels: Map<string, number>, maintenant = new Date()) {
  const actives = a.coproprietes.filter((c) => c.actif);
  const lots = actives.reduce((n, c) => n + (lotsReels.get(c.coproprieteId) ?? 0), 0);
  const etat = etatAcces(a, maintenant);
  return {
    id: a.id,
    client: { id: a.client.id, nom: a.client.nom, type: a.client.type, contact_email: a.client.contactEmail, contact_telephone: a.client.contactTelephone },
    formule: a.formule,
    periodicite: a.periodicite,
    statut: a.statut,
    base_prix: a.basePrix,
    prix_lot: toApiString(a.prixLot.toString()),
    taux_tva: toApiString(a.tauxTva.toString()),
    minimum_mensuel: a.minimumMensuel ? toApiString(a.minimumMensuel.toString()) : null,
    forfait_accompagne: a.forfaitAccompagne ? toApiString(a.forfaitAccompagne.toString()) : null,
    lots_contractes: a.lotsContractes,
    lots_reels: lots,
    depassement_lots: lots > a.lotsContractes * (1 + SEUIL_DEPASSEMENT_LOTS),
    tarif_fondateur: a.tarifFondateur,
    prix_garanti_jusqu_au: jourOuNull(a.prixGarantiJusquAu),
    date_debut: jourIso(a.dateDebut),
    fin_essai: jourOuNull(a.finEssai),
    fin_periode: jourOuNull(a.finPeriode),
    delai_grace_jours: a.delaiGraceJours,
    acces_prolonge_jusqu_au: jourOuNull(a.accesProlongeJusquAu),
    motif_prolongation: a.motifProlongation,
    suspendu_le: a.suspenduLe?.toISOString() ?? null,
    motif_suspension: a.motifSuspension,
    resilie_le: a.resilieLe?.toISOString() ?? null,
    motif_resiliation: a.motifResiliation,
    notes: a.notes,
    mensuel_ht: mensuelHt(a),
    etat,
    coproprietes: actives.map((c) => ({ id: c.copropriete.id, nom: c.copropriete.nom, ville: c.copropriete.ville, nb_lots_declares: c.copropriete.nbLots, lots_reels: lotsReels.get(c.coproprieteId) ?? 0 })),
    cree_le: a.creeLe.toISOString(),
  };
}
export type AbonnementVue = ReturnType<typeof serialiser>;

const INCLUDE_ABO = { client: true, coproprietes: { include: { copropriete: { select: { id: true, nom: true, ville: true, nbLots: true } } } } } as const;

/* ─────────────────────────── Clients ─────────────────────────── */

function serialiserClient(c: Prisma.ClientFacturationGetPayload<object>) {
  return {
    id: c.id, type: c.type, nom: c.nom, raison_sociale: c.raisonSociale, ice: c.ice, rc: c.rc,
    identifiant_fiscal: c.identifiantFiscal, adresse: c.adresse, ville: c.ville, contact_nom: c.contactNom,
    contact_email: c.contactEmail, contact_telephone: c.contactTelephone, cabinet_id: c.cabinetId, notes: c.notes,
    cree_le: c.creeLe.toISOString(),
  };
}

function donneesClient(input: Partial<ClientCreateInput>) {
  const champs = {
    nom: input.nom, raisonSociale: input.raison_sociale, ice: input.ice, rc: input.rc, identifiantFiscal: input.identifiant_fiscal,
    adresse: input.adresse, ville: input.ville, contactNom: input.contact_nom, contactEmail: input.contact_email,
    contactTelephone: input.contact_telephone, cabinetId: input.cabinet_id, notes: input.notes,
  };
  return Object.fromEntries(Object.entries(champs).filter(([, v]) => v !== undefined));
}

export async function listerClients(ctx: TenantContext, q?: string) {
  return enOperateur(ctx, async (db) => {
    const rows = await db.clientFacturation.findMany({
      where: q ? { OR: [{ nom: { contains: q, mode: "insensitive" } }, { raisonSociale: { contains: q, mode: "insensitive" } }, { ice: { contains: q } }] } : undefined,
      orderBy: { nom: "asc" },
      include: { _count: { select: { abonnements: true } } },
      take: 500,
    });
    return rows.map((c) => ({ ...serialiserClient(c), abonnements: c._count.abonnements }));
  });
}

export async function creerClient(ctx: TenantContext, input: ClientCreateInput) {
  return enOperateur(ctx, async (db) => serialiserClient(await db.clientFacturation.create({ data: { type: input.type, ...donneesClient(input) } as Prisma.ClientFacturationUncheckedCreateInput })));
}

export async function modifierClient(ctx: TenantContext, id: string, input: ClientUpdateInput) {
  return enOperateur(ctx, async (db) => {
    const existe = await db.clientFacturation.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new IntrouvableError("Client introuvable.");
    return serialiserClient(await db.clientFacturation.update({ where: { id }, data: donneesClient(input) }));
  });
}

export async function obtenirClient(ctx: TenantContext, id: string) {
  return enOperateur(ctx, async (db) => {
    const c = await db.clientFacturation.findUnique({ where: { id } });
    if (!c) throw new IntrouvableError("Client introuvable.");
    const abos = await db.abonnement.findMany({ where: { clientId: id }, include: INCLUDE_ABO, orderBy: { creeLe: "desc" } });
    const lots = await lotsReelsParCopro(db, abos.flatMap((a) => a.coproprietes.map((x) => x.coproprieteId)));
    const factures = await db.factureAbonnement.findMany({ where: { clientId: id }, orderBy: { emiseLe: "desc" }, take: 100 });
    return { ...serialiserClient(c), abonnements: abos.map((a) => serialiser(a, lots)), factures: factures.map(serialiserFactureCourte) };
  });
}

/* ─────────────────────────── Abonnements ─────────────────────────── */

export async function listerAbonnements(ctx: TenantContext, filtre: { etat?: EtatAbonnement; q?: string } = {}) {
  return enOperateur(ctx, async (db) => {
    const abos = await db.abonnement.findMany({
      where: filtre.q ? { OR: [{ client: { nom: { contains: filtre.q, mode: "insensitive" } } }, { coproprietes: { some: { actif: true, copropriete: { nom: { contains: filtre.q, mode: "insensitive" } } } } }] } : undefined,
      include: INCLUDE_ABO,
      orderBy: { creeLe: "desc" },
      take: 1000,
    });
    const lots = await lotsReelsParCopro(db, abos.flatMap((a) => a.coproprietes.filter((c) => c.actif).map((c) => c.coproprieteId)));
    const impayees = await db.factureAbonnement.groupBy({ by: ["abonnementId"], where: { statut: "EMISE" }, _sum: { montantTtc: true }, _count: { _all: true } });
    const parAbo = new Map(impayees.map((r) => [r.abonnementId, r]));
    return abos
      .map((a) => {
        const f = parAbo.get(a.id);
        return { ...serialiser(a, lots), factures_ouvertes: f?._count._all ?? 0, du_ttc: toApiString(f?._sum.montantTtc?.toString() ?? "0") };
      })
      .filter((a) => !filtre.etat || a.etat.etat === filtre.etat);
  });
}

export async function obtenirAbonnement(ctx: TenantContext, id: string) {
  return enOperateur(ctx, async (db) => {
    const a = await db.abonnement.findUnique({ where: { id }, include: INCLUDE_ABO });
    if (!a) throw new IntrouvableError("Abonnement introuvable.");
    const lots = await lotsReelsParCopro(db, a.coproprietes.filter((c) => c.actif).map((c) => c.coproprieteId));
    const [factures, evenements, client] = await Promise.all([
      db.factureAbonnement.findMany({ where: { abonnementId: id }, include: { paiements: { orderBy: { recuLe: "asc" } } }, orderBy: { periodeDebut: "desc" } }),
      db.abonnementEvenement.findMany({ where: { abonnementId: id }, orderBy: { horodatage: "desc" }, take: 200 }),
      db.clientFacturation.findUniqueOrThrow({ where: { id: a.clientId } }),
    ]);
    const acteurs = await nomsActeurs(db, evenements.map((e) => e.acteurId));
    const duTtc = factures
      .filter((f) => f.statut === "EMISE")
      .reduce((acc, f) => add(acc, subtract(f.montantTtc.toString(), sommePaiements(f.paiements))), money(0));
    return {
      ...serialiser(a, lots),
      du_ttc: toApiString(duTtc),
      client_fiche: serialiserClient(client),
      prochaine_periode: prochainePeriode(a),
      factures: factures.map((f) => ({ ...serialiserFactureCourte(f), paiements: f.paiements.map(serialiserPaiement), paye: toApiString(sommePaiements(f.paiements)) })),
      evenements: evenements.map((e) => ({ id: e.id, type: e.type, details: e.detailsJson, acteur: e.acteurId ? acteurs.get(e.acteurId) ?? null : null, horodatage: e.horodatage.toISOString() })),
    };
  });
}

async function nomsActeurs(db: TenantDb, ids: (string | null)[]) {
  const uniques = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (uniques.length === 0) return new Map<string, string>();
  const us = await db.utilisateur.findMany({ where: { id: { in: uniques } }, select: { id: true, prenom: true, nom: true, email: true } });
  return new Map(us.map((u) => [u.id, [u.prenom, u.nom].filter(Boolean).join(" ") || u.email || "—"]));
}

async function verifierCoproprietesLibres(db: TenantDb, coproIds: string[], saufAbonnementId?: string) {
  const copros = await db.copropriete.findMany({ where: { id: { in: coproIds } }, select: { id: true, nom: true } });
  if (copros.length !== new Set(coproIds).size) throw new IntrouvableError("Résidence introuvable.");
  const liens = await db.abonnementCopropriete.findMany({
    where: { coproprieteId: { in: coproIds }, actif: true, ...(saufAbonnementId ? { abonnementId: { not: saufAbonnementId } } : {}) },
    include: { copropriete: { select: { nom: true } }, abonnement: { select: { statut: true } } },
  });
  // Un abonnement résilié garde ses résidences (bloquées) : la nouvelle ouverture les libère.
  const resilies = liens.filter((l) => l.abonnement.statut === "RESILIE");
  if (resilies.length > 0) {
    await db.abonnementCopropriete.updateMany({ where: { id: { in: resilies.map((l) => l.id) } }, data: { actif: false, retireLe: new Date() } });
  }
  const prises = liens.filter((l) => l.abonnement.statut !== "RESILIE");
  if (prises.length > 0) {
    throw new AbonnementError("ABONNEMENT_EXISTANT", `Déjà couverte par un abonnement actif : ${prises.map((p) => p.copropriete.nom).join(", ")}.`);
  }
  return copros;
}

export async function creerAbonnement(ctx: TenantContext, input: AbonnementCreateInput) {
  const res = await enOperateur(ctx, async (db) => {
    const copros = await verifierCoproprietesLibres(db, input.copropriete_ids);
    let clientId = input.client_id;
    if (clientId) {
      if (!(await db.clientFacturation.findUnique({ where: { id: clientId }, select: { id: true } }))) throw new IntrouvableError("Client introuvable.");
    } else {
      const nc = input.nouveau_client!;
      clientId = (await db.clientFacturation.create({ data: { type: nc.type, ...donneesClient(nc) } as Prisma.ClientFacturationUncheckedCreateInput })).id;
    }

    const grille = tarifSuggere({ formule: input.formule, lots: input.lots_contractes, periodicite: input.periodicite, fondateur: input.tarif_fondateur });
    const debut = input.date_debut;
    const essai = input.essai;
    // Sans essai ni période payée fournie : abonnement ACTIF à facturer tout de suite (échéance = veille du début).
    const finEssai = essai ? input.fin_essai ?? ajouterJours(debut, DUREE_ESSAI_JOURS - 1) : null;
    if (finEssai && finEssai < debut) throw new AbonnementError("UNPROCESSABLE_ENTITY", "La fin d'essai précède le début.");

    const a = await db.abonnement.create({
      data: {
        clientId,
        formule: input.formule,
        periodicite: input.periodicite,
        statut: essai ? "ESSAI" : "ACTIF",
        basePrix: grille.base_prix,
        prixLot: input.prix_lot ?? grille.prix_lot,
        tauxTva: input.taux_tva ?? grille.taux_tva,
        minimumMensuel: input.minimum_mensuel === undefined ? grille.minimum_mensuel : input.minimum_mensuel,
        lotsContractes: input.lots_contractes,
        tarifFondateur: grille.tarif_fondateur,
        prixGarantiJusquAu: grille.tarif_fondateur ? dateDb(ajouterJours(ajouterMois(debut, DUREE_PRIX_GARANTI_MOIS), -1)) : null,
        forfaitAccompagne: nul(input.forfait_accompagne),
        dateDebut: dateDb(debut),
        finEssai: finEssai ? dateDb(finEssai) : null,
        finPeriode: !essai ? dateDb(input.fin_periode ?? ajouterJours(debut, -1)) : null,
        delaiGraceJours: input.delai_grace_jours ?? DELAI_GRACE_DEFAUT_JOURS,
        notes: nul(input.notes),
        coproprietes: { create: copros.map((c) => ({ coproprieteId: c.id })) },
      },
      include: INCLUDE_ABO,
    });
    await journaliser(db, a.id, "CREE", ctx.utilisateurId, {
      formule: a.formule, periodicite: a.periodicite, prix_lot: a.prixLot.toString(), base_prix: a.basePrix,
      lots_contractes: a.lotsContractes, essai, fin_essai: finEssai, tarif_fondateur: a.tarifFondateur,
    });
    for (const c of copros) await journaliser(db, a.id, "COPROPRIETE_RATTACHEE", ctx.utilisateurId, { copropriete_id: c.id, nom: c.nom });
    return serialiser(a, await lotsReelsParCopro(db, copros.map((c) => c.id)));
  });
  invaliderCacheAcces(input.copropriete_ids);
  return res;
}

export async function modifierAbonnement(ctx: TenantContext, id: string, input: AbonnementUpdateInput) {
  return enOperateur(ctx, async (db) => {
    const avant = await db.abonnement.findUnique({ where: { id }, include: INCLUDE_ABO });
    if (!avant) throw new IntrouvableError("Abonnement introuvable.");
    if (avant.statut === "RESILIE") throw new AbonnementError("ABONNEMENT_STATUT_INVALIDE", "Abonnement résilié : non modifiable.");
    const data: Prisma.AbonnementUncheckedUpdateInput = {};
    if (input.formule) {
      data.formule = input.formule;
      data.basePrix = input.formule === "CABINET" ? "HT" : "TTC";
    }
    if (input.periodicite) data.periodicite = input.periodicite;
    if (input.lots_contractes !== undefined) data.lotsContractes = input.lots_contractes;
    if (input.prix_lot !== undefined) data.prixLot = input.prix_lot;
    if (input.minimum_mensuel !== undefined) data.minimumMensuel = input.minimum_mensuel;
    if (input.taux_tva !== undefined) data.tauxTva = input.taux_tva;
    if (input.tarif_fondateur !== undefined) data.tarifFondateur = input.tarif_fondateur;
    if (input.prix_garanti_jusqu_au !== undefined) data.prixGarantiJusquAu = input.prix_garanti_jusqu_au ? dateDb(input.prix_garanti_jusqu_au) : null;
    if (input.forfait_accompagne !== undefined) data.forfaitAccompagne = input.forfait_accompagne;
    if (input.delai_grace_jours !== undefined) data.delaiGraceJours = input.delai_grace_jours;
    if (input.notes !== undefined) data.notes = input.notes;
    const apres = await db.abonnement.update({ where: { id }, data, include: INCLUDE_ABO });
    await journaliser(db, id, "MODIFIE", ctx.utilisateurId, { champs: Object.keys(input), avant: instantane(avant), apres: instantane(apres) });
    invaliderCacheAcces(apres.coproprietes.map((c) => c.coproprieteId));
    return serialiser(apres, await lotsReelsParCopro(db, apres.coproprietes.filter((c) => c.actif).map((c) => c.coproprieteId)));
  });
}

function instantane(a: Abo) {
  return {
    formule: a.formule, periodicite: a.periodicite, prix_lot: a.prixLot.toString(), lots_contractes: a.lotsContractes,
    minimum_mensuel: a.minimumMensuel?.toString() ?? null, taux_tva: a.tauxTva.toString(), delai_grace_jours: a.delaiGraceJours,
    forfait_accompagne: a.forfaitAccompagne?.toString() ?? null, tarif_fondateur: a.tarifFondateur,
  };
}

export async function actionAbonnement(ctx: TenantContext, id: string, input: AbonnementActionInput) {
  return enOperateur(ctx, async (db) => {
    const a = await db.abonnement.findUnique({ where: { id }, include: INCLUDE_ABO });
    if (!a) throw new IntrouvableError("Abonnement introuvable.");
    if (a.statut === "RESILIE") throw new AbonnementError("ABONNEMENT_STATUT_INVALIDE", "Abonnement résilié : aucune action possible.");
    const acteur = ctx.utilisateurId;
    let data: Prisma.AbonnementUncheckedUpdateInput;

    switch (input.action) {
      case "PROLONGER_ESSAI":
        if (a.statut !== "ESSAI") throw new AbonnementError("ABONNEMENT_STATUT_INVALIDE", "Seul un abonnement en essai peut être prolongé.");
        if (input.fin_essai < jourIso(a.dateDebut)) throw new AbonnementError("UNPROCESSABLE_ENTITY", "La fin d'essai précède le début.");
        data = { finEssai: dateDb(input.fin_essai) };
        await journaliser(db, id, "ESSAI_PROLONGE", acteur, { avant: jourOuNull(a.finEssai), apres: input.fin_essai, motif: input.motif ?? null });
        break;
      case "ACCORDER_DELAI":
        data = { accesProlongeJusquAu: dateDb(input.jusqu_au), motifProlongation: input.motif };
        await journaliser(db, id, "DELAI_ACCORDE", acteur, { jusqu_au: input.jusqu_au, motif: input.motif });
        break;
      case "RETIRER_DELAI":
        data = { accesProlongeJusquAu: null, motifProlongation: null };
        await journaliser(db, id, "DELAI_ACCORDE", acteur, { jusqu_au: null, retire: true });
        break;
      case "ACTIVER":
        // Conversion manuelle (paiement déjà reçu hors facture, geste commercial…).
        data = { statut: "ACTIF", finPeriode: dateDb(input.fin_periode), suspenduLe: null, motifSuspension: null };
        await journaliser(db, id, "ACTIVE", acteur, { fin_periode: input.fin_periode, motif: input.motif ?? null, manuel: true });
        break;
      case "SUSPENDRE":
        if (a.statut === "SUSPENDU") throw new AbonnementError("ABONNEMENT_STATUT_INVALIDE", "Déjà suspendu.");
        data = { statut: "SUSPENDU", suspenduLe: new Date(), motifSuspension: input.motif };
        await journaliser(db, id, "SUSPENDU", acteur, { motif: input.motif, statut_precedent: a.statut });
        break;
      case "REACTIVER": {
        if (a.statut !== "SUSPENDU") throw new AbonnementError("ABONNEMENT_STATUT_INVALIDE", "Seul un abonnement suspendu peut être réactivé.");
        // Retour à l'essai si aucune période n'a jamais été payée et que l'essai court encore.
        const retourEssai = !a.finPeriode && a.finEssai !== null;
        const apresReactivation = etatAcces({ ...a, statut: retourEssai ? "ESSAI" : "ACTIF" });
        if (apresReactivation.niveau === "BLOQUE") {
          throw new AbonnementError(
            "ABONNEMENT_STATUT_INVALIDE",
            "La période est échue : la résidence resterait fermée. Enregistrez le paiement, activez sans facture ou accordez d'abord un délai."
          );
        }
        data = { statut: retourEssai ? "ESSAI" : "ACTIF", suspenduLe: null, motifSuspension: null };
        await journaliser(db, id, "REACTIVE", acteur, { motif: input.motif ?? null, statut: retourEssai ? "ESSAI" : "ACTIF" });
        break;
      }
      case "RESILIER":
        // Les résidences RESTENT rattachées : statut RESILIE ⇒ accès bloqué. Elles ne sont libérées
        // que par l'ouverture d'un nouvel abonnement (verifierCoproprietesLibres).
        data = { statut: "RESILIE", resilieLe: new Date(), motifResiliation: input.motif };
        await journaliser(db, id, "RESILIE", acteur, { motif: input.motif, statut_precedent: a.statut });
        break;
    }
    const apres = await db.abonnement.update({ where: { id }, data, include: INCLUDE_ABO });
    invaliderCacheAcces(a.coproprietes.map((c) => c.coproprieteId));
    return serialiser(apres, await lotsReelsParCopro(db, apres.coproprietes.filter((c) => c.actif).map((c) => c.coproprieteId)));
  });
}

export async function rattacherCopropriete(ctx: TenantContext, id: string, coproprieteId: string) {
  const res = await enOperateur(ctx, async (db) => {
    const a = await db.abonnement.findUnique({ where: { id }, select: { id: true, statut: true } });
    if (!a) throw new IntrouvableError("Abonnement introuvable.");
    if (a.statut === "RESILIE") throw new AbonnementError("ABONNEMENT_STATUT_INVALIDE", "Abonnement résilié.");
    const [copro] = await verifierCoproprietesLibres(db, [coproprieteId]);
    await db.abonnementCopropriete.create({ data: { abonnementId: id, coproprieteId } });
    await journaliser(db, id, "COPROPRIETE_RATTACHEE", ctx.utilisateurId, { copropriete_id: coproprieteId, nom: copro!.nom });
    return { rattachee: true };
  });
  invaliderCacheAcces([coproprieteId]);
  return res;
}

export async function retirerCopropriete(ctx: TenantContext, id: string, coproprieteId: string) {
  const res = await enOperateur(ctx, async (db) => {
    const lien = await db.abonnementCopropriete.findFirst({ where: { abonnementId: id, coproprieteId, actif: true }, include: { copropriete: { select: { nom: true } } } });
    if (!lien) throw new IntrouvableError("Cette résidence n'est pas rattachée à l'abonnement.");
    await db.abonnementCopropriete.update({ where: { id: lien.id }, data: { actif: false, retireLe: new Date() } });
    await journaliser(db, id, "COPROPRIETE_RETIREE", ctx.utilisateurId, { copropriete_id: coproprieteId, nom: lien.copropriete.nom });
    return { retiree: true };
  });
  invaliderCacheAcces([coproprieteId]);
  return res;
}

/* ─────────────────────────── Factures & paiements ─────────────────────────── */

function serialiserFactureCourte(f: Prisma.FactureAbonnementGetPayload<object>) {
  return {
    id: f.id, numero: f.numero, abonnement_id: f.abonnementId, client_id: f.clientId,
    periode_debut: jourIso(f.periodeDebut), periode_fin: jourIso(f.periodeFin), lots: f.lots,
    montant_ht: toApiString(f.montantHt.toString()), montant_tva: toApiString(f.montantTva.toString()), montant_ttc: toApiString(f.montantTtc.toString()),
    statut: f.statut, emise_le: jourIso(f.emiseLe), echeance: jourIso(f.echeance), payee_le: jourOuNull(f.payeeLe),
    annulee_le: f.annuleeLe?.toISOString() ?? null, motif_annulation: f.motifAnnulation,
    en_retard: f.statut === "EMISE" && jourIso(f.echeance) < jourCasablanca(),
  };
}

function serialiserPaiement(p: Prisma.PaiementAbonnementGetPayload<object>) {
  return { id: p.id, montant: toApiString(p.montant.toString()), mode: p.mode, reference: p.reference, recu_le: jourIso(p.recuLe), cree_le: p.creeLe.toISOString() };
}

const sommePaiements = (ps: { montant: Prisma.Decimal }[]) => ps.reduce((acc, p) => add(acc, p.montant.toString()), money(0));

/** Période facturable suivante : lendemain de la période payée, sinon de la fin d'essai, sinon le début. */
function prochainePeriode(a: Pick<Abo, "finPeriode" | "finEssai" | "dateDebut" | "periodicite">) {
  const debut = a.finPeriode ? ajouterJours(jourIso(a.finPeriode), 1) : a.finEssai ? ajouterJours(jourIso(a.finEssai), 1) : jourIso(a.dateDebut);
  const fin = ajouterJours(ajouterMois(debut, moisParPeriode(a.periodicite)), -1);
  return { debut, fin, mois: moisParPeriode(a.periodicite) };
}

async function prochainNumero(db: TenantDb, annee: number): Promise<string> {
  // Upsert + incrément sous verrou de ligne : numérotation sans trou ni doublon.
  const rows = await db.$queryRaw<{ dernier: number }[]>`
    INSERT INTO "compteur_facture_abonnement" ("annee", "dernier") VALUES (${annee}, 1)
    ON CONFLICT ("annee") DO UPDATE SET "dernier" = "compteur_facture_abonnement"."dernier" + 1
    RETURNING "dernier"`;
  return `SU-${annee}-${String(rows[0]!.dernier).padStart(4, "0")}`;
}

export async function emettreFacture(ctx: TenantContext, abonnementId: string, input: FactureCreateInput) {
  return enOperateur(ctx, async (db) => {
    // Verrou de l'abonnement : deux émissions simultanées (double clic) ne passent pas toutes deux
    // le contrôle de chevauchement.
    await db.$queryRaw`SELECT id FROM "abonnement" WHERE id = ${abonnementId}::uuid FOR UPDATE`;
    const a = await db.abonnement.findUnique({ where: { id: abonnementId }, include: INCLUDE_ABO });
    if (!a) throw new IntrouvableError("Abonnement introuvable.");
    if (a.statut === "RESILIE") throw new AbonnementError("ABONNEMENT_STATUT_INVALIDE", "Abonnement résilié : plus de facturation.");
    const p = prochainePeriode(a);
    const debut = input.periode_debut ?? p.debut;
    const fin = ajouterJours(ajouterMois(debut, p.mois), -1);
    const chevauche = await db.factureAbonnement.findFirst({
      where: { abonnementId, statut: { not: "ANNULEE" }, periodeDebut: { lte: dateDb(fin) }, periodeFin: { gte: dateDb(debut) } },
      select: { numero: true },
    });
    if (chevauche) throw new AbonnementError("FACTURE_STATUT_INVALIDE", `La facture ${chevauche.numero} couvre déjà cette période.`);

    const actives = a.coproprietes.filter((c) => c.actif).map((c) => c.coproprieteId);
    const reels = [...(await lotsReelsParCopro(db, actives)).values()].reduce((n, x) => n + x, 0);
    const lots = input.lots ?? Math.max(a.lotsContractes, reels);
    const montants = calculerFacture({
      formule: a.formule as Formule,
      basePrix: a.basePrix,
      prixLot: a.prixLot.toString(),
      tauxTva: a.tauxTva.toString(),
      minimumMensuel: a.minimumMensuel?.toString() ?? null,
      forfaitAccompagne: a.forfaitAccompagne?.toString() ?? null,
      lots,
      mois: p.mois,
      tarifFondateur: a.tarifFondateur,
      lignesSupplementaires: input.lignes_supplementaires,
    });
    const aujourdHui = jourCasablanca();
    const numero = await prochainNumero(db, Number(aujourdHui.slice(0, 4)));
    const f = await db.factureAbonnement.create({
      data: {
        numero,
        abonnementId,
        clientId: a.clientId,
        periodeDebut: dateDb(debut),
        periodeFin: dateDb(fin),
        lots,
        lignesJson: { base_prix: montants.base_prix, lignes: montants.lignes, coproprietes: a.coproprietes.filter((c) => c.actif).map((c) => c.copropriete.nom) } as unknown as Prisma.InputJsonValue,
        montantHt: montants.montant_ht,
        montantTva: montants.montant_tva,
        montantTtc: montants.montant_ttc,
        emiseLe: dateDb(aujourdHui),
        echeance: dateDb(ajouterJours(aujourdHui, input.echeance_jours)),
        creePar: ctx.utilisateurId,
      },
    });
    await journaliser(db, abonnementId, "FACTURE_EMISE", ctx.utilisateurId, { facture_id: f.id, numero, periode: [debut, fin], lots, montant_ttc: montants.montant_ttc });
    if (lots > a.lotsContractes) {
      await journaliser(db, abonnementId, "LOTS_DEPASSES", ctx.utilisateurId, { lots_contractes: a.lotsContractes, lots_factures: lots, facture: numero });
    }
    return serialiserFactureCourte(f);
  });
}

export async function enregistrerPaiement(ctx: TenantContext, factureId: string, input: PaiementCreateInput, cleIdempotence?: string) {
  const touchees: string[] = [];
  const res = await enOperateur(ctx, (db) =>
    withIdempotency(ctx, db, { cle: cleIdempotence, endpoint: `POST /admin/factures/${factureId}/paiements`, payload: input }, async () => {
      // Verrou de la facture : deux saisies simultanées ne peuvent pas dépasser le reste dû.
      await db.$queryRaw`SELECT id FROM "facture_abonnement" WHERE id = ${factureId}::uuid FOR UPDATE`;
      const f = await db.factureAbonnement.findUnique({ where: { id: factureId }, include: { paiements: true, abonnement: { include: INCLUDE_ABO } } });
      if (!f) throw new IntrouvableError("Facture introuvable.");
      if (f.statut !== "EMISE") throw new AbonnementError("FACTURE_STATUT_INVALIDE", f.statut === "PAYEE" ? "Facture déjà soldée." : "Facture annulée.");
      const deja = sommePaiements(f.paiements);
      const reste = subtract(f.montantTtc.toString(), deja);
      if (isGreaterThan(input.montant, reste)) {
        throw new AbonnementError("PAIEMENT_SUPERIEUR_RESTE_DU", `Le montant dépasse le reste dû (${toApiString(reste)} MAD).`);
      }
      const p = await db.paiementAbonnement.create({
        data: { factureId, montant: input.montant, mode: input.mode, reference: nul(input.reference), recuLe: dateDb(input.recu_le), saisiPar: ctx.utilisateurId },
      });
      const total = add(deja, input.montant);
      const soldee = !isGreaterThan(f.montantTtc.toString(), total);
      await journaliser(db, f.abonnementId, "PAIEMENT_ENREGISTRE", ctx.utilisateurId, { facture: f.numero, montant: input.montant, mode: input.mode, reference: input.reference ?? null, soldee });
      if (soldee) {
        await db.factureAbonnement.update({ where: { id: factureId }, data: { statut: "PAYEE", payeeLe: dateDb(input.recu_le) } });
        const a = f.abonnement;
        const finFacture = jourIso(f.periodeFin);
        const finActuelle = a.finPeriode ? jourIso(a.finPeriode) : null;
        const nouvelleFin = finActuelle && finActuelle > finFacture ? finActuelle : finFacture;
        // Le paiement fait avancer la période et (ré)ouvre l'accès — sauf résiliation.
        if (a.statut !== "RESILIE") {
          await db.abonnement.update({
            where: { id: a.id },
            data: { statut: "ACTIF", finPeriode: dateDb(nouvelleFin), accesProlongeJusquAu: null, motifProlongation: null, suspenduLe: null, motifSuspension: null },
          });
          await journaliser(db, a.id, "ACTIVE", ctx.utilisateurId, { fin_periode: nouvelleFin, facture: f.numero, statut_precedent: a.statut });
        }
        touchees.push(...a.coproprietes.map((c) => c.coproprieteId));
      }
      return { paiement: serialiserPaiement(p), facture_soldee: soldee, reste_du: toApiString(subtract(f.montantTtc.toString(), total)) };
    })
  );
  invaliderCacheAcces(touchees);
  return res;
}

export async function annulerFacture(ctx: TenantContext, factureId: string, motif: string) {
  return enOperateur(ctx, async (db) => {
    await db.$queryRaw`SELECT id FROM "facture_abonnement" WHERE id = ${factureId}::uuid FOR UPDATE`;
    const f = await db.factureAbonnement.findUnique({ where: { id: factureId }, include: { paiements: { select: { id: true } } } });
    if (!f) throw new IntrouvableError("Facture introuvable.");
    if (f.statut !== "EMISE") throw new AbonnementError("FACTURE_STATUT_INVALIDE", "Seule une facture émise non soldée peut être annulée.");
    if (f.paiements.length > 0) throw new AbonnementError("FACTURE_STATUT_INVALIDE", "Des paiements sont enregistrés sur cette facture : émettez plutôt un avoir.");
    const g = await db.factureAbonnement.update({ where: { id: factureId }, data: { statut: "ANNULEE", annuleeLe: new Date(), motifAnnulation: motif } });
    await journaliser(db, f.abonnementId, "FACTURE_ANNULEE", ctx.utilisateurId, { facture: f.numero, motif });
    return serialiserFactureCourte(g);
  });
}

export async function listerFactures(ctx: TenantContext, filtre: { statut?: "EMISE" | "PAYEE" | "ANNULEE"; en_retard?: boolean } = {}) {
  return enOperateur(ctx, async (db) => {
    const fs = await db.factureAbonnement.findMany({
      where: {
        ...(filtre.statut ? { statut: filtre.statut } : {}),
        ...(filtre.en_retard ? { statut: "EMISE", echeance: { lt: dateDb(jourCasablanca()) } } : {}),
      },
      include: { client: { select: { nom: true } }, paiements: { select: { montant: true } } },
      orderBy: [{ emiseLe: "desc" }, { numero: "desc" }],
      take: 1000,
    });
    return fs.map((f) => ({ ...serialiserFactureCourte(f), client_nom: f.client.nom, paye: toApiString(sommePaiements(f.paiements)) }));
  });
}

export async function obtenirFacture(ctx: TenantContext, factureId: string) {
  return enOperateur(ctx, async (db) => {
    const f = await db.factureAbonnement.findUnique({ where: { id: factureId }, include: { client: true, paiements: { orderBy: { recuLe: "asc" } }, abonnement: { select: { formule: true, periodicite: true, basePrix: true, tauxTva: true } } } });
    if (!f) throw new IntrouvableError("Facture introuvable.");
    return {
      ...serialiserFactureCourte(f),
      lignes: f.lignesJson,
      client: serialiserClient(f.client),
      abonnement: { formule: f.abonnement.formule, periodicite: f.abonnement.periodicite, base_prix: f.abonnement.basePrix, taux_tva: toApiString(f.abonnement.tauxTva.toString()) },
      paiements: f.paiements.map(serialiserPaiement),
      paye: toApiString(sommePaiements(f.paiements)),
      reste_du: toApiString(subtract(f.montantTtc.toString(), sommePaiements(f.paiements))),
    };
  });
}

/* ─────────────────────────── Vue d'ensemble ─────────────────────────── */

export async function vueEnsemble(ctx: TenantContext, maintenant = new Date()) {
  return enOperateur(ctx, async (db) => {
    const abos = await db.abonnement.findMany({ where: { statut: { not: "RESILIE" } }, include: INCLUDE_ABO });
    const lots = await lotsReelsParCopro(db, abos.flatMap((a) => a.coproprietes.filter((c) => c.actif).map((c) => c.coproprieteId)));
    const vues = abos.map((a) => serialiser(a, lots, maintenant));

    const parEtat: Record<string, number> = {};
    let mrr = money(0);
    let lotsFactures = 0;
    for (const v of vues) {
      parEtat[v.etat.etat] = (parEtat[v.etat.etat] ?? 0) + 1;
      if (v.statut === "ACTIF" && v.etat.niveau !== "BLOQUE") {
        mrr = add(mrr, v.mensuel_ht);
        lotsFactures += v.lots_contractes;
      }
    }
    const pipeline = vues.filter((v) => v.statut === "ESSAI").reduce((acc, v) => add(acc, v.mensuel_ht), money(0));

    const aujourdHui = jourCasablanca(maintenant);
    const [ouvertes, enRetard, coprosTotal, coprosCouvertes, evenements, encaisse30] = await Promise.all([
      db.factureAbonnement.aggregate({ where: { statut: "EMISE" }, _sum: { montantTtc: true }, _count: { _all: true } }),
      db.factureAbonnement.findMany({ where: { statut: "EMISE", echeance: { lt: dateDb(aujourdHui) } }, include: { client: { select: { nom: true } } }, orderBy: { echeance: "asc" }, take: 20 }),
      db.copropriete.findMany({ where: { statut: "ACTIVE" }, select: { id: true, nom: true, ville: true, nbLots: true, dateCreation: true } }),
      db.abonnementCopropriete.findMany({ where: { actif: true }, select: { coproprieteId: true } }),
      db.abonnementEvenement.findMany({ orderBy: { horodatage: "desc" }, take: 12, include: { abonnement: { select: { client: { select: { nom: true } } } } } }),
      db.paiementAbonnement.aggregate({ where: { recuLe: { gte: dateDb(ajouterJours(aujourdHui, -30)) } }, _sum: { montant: true } }),
    ]);
    const couvertes = new Set(coprosCouvertes.map((c) => c.coproprieteId));
    const sansAbonnement = coprosTotal.filter((c) => !couvertes.has(c.id));

    const aTraiter = [
      ...vues.filter((v) => v.etat.niveau === "BLOQUE").map((v) => ({ type: "BLOQUE" as const, priorite: 1, v })),
      ...vues.filter((v) => v.etat.niveau === "GRACE").map((v) => ({ type: "GRACE" as const, priorite: 2, v })),
      ...vues.filter((v) => v.etat.etat === "EN_ESSAI" && (v.etat.jours_avant_echeance ?? 99) <= 7).map((v) => ({ type: "FIN_ESSAI" as const, priorite: 3, v })),
      ...vues.filter((v) => v.etat.etat === "RENOUVELLEMENT_PROCHE").map((v) => ({ type: "RENOUVELLEMENT" as const, priorite: 4, v })),
      ...vues.filter((v) => v.depassement_lots).map((v) => ({ type: "DEPASSEMENT_LOTS" as const, priorite: 5, v })),
    ]
      .sort((x, y) => x.priorite - y.priorite || (x.v.etat.jours_avant_blocage ?? 999) - (y.v.etat.jours_avant_blocage ?? 999))
      .map(({ type, v }) => ({
        type,
        abonnement_id: v.id,
        client: v.client.nom,
        coproprietes: v.coproprietes.map((c) => c.nom),
        etat: v.etat,
        lots_contractes: v.lots_contractes,
        lots_reels: v.lots_reels,
      }));

    return {
      calcule_le: maintenant.toISOString(),
      mrr_ht: toApiString(mrr),
      arr_ht: toApiString(multiply(mrr, 12)),
      pipeline_essais_mensuel_ht: toApiString(pipeline),
      encaisse_30j: toApiString(encaisse30._sum.montant?.toString() ?? "0"),
      abonnements_actifs: vues.filter((v) => v.statut === "ACTIF").length,
      essais_en_cours: vues.filter((v) => v.statut === "ESSAI" && v.etat.niveau !== "BLOQUE").length,
      lots_factures: lotsFactures,
      par_etat: parEtat,
      factures_ouvertes: { nombre: ouvertes._count._all, montant_ttc: toApiString(ouvertes._sum.montantTtc?.toString() ?? "0") },
      factures_en_retard: enRetard.map((f) => ({ ...serialiserFactureCourte(f), client_nom: f.client.nom })),
      coproprietes: { total: coprosTotal.length, couvertes: couvertes.size, sans_abonnement: sansAbonnement.map((c) => ({ id: c.id, nom: c.nom, ville: c.ville, nb_lots: c.nbLots, creee_le: c.dateCreation.toISOString() })) },
      a_traiter: aTraiter,
      seuil_alerte_renouvellement_jours: ALERTE_OPERATEUR_RENOUVELLEMENT_JOURS,
      activite_recente: evenements.map((e) => ({ id: e.id, type: e.type, client: e.abonnement.client.nom, abonnement_id: e.abonnementId, details: e.detailsJson, horodatage: e.horodatage.toISOString() })),
    };
  });
}

/* ─────────────────────────── Résidences, utilisateurs, journal ─────────────────────────── */

export async function listerCoproprietesAdmin(ctx: TenantContext, q?: string) {
  return enOperateur(ctx, async (db) => {
    const copros = await db.copropriete.findMany({
      where: q ? { OR: [{ nom: { contains: q, mode: "insensitive" } }, { ville: { contains: q, mode: "insensitive" } }] } : undefined,
      orderBy: { nom: "asc" },
      include: {
        abonnements: { where: { actif: true }, include: { abonnement: { include: { client: { select: { nom: true } } } } } },
        cabinet: { select: { id: true, nom: true } },
      },
    });
    const ids = copros.map((c) => c.id);
    const [lots, comptes] = await Promise.all([
      lotsReelsParCopro(db, ids),
      db.roleUtilisateur.groupBy({ by: ["coproprieteId"], where: { coproprieteId: { in: ids }, actif: true, role: { not: "SUPER_ADMIN" } }, _count: { _all: true } }),
    ]);
    const parCopro = new Map(comptes.map((r) => [r.coproprieteId, r._count._all]));
    return copros.map((c) => {
      const lien = c.abonnements[0];
      return {
        id: c.id, nom: c.nom, ville: c.ville, type_residence: c.typeResidence, statut: c.statut,
        nb_lots_declares: c.nbLots, lots_reels: lots.get(c.id) ?? 0, comptes_actifs: parCopro.get(c.id) ?? 0,
        cabinet: c.cabinet ? { id: c.cabinet.id, nom: c.cabinet.nom } : null,
        creee_le: c.dateCreation.toISOString(),
        abonnement: lien
          ? { id: lien.abonnement.id, client: lien.abonnement.client.nom, formule: lien.abonnement.formule, statut: lien.abonnement.statut, etat: etatAcces(lien.abonnement) }
          : null,
      };
    });
  });
}

export async function listerUtilisateurs(ctx: TenantContext, q: string | undefined, page = 1) {
  return enOperateur(ctx, async (db) => {
    const parPage = 50;
    const where: Prisma.UtilisateurWhereInput = q
      ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { nom: { contains: q, mode: "insensitive" } }, { prenom: { contains: q, mode: "insensitive" } }, { telephone: { contains: q } }] }
      : {};
    const [total, us] = await Promise.all([
      db.utilisateur.count({ where }),
      db.utilisateur.findMany({
        where,
        orderBy: { creeLe: "desc" },
        skip: (Math.max(1, page) - 1) * parPage,
        take: parPage,
        select: {
          id: true, email: true, telephone: true, nom: true, prenom: true, statutCompte: true, creeLe: true,
          roles: { where: { actif: true }, select: { role: true, copropriete: { select: { id: true, nom: true } } } },
        },
      }),
    ]);
    return {
      total, page: Math.max(1, page), par_page: parPage,
      utilisateurs: us.map((u) => ({
        id: u.id, email: u.email, telephone: u.telephone, nom: u.nom, prenom: u.prenom, statut_compte: u.statutCompte, cree_le: u.creeLe.toISOString(),
        roles: u.roles.map((r) => ({ role: r.role, copropriete_id: r.copropriete.id, copropriete_nom: r.copropriete.nom })),
      })),
    };
  });
}

export async function modifierStatutUtilisateur(ctx: TenantContext, utilisateurId: string, statut: "ACTIF" | "SUSPENDU", motif?: string) {
  return enOperateur(ctx, async (db) => {
    if (utilisateurId === ctx.utilisateurId) throw new AbonnementError("UNPROCESSABLE_ENTITY", "Vous ne pouvez pas suspendre votre propre compte.");
    const u = await db.utilisateur.findUnique({ where: { id: utilisateurId }, select: { id: true, statutCompte: true, roles: { where: { actif: true }, select: { coproprieteId: true, role: true } } } });
    if (!u) throw new IntrouvableError("Utilisateur introuvable.");
    if (u.roles.some((r) => r.role === "SUPER_ADMIN")) throw new AbonnementError("UNPROCESSABLE_ENTITY", "Un compte opérateur ne se suspend pas depuis la console.");
    if (!["ACTIF", "SUSPENDU", "EN_VALIDATION", "INVITE"].includes(u.statutCompte)) {
      throw new AbonnementError("UNPROCESSABLE_ENTITY", "Compte désactivé ou anonymisé : statut non modifiable ici.");
    }
    await db.utilisateur.update({ where: { id: utilisateurId }, data: { statutCompte: statut } });
    // Trace probante dans le journal de chaque copropriété où la personne a un rôle.
    for (const coproprieteId of new Set(u.roles.map((r) => r.coproprieteId))) {
      await db.auditLog.create({
        data: { coproprieteId, acteurId: ctx.utilisateurId, action: statut === "SUSPENDU" ? "UTILISATEUR_SUSPENDU" : "UTILISATEUR_REACTIVE", entite: "utilisateur", entiteId: utilisateurId, avantJson: { statut_compte: u.statutCompte }, apresJson: { statut_compte: statut, motif: motif ?? null } },
      });
    }
    return { id: utilisateurId, statut_compte: statut };
  });
}

export async function journalAbonnements(ctx: TenantContext, limite = 200) {
  return enOperateur(ctx, async (db) => {
    const es = await db.abonnementEvenement.findMany({ orderBy: { horodatage: "desc" }, take: Math.min(500, limite), include: { abonnement: { select: { client: { select: { nom: true } } } } } });
    const acteurs = await nomsActeurs(db, es.map((e) => e.acteurId));
    return es.map((e) => ({ id: e.id, type: e.type, abonnement_id: e.abonnementId, client: e.abonnement.client.nom, details: e.detailsJson, acteur: e.acteurId ? acteurs.get(e.acteurId) ?? null : "Système", horodatage: e.horodatage.toISOString() }));
  });
}
