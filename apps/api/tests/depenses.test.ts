/**
 * Tests M16 — Dépenses (Doc A §3, §6, §8) : routage d'approbation (seuil non configuré / sous /
 * au-dessus), réserve sans résolution → 422, réserve insuffisante → 422, paiement depuis la
 * réserve atomique (mouvement + PAYEE, rollback complet en cas d'échec), invariant du total
 * budgétaire, ligne modifiée après activation auditée, dépense pré-remplie depuis un incident,
 * évaluation du prestataire, factures, export CSV journalisé, idempotence, job de rappel J-7,
 * RIB masqué / lecture auditée, conseil : lit mais ne paie pas.
 *
 * Prérequis : Supabase local + migration m16 + rôle app_local.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../lib/storage/supabase-storage", () => ({
  ensureBucketDocuments: async () => undefined,
  creerUrlSignee: async (chemin: string) => `http://127.0.0.1:54321/storage/v1/object/sign/documents/${chemin}`,
  creerUrlUploadSignee: async (chemin: string) => ({ url: `http://127.0.0.1:54321/storage/v1/object/upload/sign/documents/${chemin}`, token: "test" }),
  supprimerObjet: async () => undefined,
  televerserDocument: async () => undefined,
}));
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerDepense,
  modifierDepense,
  soumettreDepense,
  approuverDepense,
  rejeterDepense,
  payerDepense,
  annulerDepense,
  ajouterFacture,
  modifierStatutFacture,
  listerDepenses,
  obtenirDepense,
  documentsDepense,
  exporterDepensesCsv,
  creerDepenseDepuisIncident,
  preparerUploadDepense,
  niveauApprobationRequis,
  DepenseError,
  PermissionRefuseeError,
  CheminHorsPerimetreError,
} from "../lib/depenses/depenses";
import { creerPoste, modifierPoste, supprimerPoste, listerPostes, BudgetPosteError } from "../lib/depenses/budget-postes";
import { budgetVsRealise } from "../lib/depenses/rapports";
import { executerRappelsFacturesCopropriete } from "../lib/depenses/jobs";
import { creerBudget, modifierBudget, activerBudget } from "../lib/finances/budgets";
import { evaluerPrestataireIncident, creerPrestataire, listerPrestataires, IncidentError } from "../lib/incidents/incidents";
import { obtenirPrestataire, lireRibPrestataire, PermissionRefuseeError as PrestaPermission } from "../lib/prestataires/prestataires";
import { depenseCreateSchema, depensePayerSchema, factureCreateSchema } from "../lib/depenses/schemas";
import { money } from "../lib/money";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let copro: string;
let syndic: string;
let conseil: string;
let amina: string; // PROPRIETAIRE, créatrice de l'incident
let lotA1: string;
let prestataire: string;
let incidentResolu: string;
let budgetId: string;
let posteReparations: string;
let posteEnergie: string;
let resolutionAdoptee: string;

const ctx = (utilisateurId: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId, coproprieteId: copro, role });
const ctxSyndic = () => ctx(syndic, "SYNDIC");
const ctxConseil = () => ctx(conseil, "CONSEIL_SYNDICAL");
const ctxAmina = () => ctx(amina, "PROPRIETAIRE");

const pagination = { page: 1, limit: 50, skip: 0, take: 50 };
const tri = { champ: "date_depense" as const, sens: "desc" as const };
const piece = (nom: string) => ({ storage_path: `${copro}/depenses/${randomUUID()}-${nom}`, nom });

async function setSeuil(valeur: string | null) {
  await admin.copropriete.update({ where: { id: copro }, data: { seuilApprobationConseil: valeur } });
}
async function reserve(montant: string) {
  const fonds = await admin.fondsReserve.upsert({ where: { coproprieteId: copro }, create: { coproprieteId: copro }, update: {} });
  await admin.fondsReserveMouvement.create({ data: { fondsReserveId: fonds.id, type: "COTISATION", montant } });
  return fonds.id;
}
async function soldeReserve() {
  const agg = await admin.fondsReserveMouvement.aggregate({ where: { fondsReserve: { coproprieteId: copro } }, _sum: { montant: true } });
  return money(agg._sum.montant ?? 0).toString();
}

beforeAll(async () => {
  const c = await admin.copropriete.create({
    data: { nom: "Résidence Dépenses Tests", adresse: "4 rue Dép", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 4, tvaParDefaut: "20.00" },
  });
  copro = c.id;
  const users = await Promise.all(["syndic", "conseil", "amina"].map((n) => admin.utilisateur.create({ data: { email: `${n}-dep@test.local`, statutCompte: "ACTIF" } })));
  [syndic, conseil, amina] = users.map((u) => u.id) as [string, string, string];
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" },
      { utilisateurId: conseil, coproprieteId: copro, role: "CONSEIL_SYNDICAL" },
      { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" },
    ],
  });
  const lot = await admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "100.00" } });
  lotA1 = lot.id;
  await admin.lotProprietaire.create({ data: { lotId: lotA1, utilisateurId: amina, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") } });
  const p = await admin.prestataire.create({ data: { coproprieteId: copro, nom: "Plomberie Test", specialite: "Plomberie", contact: "+212600000099", rib: "007780000123456789019876" } });
  prestataire = p.id;
  const inc = await admin.incident.create({
    data: { coproprieteId: copro, lotId: lotA1, categorie: "PLOMBERIE", sousCategorie: "Fuite colonne", description: "Fuite au sous-sol", partie: "COMMUNE", urgence: "URGENTE", statut: "RESOLU", creePar: amina, assigneAId: prestataire },
  });
  incidentResolu = inc.id;
  const ag = await admin.assembleeGenerale.create({
    data: { coproprieteId: copro, type: "EXTRAORDINAIRE", dateAg: new Date("2031-01-15T10:00:00Z"), statut: "CLOTUREE", resolutions: { create: [{ ordre: 1, texte: "Pompe surpresseur (réserve)", typeMajorite: "SIMPLE", resultat: "ADOPTEE" }] } },
    include: { resolutions: true },
  });
  resolutionAdoptee = ag.resolutions[0]!.id;
});

afterAll(async () => {
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.fondsReserveMouvement.deleteMany({ where: { fondsReserve: { coproprieteId: copro } } });
  await admin.fondsReserve.deleteMany({ where: { coproprieteId: copro } });
  await admin.depenseLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.facture.deleteMany({ where: { depense: { coproprieteId: copro } } });
  await admin.depense.deleteMany({ where: { coproprieteId: copro } });
  await admin.document.deleteMany({ where: { coproprieteId: copro } });
  await admin.budgetPoste.deleteMany({ where: { budgetAg: { coproprieteId: copro } } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: copro } });
  await admin.agResolution.deleteMany({ where: { ag: { coproprieteId: copro } } });
  await admin.assembleeGenerale.deleteMany({ where: { coproprieteId: copro } });
  await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: copro } } });
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.prestataire.deleteMany({ where: { coproprieteId: copro } });
  await admin.exportLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: lotA1 } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-dep@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("M16 — postes budgétaires et invariant du total", () => {
  it("créer un budget pose une ligne « Budget global » ; le total suit les lignes ; PATCH total refusé au-delà d'une ligne", async () => {
    const budget = await creerBudget(ctxSyndic(), { exercice: "2031", montant_total: "30000.00" });
    budgetId = budget.id;
    const { postes } = await listerPostes(ctxSyndic(), budgetId);
    expect(postes).toHaveLength(1);
    expect(postes[0]!.libelle).toBe("Budget global");
    expect(budget.montantTotal.toString()).toBe("30000");

    // Une seule ligne : le total reste modifiable directement (rétro-compatible M12).
    const maj = await modifierBudget(ctxSyndic(), budgetId, { montant_total: "31000.00" });
    expect(maj.montantTotal.toString()).toBe("31000");

    const rep = await creerPoste(ctxSyndic(), budgetId, { categorie: "REPARATIONS", libelle: "Petites réparations", montant_prevu: "5000.00" });
    posteReparations = rep.poste.id;
    expect(rep.montant_total).toBe("36000.00");
    const en = await creerPoste(ctxSyndic(), budgetId, { categorie: "ENERGIE_EAU", libelle: "Électricité", montant_prevu: "4000.00" });
    posteEnergie = en.poste.id;
    // Réduire la ligne globale au reste : total = 31000 (22000 + 5000 + 4000).
    const globale = postes[0]!;
    const r = await modifierPoste(ctxSyndic(), budgetId, globale.id, { montant_prevu: "22000.00" });
    expect(r.montant_total).toBe("31000.00");

    await expect(modifierBudget(ctxSyndic(), budgetId, { montant_total: "1.00" })).rejects.toMatchObject({ code: "BUDGET_TOTAL_DERIVE_DES_POSTES" });
    // Doublon (catégorie, libellé) → 409.
    await expect(creerPoste(ctxSyndic(), budgetId, { categorie: "REPARATIONS", libelle: "Petites réparations", montant_prevu: "1.00" })).rejects.toMatchObject({ code: "CONFLICT" });
    // Un propriétaire lit les postes mais ne les écrit pas.
    expect((await listerPostes(ctxAmina(), budgetId)).postes).toHaveLength(3);
    await expect(creerPoste(ctxAmina(), budgetId, { categorie: "AUTRE", libelle: "X", montant_prevu: "1.00" })).rejects.toBeInstanceOf(Error);
  });

  it("ligne modifiée après activation : autorisée au syndic et auditée BUDGET_POSTE_MODIFIE_APRES_ACTIVATION", async () => {
    await activerBudget(ctxSyndic(), budgetId);
    await modifierPoste(ctxSyndic(), budgetId, posteEnergie, { montant_prevu: "4500.00" });
    const audit = await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "BUDGET_POSTE_MODIFIE_APRES_ACTIVATION", entiteId: budgetId } });
    expect(audit).not.toBeNull();
    const b = await admin.budgetAg.findUniqueOrThrow({ where: { id: budgetId } });
    expect(b.montantTotal.toString()).toBe("31500");
  });
});

describe("M16 — routage d'approbation", () => {
  it("seuil NON configuré : soumettre → A_APPROUVER, le syndic approuve explicitement, le rapport signale le seuil manquant", async () => {
    await setSeuil(null);
    const d = await creerDepense(ctxSyndic(), { categorie: "ENERGIE_EAU", libelle: "Électricité janvier", montant_ttc: "800.00", date_depense: "2031-01-20", source: "COMPTE_COURANT", budget_poste_id: posteEnergie });
    expect(d.statut).toBe("BROUILLON");
    const soumise = await soumettreDepense(ctxSyndic(), d.id);
    expect(soumise.statut).toBe("A_APPROUVER");
    expect(soumise.niveau_approbation_requis).toBe("SYNDIC");
    expect(soumise.seuil_non_configure).toBe(true);
    const approuvee = await approuverDepense(ctxSyndic(), d.id);
    expect(approuvee.statut).toBe("APPROUVEE");
    const rapport = await budgetVsRealise(ctxSyndic(), "2031");
    expect(rapport.seuil_non_configure).toBe(true);
    expect(rapport.postes.find((p) => p.poste_id === posteEnergie)?.engage).toBe("800.00");
  });

  it("seuil configuré : sous le seuil → APPROUVEE d'office par le syndic ; au-dessus → conseil seul (syndic 422), notification au conseil", async () => {
    await setSeuil("5000.00");
    expect(niveauApprobationRequis(money("5000"), "5000.00")).toBe("SYNDIC");
    expect(niveauApprobationRequis(money("5000"), "5000.01")).toBe("CONSEIL");

    const petite = await creerDepense(ctxSyndic(), { categorie: "REPARATIONS", libelle: "Joint", montant_ttc: "120.00", date_depense: "2031-02-01", source: "COMPTE_COURANT", budget_poste_id: posteReparations });
    const s1 = await soumettreDepense(ctxSyndic(), petite.id);
    expect(s1.statut).toBe("APPROUVEE");
    expect(s1.approuveParId).toBe(syndic);

    const grosse = await creerDepense(ctxSyndic(), { categorie: "TRAVAUX", libelle: "Ravalement acompte", montant_ttc: "18000.00", date_depense: "2031-02-02", source: "COMPTE_COURANT" });
    const s2 = await soumettreDepense(ctxSyndic(), grosse.id);
    expect(s2.statut).toBe("A_APPROUVER");
    expect(s2.niveau_approbation_requis).toBe("CONSEIL");
    const notif = await admin.notification.findFirst({ where: { coproprieteId: copro, utilisateurId: conseil, templateCode: "DEPENSE_A_APPROUVER" } });
    expect(notif).not.toBeNull();

    await expect(approuverDepense(ctxSyndic(), grosse.id)).rejects.toMatchObject({ code: "DEPENSE_APPROBATION_CONSEIL_REQUISE" });
    await expect(rejeterDepense(ctxAmina(), grosse.id, { motif: "non" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const rejetee = await rejeterDepense(ctxConseil(), grosse.id, { motif: "Trois devis requis." });
    expect(rejetee.statut).toBe("REJETEE");
    expect(rejetee.motifRejet).toBe("Trois devis requis.");
    const notifSyndic = await admin.notification.findFirst({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "DEPENSE_REJETEE" } });
    expect(notifSyndic).not.toBeNull();

    // REJETEE : modifiable puis re-soumise ; le conseil approuve.
    await modifierDepense(ctxSyndic(), grosse.id, { description: "3 devis joints", montant_ttc: "17500.00" });
    const s3 = await soumettreDepense(ctxSyndic(), grosse.id);
    expect(s3.statut).toBe("A_APPROUVER");
    const ok = await approuverDepense(ctxConseil(), grosse.id);
    expect(ok.statut).toBe("APPROUVEE");
    expect(ok.approuveParId).toBe(conseil);
    // Transitions invalides.
    await expect(approuverDepense(ctxConseil(), grosse.id)).rejects.toMatchObject({ code: "DEPENSE_STATUT_INVALIDE" });
    await expect(modifierDepense(ctxSyndic(), grosse.id, { libelle: "X" })).rejects.toMatchObject({ code: "DEPENSE_STATUT_INVALIDE" });
  });

  it("le conseil syndical lit tout mais ne crée ni ne paie", async () => {
    const { rows } = await listerDepenses(ctxConseil(), {}, pagination, tri);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    await expect(creerDepense(ctxConseil(), { categorie: "AUTRE", libelle: "X", montant_ttc: "1.00", date_depense: "2031-01-01", source: "COMPTE_COURANT" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const approuvee = rows.find((r) => r.statut === "APPROUVEE")!;
    await expect(payerDepense(ctxConseil(), approuvee.id, { methode: "ESPECES", date_paiement: "2031-03-01" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    // Un propriétaire ne lit pas la liste (accès résident via la transparence M18 uniquement).
    await expect(listerDepenses(ctxAmina(), {}, pagination, tri)).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("M16 — paiement, factures, fonds de réserve", () => {
  it("payer (compte courant) : PAYEE, preuve = Document JUSTIFICATIF_DEPENSE, factures RECUE → REGLEE, idempotent", async () => {
    const d = await creerDepense(ctxSyndic(), { categorie: "REPARATIONS", libelle: "Fuite colonne", montant_ht: "2000.00", tva: "400.00", montant_ttc: "2400.00", date_depense: "2031-03-01", source: "COMPTE_COURANT", prestataire_id: prestataire, budget_poste_id: posteReparations });
    await soumettreDepense(ctxSyndic(), d.id);
    const f = await ajouterFacture(ctxSyndic(), d.id, { numero: "FA-0231", date_facture: "2031-03-01", date_echeance: "2031-03-20", montant_ttc: "2400.00", document: piece("facture.pdf") }, randomUUID());
    expect(f.statut).toBe("RECUE");
    expect(f.document.type).toBe("FACTURE");
    const cle = randomUUID();
    const payload = { methode: "VIREMENT" as const, reference: "VIR-2031-001", date_paiement: "2031-03-05", justificatif: piece("recu.pdf") };
    const payee = await payerDepense(ctxSyndic(), d.id, payload, cle);
    expect(payee.statut).toBe("PAYEE");
    expect(payee.justificatifPaiementDocumentId).toBeTruthy();
    expect(payee.factures[0]!.statut).toBe("REGLEE");
    // Rejeu même clé + même payload : réponse identique, aucune 2e écriture.
    const rejouee = await payerDepense(ctxSyndic(), d.id, payload, cle);
    expect(rejouee.id).toBe(d.id);
    expect(await admin.depenseLog.count({ where: { depenseId: d.id, type: "PAYEE" } })).toBe(1);
    const docs = await documentsDepense(ctxSyndic(), d.id);
    expect(docs.factures).toHaveLength(1);
    expect(docs.justificatif_paiement?.url).toContain("/sign/documents/");
    const detail = await obtenirDepense(ctxConseil(), d.id);
    expect(detail.logs.map((l) => l.type)).toEqual(["CREEE", "SOUMISE", "APPROUVEE", "FACTURE_AJOUTEE", "PAYEE"]);
    // PAYEE : ni modification ni annulation.
    await expect(annulerDepense(ctxSyndic(), d.id, {})).rejects.toMatchObject({ code: "DEPENSE_STATUT_INVALIDE" });
    const audit = await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "DEPENSE_PAYEE", entiteId: d.id } });
    expect(audit).not.toBeNull();
  });

  it("réserve sans résolution ADOPTEE → 422 DEPENSE_RESERVE_RESOLUTION_REQUISE, sauf paramètre de règlement", async () => {
    const d = await creerDepense(ctxSyndic(), { categorie: "TRAVAUX", libelle: "Pompe", montant_ttc: "6000.00", date_depense: "2031-04-01", source: "FONDS_RESERVE" });
    await expect(soumettreDepense(ctxSyndic(), d.id)).rejects.toMatchObject({ code: "DEPENSE_RESERVE_RESOLUTION_REQUISE" });
    await admin.copropriete.update({ where: { id: copro }, data: { reserveSansResolutionAutorisee: true } });
    const s = await soumettreDepense(ctxSyndic(), d.id);
    expect(s.statut).toBe("A_APPROUVER");
    await admin.copropriete.update({ where: { id: copro }, data: { reserveSansResolutionAutorisee: false } });
    await annulerDepense(ctxSyndic(), d.id, { motif: "test" });
  });

  it("réserve insuffisante → 422 FONDS_RESERVE_INSUFFISANT ; paiement couvert → mouvement DEPENSE lié, solde décrémenté", async () => {
    await reserve("5000.00");
    const d = await creerDepense(ctxSyndic(), { categorie: "TRAVAUX", libelle: "Pompe surpresseur", montant_ttc: "6000.00", date_depense: "2031-04-02", source: "FONDS_RESERVE", resolution_ag_id: resolutionAdoptee, prestataire_id: prestataire });
    await soumettreDepense(ctxSyndic(), d.id);
    await approuverDepense(ctxConseil(), d.id);
    await expect(payerDepense(ctxSyndic(), d.id, { methode: "VIREMENT", reference: "VIR-R1", date_paiement: "2031-04-03" })).rejects.toMatchObject({ code: "FONDS_RESERVE_INSUFFISANT" });
    expect(await soldeReserve()).toBe("5000");
    await reserve("3000.00");
    const payee = await payerDepense(ctxSyndic(), d.id, { methode: "VIREMENT", reference: "VIR-R1", date_paiement: "2031-04-03" });
    expect(payee.statut).toBe("PAYEE");
    expect(payee.mouvementsFondsReserve).toHaveLength(1);
    expect(payee.mouvementsFondsReserve[0]!.montant.toString()).toBe("-6000");
    expect(payee.mouvementsFondsReserve[0]!.resolutionAgId).toBe(resolutionAdoptee);
    expect(await soldeReserve()).toBe("2000");
    const rapport = await budgetVsRealise(ctxConseil(), "2031");
    expect(rapport.fonds_reserve.solde).toBe("2000.00");
    expect(rapport.fonds_reserve.decaisse_exercice).toBe("6000.00");
  });

  it("paiement depuis la réserve atomique : un échec après l'écriture du mouvement annule tout (aucun mouvement, statut inchangé)", async () => {
    await reserve("1000.00");
    const d = await creerDepense(ctxSyndic(), { categorie: "TRAVAUX", libelle: "Atomicité", montant_ttc: "500.00", date_depense: "2031-04-10", source: "FONDS_RESERVE", resolution_ag_id: resolutionAdoptee });
    await soumettreDepense(ctxSyndic(), d.id); // sous le seuil → APPROUVEE
    const soldeAvant = await soldeReserve();
    // Justificatif bien formé mais hors du périmètre de la copropriété : rejeté APRÈS l'insertion
    // du mouvement de réserve → la transaction entière est annulée.
    const horsPerimetre = { storage_path: `${randomUUID()}/depenses/${randomUUID()}-recu.pdf`, nom: "recu.pdf" };
    await expect(payerDepense(ctxSyndic(), d.id, { methode: "ESPECES", date_paiement: "2031-04-11", justificatif: horsPerimetre })).rejects.toBeInstanceOf(CheminHorsPerimetreError);
    expect(await soldeReserve()).toBe(soldeAvant);
    expect(await admin.fondsReserveMouvement.count({ where: { depenseId: d.id } })).toBe(0);
    const apres = await admin.depense.findUniqueOrThrow({ where: { id: d.id } });
    expect(apres.statut).toBe("APPROUVEE");
    expect(await admin.document.count({ where: { coproprieteId: copro, storagePath: horsPerimetre.storage_path } })).toBe(0);
  });

  it("facture contestée journalisée ; rappel J-7 envoyé une fois par le job ; export CSV journalisé", async () => {
    const d = await creerDepense(ctxSyndic(), { categorie: "ENTRETIEN_COURANT", libelle: "Nettoyage mars", montant_ttc: "1000.00", date_depense: "2031-03-31", source: "COMPTE_COURANT" });
    await soumettreDepense(ctxSyndic(), d.id);
    const now = new Date("2031-04-01T08:00:00Z");
    const f = await ajouterFacture(ctxSyndic(), d.id, { numero: "F-NET-03", date_facture: "2031-03-31", date_echeance: "2031-04-06", montant_ttc: "1000.00", document: piece("f.pdf") });
    const c = await modifierStatutFacture(ctxSyndic(), d.id, f.id, { statut: "CONTESTEE" });
    expect(c.statut).toBe("CONTESTEE");
    expect(await admin.depenseLog.count({ where: { depenseId: d.id, type: "FACTURE_CONTESTEE" } })).toBe(1);
    // Contestée : pas de rappel. Repassée VERIFIEE : rappel J-7, une seule fois.
    expect((await executerRappelsFacturesCopropriete(copro, now)).rappels).toBe(0);
    await modifierStatutFacture(ctxSyndic(), d.id, f.id, { statut: "VERIFIEE" });
    expect((await executerRappelsFacturesCopropriete(copro, now)).rappels).toBe(1);
    expect((await executerRappelsFacturesCopropriete(copro, now)).rappels).toBe(0);
    const notif = await admin.notification.findFirst({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "FACTURE_ECHEANCE_PROCHE" } });
    expect(notif).not.toBeNull();

    const csv = await exporterDepensesCsv(ctxConseil(), { exercice: "2031" });
    expect(csv.entetes[0]).toBe("date");
    expect(csv.nbLignes).toBeGreaterThanOrEqual(5);
    expect(csv.lignes.every((l) => /^\d+\.\d{2}$/.test(String(l[7])))).toBe(true);
    const journal = await admin.exportLog.findFirst({ where: { coproprieteId: copro, type: "DEPENSES", utilisateurId: conseil } });
    expect(journal).not.toBeNull();
    await expect(exporterDepensesCsv(ctxAmina(), {})).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("liste : filtres, totaux par statut, tri ; poste ↔ catégorie incohérents → 422", async () => {
    const { rows, totaux } = await listerDepenses(ctxSyndic(), { statut: "PAYEE", exercice: "2031" }, pagination, { champ: "montant_ttc", sens: "desc" });
    expect(rows.every((r) => r.statut === "PAYEE")).toBe(true);
    expect(Number(rows[0]!.montantTtc)).toBeGreaterThanOrEqual(Number(rows[rows.length - 1]!.montantTtc));
    expect(totaux.par_statut.PAYEE?.nb).toBe(rows.length);
    await expect(
      creerDepense(ctxSyndic(), { categorie: "ASSURANCE", libelle: "X", montant_ttc: "10.00", date_depense: "2031-05-01", source: "COMPTE_COURANT", budget_poste_id: posteEnergie })
    ).rejects.toMatchObject({ code: "UNPROCESSABLE_ENTITY" });
  });

  it("validation Zod : HT + TVA ≠ TTC refusé, référence obligatoire hors espèces, chemin de facture typé", () => {
    expect(depenseCreateSchema.safeParse({ categorie: "AUTRE", libelle: "X", montant_ht: "100.00", tva: "10.00", montant_ttc: "120.00", date_depense: "2031-01-01", source: "COMPTE_COURANT" }).success).toBe(false);
    expect(depenseCreateSchema.safeParse({ categorie: "AUTRE", libelle: "X", montant_ttc: "0.00", date_depense: "2031-01-01", source: "COMPTE_COURANT" }).success).toBe(false);
    expect(depenseCreateSchema.safeParse({ categorie: "AUTRE", libelle: "X", montant_ttc: "12.5", date_depense: "2031-01-01" }).success).toBe(false); // source obligatoire
    expect(depensePayerSchema.safeParse({ methode: "VIREMENT", date_paiement: "2031-01-01" }).success).toBe(false);
    expect(depensePayerSchema.safeParse({ methode: "ESPECES", date_paiement: "2031-01-01" }).success).toBe(true);
    expect(factureCreateSchema.safeParse({ date_facture: "2031-01-01", montant_ttc: "1.00", document: { storage_path: "../etc/passwd", nom: "x" } }).success).toBe(false);
  });
});

describe("M16 — incident → dépense, évaluation du prestataire, fiche fournisseur", () => {
  it("POST /incidents/{id}/depense pré-remplit prestataire, catégorie, libellé ; le détail de l'incident expose les dépenses au syndic", async () => {
    const d = await creerDepenseDepuisIncident(ctxSyndic(), incidentResolu, { montant_ttc: "900.00", source: "COMPTE_COURANT" });
    expect(d.statut).toBe("BROUILLON");
    expect(d.prestataireId).toBe(prestataire);
    expect(d.incidentId).toBe(incidentResolu);
    expect(d.categorie).toBe("REPARATIONS");
    expect(d.libelle).toContain("Fuite colonne");
    expect(d.description).toBe("Fuite au sous-sol");
    await expect(creerDepenseDepuisIncident(ctxConseil(), incidentResolu, { montant_ttc: "1.00", source: "COMPTE_COURANT" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const { obtenirIncidentAvecJournal } = await import("../lib/incidents/incidents");
    const detail = await obtenirIncidentAvecJournal(ctxSyndic(), incidentResolu);
    expect(detail.depenses.some((x) => x.id === d.id)).toBe(true);
    expect(detail.total_depenses).toBe("0.00"); // brouillon non compté
    // La créatrice voit son incident mais pas les brouillons de dépenses (RLS) et pas de total.
    const vueAmina = await obtenirIncidentAvecJournal(ctxAmina(), incidentResolu);
    expect(vueAmina.depenses).toEqual([]);
    expect(vueAmina.total_depenses).toBeNull();
  });

  it("évaluation : créatrice du ticket une fois (409 ensuite), incident non résolu → 422, note moyenne recalculée", async () => {
    const autre = await admin.incident.create({ data: { coproprieteId: copro, categorie: "PLOMBERIE", sousCategorie: "Autre", partie: "COMMUNE", urgence: "NORMALE", statut: "EN_COURS", creePar: amina, assigneAId: prestataire } });
    await expect(evaluerPrestataireIncident(ctxAmina(), autre.id, { note: 5 })).rejects.toMatchObject({ code: "INCIDENT_NON_RESOLU" });
    await expect(evaluerPrestataireIncident(ctxConseil(), incidentResolu, { note: 5 })).rejects.toBeInstanceOf(Error);
    const r = await evaluerPrestataireIncident(ctxAmina(), incidentResolu, { note: 4, commentaire: "Rapide." });
    expect(r.incident.notePrestataire).toBe(4);
    expect(r.note_moyenne).toBe("4.00");
    expect(r.nb_evaluations).toBe(1);
    await expect(evaluerPrestataireIncident(ctxAmina(), incidentResolu, { note: 2 })).rejects.toBeInstanceOf(IncidentError);
    await expect(evaluerPrestataireIncident(ctxAmina(), incidentResolu, { note: 2 })).rejects.toMatchObject({ code: "INCIDENT_DEJA_EVALUE" });
    // Le syndic note un second incident résolu : moyenne (4 + 2) / 2 = 3.
    await admin.incident.update({ where: { id: autre.id }, data: { statut: "RESOLU" } });
    const r2 = await evaluerPrestataireIncident(ctxSyndic(), autre.id, { note: 2 });
    expect(r2.note_moyenne).toBe("3.00");
    expect((await admin.prestataire.findUniqueOrThrow({ where: { id: prestataire } })).noteMoyenne?.toString()).toBe("3");
    const audit = await admin.auditLog.count({ where: { coproprieteId: copro, action: "INCIDENT_PRESTATAIRE_EVALUE" } });
    expect(audit).toBe(2);
  });

  it("RIB : masqué partout (4 derniers caractères), complet pour le syndic seul et audité ; fiche = historique + dépenses selon le rôle", async () => {
    const liste = await listerPrestataires(ctxConseil());
    const p = liste.find((x) => x.id === prestataire)!;
    expect((p as unknown as { rib?: string }).rib).toBeUndefined();
    expect(p.ribMasque).toBe("•••• 9876");
    expect(p.ribRenseigne).toBe(true);
    await expect(lireRibPrestataire(ctxConseil(), prestataire)).rejects.toBeInstanceOf(PrestaPermission);
    const rib = await lireRibPrestataire(ctxSyndic(), prestataire);
    expect(rib.rib).toBe("007780000123456789019876");
    const audit = await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "PRESTATAIRE_RIB_CONSULTE", entiteId: prestataire } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit!.apresJson)).not.toContain("9876");

    const fiche = await obtenirPrestataire(ctxSyndic(), prestataire);
    expect(fiche.nb_interventions).toBe(2);
    expect(fiche.evaluations).toHaveLength(2);
    expect(fiche.depenses?.total_paye).toBe("8400.00"); // 2400 + 6000
    const ficheGardien = await obtenirPrestataire(ctx(conseil, "GARDIEN"), prestataire);
    expect(ficheGardien.depenses).toBeNull();

    const cree = await creerPrestataire(ctxSyndic(), { nom: "Élec Pro", specialite: "Électricité", telephone: "+212 661 00 00 00", ice: "001234567000089", rib: "007780000123456789010000" });
    expect(cree.contact).toBe("+212 661 00 00 00");
    expect(cree.ribMasque).toBe("•••• 0000");
  });

  it("upload-url : chemin dans le périmètre `<copro>/depenses/`, syndic seul", async () => {
    const u = await preparerUploadDepense(ctxSyndic(), { nom_fichier: "Facture Août.pdf", content_type: "application/pdf" });
    expect(u.storage_path.startsWith(`${copro}/depenses/`)).toBe(true);
    expect(u.storage_path).toMatch(/Facture-Aout\.pdf$/);
    await expect(preparerUploadDepense(ctxConseil(), { nom_fichier: "x.pdf", content_type: "application/pdf" })).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("suppression d'un poste référencé → 409 BUDGET_POSTE_UTILISE", async () => {
    await expect(supprimerPoste(ctxSyndic(), budgetId, posteReparations)).rejects.toBeInstanceOf(BudgetPosteError);
    await expect(supprimerPoste(ctxSyndic(), budgetId, posteReparations)).rejects.toMatchObject({ code: "BUDGET_POSTE_UTILISE" });
    // Rapport : hors poste regroupé par catégorie (le ravalement et la pompe n'ont pas de poste).
    const rapport = await budgetVsRealise(ctxSyndic(), "2031");
    expect(rapport.hors_poste.find((h) => h.categorie === "TRAVAUX")).toBeTruthy();
    expect(rapport.totaux.montant_prevu).toBe("31500.00");
    expect(rapport.nb_a_approuver).toBe(0);
  });
});
