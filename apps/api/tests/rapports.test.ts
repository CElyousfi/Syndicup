/**
 * Tests M18 — Rapports (Doc A §8 reddition des comptes, §6 approbation des comptes, §3.5 transparence).
 * Réconciliation instantané du rapport ↔ grand livre (mêmes fonctions, mêmes chiffres) ; PDF FR + AR
 * (rapport, relevé) ; transparence sans AUCUNE donnée par lot pour LOCATAIRE et PROPRIETAIRE (test
 * négatif explicite) ; exports journalisés dans export_log (lots, propriétaires syndic seul, relevé du
 * propriétaire scopé, grand livre xlsx) ; hook AG : soumission → résolution créée par le service AG,
 * majorité non configurée → 422, finalisation → APPROUVE ; régénération / 409.
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
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { tableauDeBord } from "../lib/rapports/tableau-de-bord";
import { vueTransparence, definirFacturesVisibles } from "../lib/rapports/transparence";
import { obtenirGrandLivre, exporterGrandLivre } from "../lib/rapports/grand-livre";
import { genererRapportGestion, obtenirRapportGestion, listerRapportsGestion, pdfRapportGestion, soumettreRapportAg } from "../lib/rapports/gestion";
import { obtenirReleveLot, pdfReleveLot } from "../lib/rapports/releve";
import { exporterLots, exporterProprietaires, exporterPaiements, exporterIncidents, listerImpayes, exporterImpayes, listerExportsJournal } from "../lib/rapports/exports";
import { PermissionRefuseeError, ConflitError } from "../lib/rapports/erreurs";
import { bufferXlsx } from "../lib/http/export";
import { creerAg, finaliserResolution } from "../lib/ag/ag";
import { money } from "../lib/money";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, conseil: string, amina: string, bob: string, loc: string, gardien: string, lotA1: string, lotA2: string, lotA3: string, prestataire: string, agId: string;
const EX = "2025";
const ctx = (u: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId: u, coproprieteId: copro, role });
const S = () => ctx(syndic, "SYNDIC");
const C = () => ctx(conseil, "CONSEIL_SYNDICAL");
const A = () => ctx(amina, "PROPRIETAIRE");
const L = () => ctx(loc, "LOCATAIRE");
const pagination = { page: 1, limit: 50, skip: 0, take: 50 };
const d = (s: string) => new Date(`${s}T10:00:00.000Z`);

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence Rapports", adresse: "9 rue R", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 3, totalTantiemes: "300.00" } });
  copro = c.id;
  const users = await Promise.all(["syndic", "conseil", "amina", "bob", "loc", "gardien"].map((n) => admin.utilisateur.create({ data: { email: `${n}-rapports@test.local`, nom: n.toUpperCase(), prenom: "Test", statutCompte: "ACTIF" } })));
  [syndic, conseil, amina, bob, loc, gardien] = users.map((u) => u.id) as [string, string, string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: conseil, coproprieteId: copro, role: "CONSEIL_SYNDICAL" },
    { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" }, { utilisateurId: bob, coproprieteId: copro, role: "PROPRIETAIRE" },
    { utilisateurId: loc, coproprieteId: copro, role: "LOCATAIRE" }, { utilisateurId: gardien, coproprieteId: copro, role: "GARDIEN" },
  ] });
  const lots = await Promise.all(["A1", "A2", "A3"].map((n) => admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: n, tantiemes: "100.00" } })));
  [lotA1, lotA2, lotA3] = lots.map((l) => l.id) as [string, string, string];
  await admin.lotProprietaire.createMany({ data: [
    { lotId: lotA1, utilisateurId: amina, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    { lotId: lotA2, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    { lotId: lotA3, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  ] });
  await admin.lotOccupant.create({ data: { lotId: lotA1, utilisateurId: loc, typeOccupation: "LOCATAIRE", dateDebut: new Date("2025-01-01") } });
  // Appels 2025 : janvier (3 × 1000) et février (3 × 1000), échus depuis longtemps.
  const jan = await admin.appelDeFonds.create({ data: { coproprieteId: copro, periode: `${EX}-01`, type: "CHARGES_COURANTES", montantTotal: "3000.00", dateEcheance: new Date(`${EX}-01-10`), statut: "EMIS", lignes: { create: [{ lotId: lotA1, montantDu: "1000.00", montantPaye: "1000.00", statut: "PAYE" }, { lotId: lotA2, montantDu: "1000.00", montantPaye: "400.00", statut: "PARTIEL" }, { lotId: lotA3, montantDu: "1000.00" }] } }, include: { lignes: true } });
  const fev = await admin.appelDeFonds.create({ data: { coproprieteId: copro, periode: `${EX}-02`, type: "CHARGES_COURANTES", montantTotal: "3000.00", dateEcheance: new Date(`${EX}-02-10`), statut: "EMIS", lignes: { create: [{ lotId: lotA1, montantDu: "1000.00", montantPaye: "1000.00", statut: "PAYE" }, { lotId: lotA2, montantDu: "1000.00" }, { lotId: lotA3, montantDu: "1000.00" }] } }, include: { lignes: true } });
  const lg = (appel: typeof jan, lot: string) => appel.lignes.find((l) => l.lotId === lot)!.id;
  // Paiements VALIDE 2025 : A1 janv 1000, A1 fév 1000, A2 janv 400 → 2400 d'entrées.
  await admin.paiement.createMany({ data: [
    { lotId: lotA1, appelDeFondsLotId: lg(jan, lotA1), montant: "1000.00", methode: "VIREMENT", statut: "VALIDE", horodatage: d(`${EX}-01-05`) },
    { lotId: lotA1, appelDeFondsLotId: lg(fev, lotA1), montant: "1000.00", methode: "CMI", statut: "VALIDE", horodatage: d(`${EX}-02-05`), referenceCmi: `CMI-${randomUUID()}` },
    { lotId: lotA2, appelDeFondsLotId: lg(jan, lotA2), montant: "400.00", methode: "ESPECES", statut: "VALIDE", horodatage: d(`${EX}-03-01`) },
  ] });
  // Budget ACTIF 2025 avec 2 postes ; dépenses PAYEE : 700 (poste énergie), 500 (réparations, hors poste), 2000 réserve.
  const budget = await admin.budgetAg.create({ data: { coproprieteId: copro, exercice: EX, montantTotal: "5000.00", statut: "ACTIF" } });
  const posteEnergie = await admin.budgetPoste.create({ data: { budgetAgId: budget.id, categorie: "ENERGIE_EAU", libelle: "Électricité communs", montantPrevu: "3000.00", ordre: 1 } });
  await admin.budgetPoste.create({ data: { budgetAgId: budget.id, categorie: "REPARATIONS", libelle: "Petites réparations", montantPrevu: "2000.00", ordre: 2 } });
  const p = await admin.prestataire.create({ data: { coproprieteId: copro, nom: "Lydec Test", specialite: "Énergie", contact: "+212600000098" } });
  prestataire = p.id;
  const dep1 = await admin.depense.create({ data: { coproprieteId: copro, budgetAgId: budget.id, budgetPosteId: posteEnergie.id, prestataireId: prestataire, categorie: "ENERGIE_EAU", libelle: "Facture électricité T1", montantTtc: "700.00", dateDepense: new Date(`${EX}-03-15`), statut: "PAYEE", source: "COMPTE_COURANT", creeParId: syndic, payeLe: new Date(`${EX}-03-20`), methodePaiement: "VIREMENT" } });
  await admin.depense.create({ data: { coproprieteId: copro, categorie: "REPARATIONS", libelle: "Serrure porte hall", montantTtc: "500.00", dateDepense: new Date(`${EX}-04-02`), statut: "PAYEE", source: "COMPTE_COURANT", creeParId: syndic, payeLe: new Date(`${EX}-04-05`), methodePaiement: "ESPECES" } });
  await admin.depense.create({ data: { coproprieteId: copro, categorie: "TRAVAUX", libelle: "Brouillon non payé", montantTtc: "9999.00", dateDepense: new Date(`${EX}-05-02`), statut: "A_APPROUVER", source: "COMPTE_COURANT", creeParId: syndic } });
  const docFacture = await admin.document.create({ data: { coproprieteId: copro, type: "FACTURE", nom: "Facture Lydec T1.pdf", visibilite: "SYNDIC_ONLY", storagePath: `${copro}/depenses/${randomUUID()}-lydec.pdf`, creePar: syndic } });
  await admin.facture.create({ data: { depenseId: dep1.id, prestataireId: prestataire, numero: "LYD-2025-001", dateFacture: new Date(`${EX}-03-10`), montantTtc: "700.00", statut: "REGLEE", documentId: docFacture.id } });
  // Fonds de réserve : cotisation 2024 (5000), cotisation 2025 (1000), décaissement 2025 lié à une dépense réserve (−2000).
  const fonds = await admin.fondsReserve.create({ data: { coproprieteId: copro } });
  const depReserve = await admin.depense.create({ data: { coproprieteId: copro, categorie: "TRAVAUX", libelle: "Pompe de relevage", montantTtc: "2000.00", dateDepense: new Date(`${EX}-06-01`), statut: "PAYEE", source: "FONDS_RESERVE", creeParId: syndic, payeLe: new Date(`${EX}-06-10`), methodePaiement: "VIREMENT" } });
  await admin.fondsReserveMouvement.createMany({ data: [
    { fondsReserveId: fonds.id, type: "COTISATION", montant: "5000.00", description: "Dotation 2024", horodatage: d("2024-12-01") },
    { fondsReserveId: fonds.id, type: "COTISATION", montant: "1000.00", description: "Dotation 2025", horodatage: d(`${EX}-01-20`) },
    { fondsReserveId: fonds.id, type: "DEPENSE", montant: "-2000.00", description: "Pompe de relevage", depenseId: depReserve.id, horodatage: d(`${EX}-06-10`) },
  ] });
  await admin.incident.create({ data: { coproprieteId: copro, categorie: "PLOMBERIE", sousCategorie: "Fuite", partie: "COMMUNE", urgence: "URGENCE_MAXIMALE", statut: "RESOLU", creePar: amina, creeLe: d(`${EX}-06-01`) } });
  await admin.incident.create({ data: { coproprieteId: copro, categorie: "ELECTRICITE", sousCategorie: "Panne", partie: "COMMUNE", urgence: "URGENTE", statut: "OUVERT", creePar: bob } });
  const ag = await creerAg(S(), { type: "ORDINAIRE", date_ag: new Date(Date.now() + 30 * 86400000).toISOString() });
  agId = ag.id;
});

afterAll(async () => {
  await admin.exportLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.rapportGestion.deleteMany({ where: { coproprieteId: copro } });
  await admin.agVote.deleteMany({ where: { resolution: { agId } } });
  await admin.agResolution.deleteMany({ where: { agId } });
  await admin.agNotificationLog.deleteMany({ where: { agId } });
  await admin.assembleeGenerale.deleteMany({ where: { coproprieteId: copro } });
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.facture.deleteMany({ where: { depense: { coproprieteId: copro } } });
  await admin.fondsReserveMouvement.deleteMany({ where: { fondsReserve: { coproprieteId: copro } } });
  await admin.fondsReserve.deleteMany({ where: { coproprieteId: copro } });
  await admin.depense.deleteMany({ where: { coproprieteId: copro } });
  await admin.document.deleteMany({ where: { coproprieteId: copro } });
  await admin.budgetPoste.deleteMany({ where: { budgetAg: { coproprieteId: copro } } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: copro } });
  await admin.prestataire.deleteMany({ where: { coproprieteId: copro } });
  await admin.paiement.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFonds: { coproprieteId: copro } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotOccupant.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.lotProprietaire.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-rapports@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect(); await disconnectTenantDb();
});

describe("M18 — tableau de bord et grand livre", () => {
  it("trésorerie = Σ paiements − Σ dépenses compte courant ; réserve = ledger ; ancienneté ; top lots ; propriétaire refusé", async () => {
    const tb = await tableauDeBord(C(), EX, new Date());
    expect(tb.tresorerie.total_entrees).toBe("2400.00");
    expect(tb.tresorerie.total_sorties_compte_courant).toBe("1200.00");
    expect(tb.tresorerie.compte_courant_estime).toBe("1200.00");
    expect(tb.tresorerie.reserve).toBe("4000.00");
    expect(tb.tresorerie.serie_12_mois).toHaveLength(12);
    expect(tb.recouvrement.exercice.appele).toBe("6000.00");
    expect(tb.recouvrement.exercice.encaisse).toBe("2400.00");
    expect(tb.recouvrement.exercice.taux).toBe("40");
    expect(tb.impayes.total).toBe("3600.00");
    expect(tb.impayes.nb_lots_en_retard).toBe(2);
    expect(tb.impayes.tranches.find((t) => t.tranche === "PLUS_180")?.montant).toBe("3600.00");
    expect(tb.impayes.top_lots[0]).toMatchObject({ lot_id: lotA3, reste_du: "2000.00" });
    expect(tb.depenses.exercice.total).toBe("3200.00"); // 700 + 500 + 2000 (réserve)
    expect(tb.budget_vs_realise.totaux.realise).toBe("3200.00");
    expect(tb.incidents_ouverts.total).toBe(1);
    expect(tb.incidents_ouverts.par_urgence.URGENTE).toBe(1);
    await expect(tableauDeBord(A(), EX)).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(tableauDeBord(ctx(gardien, "GARDIEN"), EX)).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("grand livre : ouverture (réserve 2024), lignes chronologiques, soldes courants, pas de double compte réserve", async () => {
    const gl = await obtenirGrandLivre(S(), EX);
    expect(gl.ouverture).toEqual({ compte_courant: "0.00", reserve: "5000.00" });
    expect(gl.nb_lignes).toBe(3 + 3 + 1); // 3 paiements, 3 dépenses payées, 1 cotisation (le décaissement lié à la dépense n'est pas doublé)
    expect(gl.totaux).toEqual({ entrees: "2400.00", sorties_compte_courant: "1200.00", sorties_reserve: "2000.00", mouvements_reserve: "1000.00" });
    expect(gl.cloture).toEqual({ compte_courant: "1200.00", reserve: "4000.00" });
    const derniere = gl.lignes[gl.lignes.length - 1]!;
    expect(derniere.solde_compte_courant).toBe("1200.00");
    expect(derniere.solde_reserve).toBe("4000.00");
    // Solde courant recalculé ligne à ligne = solde affiché.
    let solde = money(gl.ouverture.compte_courant);
    for (const l of gl.lignes) {
      if (l.compte === "COMPTE_COURANT") solde = solde.plus(money(l.entree ?? 0)).minus(money(l.sortie ?? 0));
      expect(l.solde_compte_courant).toBe(solde.toFixed(2));
    }
    await expect(obtenirGrandLivre(L(), EX)).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("impayés : liste triée / filtrée, synthèse, export csv journalisé", async () => {
    const { total, rows, synthese } = await listerImpayes(S(), {}, pagination, { champ: "reste_du", sens: "desc" });
    expect(total).toBe(4); // A2 janv (600 restant), A2 fév, A3 janv, A3 fév
    expect(rows[0]!.reste_du).toBe("1000.00");
    expect(synthese.total).toBe("3600.00");
    const filtre = await listerImpayes(S(), { lot_id: lotA2 }, pagination, { champ: "retard_jours", sens: "desc" });
    expect(filtre.total).toBe(2);
    const exp = await exporterImpayes(C(), {}, "csv");
    expect(exp.nbLignes).toBe(4);
    expect(await admin.exportLog.count({ where: { coproprieteId: copro, type: "IMPAYES", utilisateurId: conseil } })).toBe(1);
  });
});

describe("M18 — transparence", () => {
  const clesInterdites = ["lot_id", "lot_numero", "top_lots", "par_lot", "lots_en_retard_detail", "proprietaire", "utilisateur"];
  async function verifierAucuneDonneeParLot(role: TenantContext["role"], userId: string) {
    const vue = await vueTransparence(ctx(userId, role), EX);
    const json = JSON.stringify(vue);
    for (const cle of clesInterdites) expect(json.includes(`"${cle}"`)).toBe(false);
    // Ni identifiant ni numéro de lot nulle part.
    for (const id of [lotA1, lotA2, lotA3]) expect(json.includes(id)).toBe(false);
    expect(json.includes('"A2"')).toBe(false);
    expect(json.includes('"A3"')).toBe(false);
    expect(vue.impayes).toEqual({ total: "3600.00", nb_lots_en_retard: 2 });
    expect(vue.recouvrement.exercice).toBe("40");
    expect(vue.tresorerie.reserve).toBe("4000.00");
    expect(vue.budget_vs_realise.postes).toHaveLength(2);
    expect(vue.budget_vs_realise.postes[0]).toMatchObject({ libelle: "Électricité communs", montant_prevu: "3000.00", realise: "700.00" });
    // Résident : la RLS ne montre que les dépenses PAYEE — jamais le brouillon de 9999.
    expect(vue.depenses.map((x) => x.libelle)).not.toContain("Brouillon non payé");
    expect(vue.depenses_par_categorie.total).toBe("3200.00");
    return vue;
  }

  it("LOCATAIRE et PROPRIETAIRE : agrégats corrects, aucune donnée par lot, factures masquées par défaut", async () => {
    const vueLoc = await verifierAucuneDonneeParLot("LOCATAIRE", loc);
    expect(vueLoc.factures_visibles).toBe(false);
    expect(vueLoc.depenses.every((x) => x.factures === undefined)).toBe(true);
    await verifierAucuneDonneeParLot("PROPRIETAIRE", amina);
    await expect(vueTransparence(ctx(gardien, "GARDIEN"), EX)).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("factures visibles après activation par le syndic (fonction SECURITY DEFINER, URL signée) ; conseil ne peut pas activer", async () => {
    await expect(definirFacturesVisibles(C(), copro, true)).rejects.toBeInstanceOf(PermissionRefuseeError);
    await definirFacturesVisibles(S(), copro, true);
    const vue = await vueTransparence(L(), EX);
    expect(vue.factures_visibles).toBe(true);
    const lydec = vue.depenses.find((x) => x.libelle === "Facture électricité T1")!;
    expect(lydec.factures).toHaveLength(1);
    expect(lydec.factures![0]).toMatchObject({ numero: "LYD-2025-001", montant_ttc: "700.00" });
    expect(lydec.factures![0]!.url).toContain("/sign/documents/");
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "TRANSPARENCE_FACTURES_MODIFIEE" } })).toBe(1);
    await definirFacturesVisibles(S(), copro, false);
    const apres = await vueTransparence(L(), EX);
    expect(apres.depenses.every((x) => x.factures === undefined)).toBe(true);
  });
});

describe("M18 — rapport de gestion", () => {
  let rapportId: string;

  it("génération (syndic) : instantané réconcilié avec le grand livre, PDF FR publique en Document CONSEIL_SYNDICAL, statut GENERE ; conseil refusé", async () => {
    await expect(genererRapportGestion(C(), { exercice: EX })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const cle = randomUUID();
    const r = await genererRapportGestion(S(), { exercice: EX }, cle);
    rapportId = r.id;
    const donnees = r.donnees!;
    expect(r.statut).toBe("GENERE");
    expect(r.pdf_erreur).toBeNull();
    expect(r.document_id).toBeTruthy();
    expect(r.regenere).toBe(false);
    const gl = await obtenirGrandLivre(S(), EX);
    expect(donnees.tresorerie.ouverture).toEqual(gl.ouverture);
    expect(donnees.tresorerie.totaux).toEqual(gl.totaux);
    expect(donnees.tresorerie.cloture).toEqual(gl.cloture);
    expect(donnees.grand_livre_nb_lignes).toBe(gl.nb_lignes);
    // Σ des SORTIE du grand livre = total des dépenses de l'instantané ; Σ ENTREE = encaissé recouvrement.
    const sorties = gl.lignes.filter((l) => l.type === "SORTIE").reduce((a, l) => a.plus(money(l.sortie ?? 0)), money(0));
    expect(sorties.toFixed(2)).toBe(donnees.depenses_par_categorie.total);
    const entrees = gl.lignes.filter((l) => l.type === "ENTREE").reduce((a, l) => a.plus(money(l.entree ?? 0)), money(0));
    expect(entrees.toFixed(2)).toBe(donnees.recouvrement.encaisse);
    expect(donnees.impayes.par_lot).toHaveLength(2);
    expect(donnees.reserve.mouvements).toHaveLength(2);
    expect(donnees.faits_marquants.incidents_majeurs).toHaveLength(1);
    expect(donnees.president_conseil.nom).toContain("CONSEIL");
    expect(donnees.seuil_approbation_non_configure).toBe(true);
    const doc = await admin.document.findUniqueOrThrow({ where: { id: r.document_id! } });
    expect(doc.type).toBe("RAPPORT_GESTION"); expect(doc.visibilite).toBe("CONSEIL_SYNDICAL"); expect(doc.storagePath).toContain(`${copro}/rapports/`);
    // Rejeu même clé → même rapport ; nouvelle clé → régénération (200, même ligne).
    const rejeu = await genererRapportGestion(S(), { exercice: EX }, cle);
    expect(rejeu.id).toBe(rapportId);
    const regen = await genererRapportGestion(S(), { exercice: EX }, randomUUID());
    expect(regen.id).toBe(rapportId); expect(regen.regenere).toBe(true); expect(regen.statut).toBe("GENERE");
    expect(await admin.rapportGestion.count({ where: { coproprieteId: copro, exercice: EX } })).toBe(1);
    const liste = await listerRapportsGestion(C(), {}, pagination, { champ: "exercice", sens: "desc" });
    expect(liste.total).toBe(1);
    expect(liste.rows[0]!.resume.compte_courant_cloture).toBe("1200.00");
    const detail = await obtenirRapportGestion(C(), rapportId);
    expect(detail.document_url).toContain("/sign/documents/");
  });

  it("PDF FR et AR, variantes publique / complète, export journalisé ; résident refusé", async () => {
    const fr = await pdfRapportGestion(S(), rapportId, "fr", "complete");
    const ar = await pdfRapportGestion(C(), rapportId, "ar", "publique");
    expect(fr.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(ar.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(fr.buffer.length).toBeGreaterThan(2000);
    expect(ar.buffer.length).toBeGreaterThan(2000);
    expect(fr.nomFichier).toBe(`rapport-gestion-${EX}-fr-complet.pdf`);
    expect(await admin.exportLog.count({ where: { coproprieteId: copro, type: "RAPPORT_GESTION_PDF" } })).toBe(2);
    await expect(pdfRapportGestion(A(), rapportId, "fr", "publique")).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("soumission à l'AG : majorité non configurée → 422 ; résolution créée par le service AG ; document public ; notification ; finalisation → APPROUVE ; 409 ensuite", async () => {
    await expect(soumettreRapportAg(S(), rapportId, { ag_id: agId }, randomUUID())).rejects.toMatchObject({ code: "RAPPORT_PARAMETRE_NON_CONFIGURE" });
    await expect(soumettreRapportAg(C(), rapportId, { ag_id: agId, type_majorite: "SIMPLE" }, randomUUID())).rejects.toBeInstanceOf(PermissionRefuseeError);
    const soumis = await soumettreRapportAg(S(), rapportId, { ag_id: agId, type_majorite: "SIMPLE" }, randomUUID());
    expect(soumis.statut).toBe("SOUMIS_AG");
    expect(soumis.ag?.id).toBe(agId);
    expect(soumis.resolution).toMatchObject({ ordre: 1, type_majorite: "SIMPLE", resultat: "EN_ATTENTE" });
    expect(soumis.resolution!.texte).toContain(`exercice ${EX}`);
    expect((await admin.document.findUniqueOrThrow({ where: { id: soumis.document_id! } })).visibilite).toBe("PUBLIC_COPROPRIETE");
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "RAPPORT_GESTION_DISPONIBLE" } })).toBe(3); // amina, bob, conseil
    // Les résidents voient le rapport soumis via la transparence (document public).
    const vue = await vueTransparence(L(), EX);
    expect(vue.rapports_gestion.map((r) => r.document_id)).toContain(soumis.document_id);
    // Soumis → plus de régénération possible.
    await expect(genererRapportGestion(S(), { exercice: EX }, randomUUID())).rejects.toBeInstanceOf(ConflitError);
    await expect(soumettreRapportAg(S(), rapportId, { ag_id: agId, type_majorite: "SIMPLE" }, randomUUID())).rejects.toMatchObject({ code: "RAPPORT_STATUT_INVALIDE" });
    // Séance : AG EN_COURS, un vote POUR (A1), finalisation → ADOPTEE → rapport APPROUVE.
    await admin.assembleeGenerale.update({ where: { id: agId }, data: { statut: "EN_COURS", quorumRequis: "0.500" } });
    await admin.agVote.create({ data: { resolutionId: soumis.resolution!.id, lotId: lotA1, utilisateurId: amina, valeur: "POUR", tantiemesRepresentes: "100.00" } });
    const res = await finaliserResolution(S(), agId, soumis.resolution!.id);
    expect(res.resultat).toBe("ADOPTEE");
    expect((await admin.rapportGestion.findUniqueOrThrow({ where: { id: rapportId } })).statut).toBe("APPROUVE");
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "RAPPORT_GESTION_APPROUVE", entiteId: rapportId } })).toBe(1);
  });
});

describe("M18 — relevé de charges et exports journalisés", () => {
  it("relevé du lot : syndic tout lot ; propriétaire son lot uniquement ; locataire refusé ; PDF FR / AR ; export_log RELEVE_LOT", async () => {
    const rel = await obtenirReleveLot(S(), lotA2, EX);
    expect(rel.appels).toHaveLength(2);
    expect(rel.totaux).toEqual({ appele: "2000.00", paye: "400.00", solde_exercice: "1600.00", solde_total_du: "1600.00", en_attente: "0.00" });
    expect(rel.paiements).toHaveLength(1);
    const mien = await obtenirReleveLot(A(), lotA1, EX);
    expect(mien.totaux.solde_total_du).toBe("0.00");
    expect(mien.proprietaires[0]!.nom).toBe("AMINA");
    await expect(obtenirReleveLot(A(), lotA2, EX)).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(obtenirReleveLot(L(), lotA1, EX)).rejects.toBeInstanceOf(PermissionRefuseeError);
    const pdfFr = await pdfReleveLot(A(), lotA1, EX, "fr");
    const pdfAr = await pdfReleveLot(S(), lotA2, EX, "ar");
    expect(pdfFr.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfAr.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfAr.nomFichier).toBe(`releve-charges-A2-${EX}-ar.pdf`);
    // Le propriétaire est journalisé même s'il ne lit pas export_log (createMany sans RETURNING).
    expect(await admin.exportLog.count({ where: { coproprieteId: copro, type: "RELEVE_LOT", utilisateurId: amina } })).toBe(2);
  });

  it("exports lots / paiements / incidents / grand livre xlsx (syndic, conseil) ; propriétaires = syndic seul ; journal consultable", async () => {
    const lots = await exporterLots(C(), "csv");
    expect(lots.nbLignes).toBe(3);
    expect(lots.entetes).toContain("solde_du");
    expect(lots.lignes.find((l) => l[0] === "A3")![9]).toBe("2000.00");
    const paiements = await exporterPaiements(S(), EX, "xlsx");
    expect(paiements.nbLignes).toBe(3);
    const incidents = await exporterIncidents(S(), {}, "csv");
    expect(incidents.nbLignes).toBe(2);
    await expect(exporterProprietaires(C(), "csv")).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(exporterLots(A(), "csv")).rejects.toBeInstanceOf(PermissionRefuseeError);
    const proprios = await exporterProprietaires(S(), "csv");
    expect(proprios.nbLignes).toBe(3);
    expect(proprios.lignes[0]).toContain("amina-rapports@test.local");
    const gl = await exporterGrandLivre(S(), EX, "xlsx");
    const xlsx = await bufferXlsx("grand-livre", gl.entetes, gl.lignes);
    expect(xlsx.subarray(0, 2).toString()).toBe("PK"); // zip OOXML
    const journal = await listerExportsJournal(S(), pagination);
    const types = journal.rows.map((r) => r.type);
    for (const t of ["LOTS", "PAIEMENTS", "INCIDENTS", "PROPRIETAIRES", "GRAND_LIVRE", "RELEVE_LOT", "RAPPORT_GESTION_PDF", "IMPAYES"]) expect(types).toContain(t);
    expect(journal.rows.find((r) => r.type === "PAIEMENTS")!.filtres).toMatchObject({ format: "xlsx", exercice: EX });
    await expect(listerExportsJournal(A(), pagination)).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});
