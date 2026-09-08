/**
 * M24 — Import Excel & onboarding : détection des colonnes (FR / AR / tableur « sale »), mapping
 * corrigé, exécution idempotente (rejeu = rien deux fois), propriétaires sur plusieurs lots (une
 * invitation, tous les lots), membre connu rattaché sans invitation, avertissement tantièmes,
 * soldes d'ouverture (ligne d'appel la plus ancienne : solde, FIFO, escalade ; avoir déduit),
 * invitations jamais envoyées seules (envoi en masse → csv + envoyee_le), acceptation avec identité
 * pré-remplie (indivision rééquilibrée), RLS (un import ne crée rien dans une autre copropriété,
 * même avec un id forgé), checklist d'onboarding, résidence de démonstration et purge.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const FICHIERS = new Map<string, Buffer>();
vi.mock("../lib/storage/supabase-storage", () => ({
  ensureBucketDocuments: async () => undefined,
  creerUrlSignee: async (chemin: string) => `http://127.0.0.1:54321/storage/v1/object/sign/documents/${chemin}`,
  creerUrlUploadSignee: async (chemin: string) => ({ url: `http://127.0.0.1:54321/storage/v1/object/upload/sign/documents/${chemin}`, token: "test" }),
  supprimerObjet: async () => undefined,
  televerserDocument: async () => undefined,
  telechargerObjet: async (chemin: string) => { const b = FICHIERS.get(chemin); if (!b) throw new Error(`fichier absent ${chemin}`); return b; },
}));
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { creerImport, lancerImport, modifierMapping, annulerImport, rapportImport, obtenirImport, ImportError } from "../lib/import/import";
import { detecterMapping, normaliserDecimal, normaliserTelephone, normaliserDate, lireTableur } from "../lib/import/parse";
import { envoyerInvitationsEnMasse } from "../lib/import/invitations-masse";
import { checklistOnboarding } from "../lib/import/onboarding";
import { creerDemo, purgerDemosExpirees } from "../lib/import/demo";
import { obtenirSoldeLot, appliquerPaiementFifo } from "../lib/finances/finances";
import { executerEscaladeImpayes } from "../lib/finances/escalade";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, coproB: string, syndic: string, conseil: string, amina: string, superAdmin: string;
const ctx = (u: string, role: TenantContext["role"], c = copro): TenantContext => ({ utilisateurId: u, coproprieteId: c, role });
const S = () => ctx(syndic, "SYNDIC");
const C = () => ctx(conseil, "CONSEIL_SYNDICAL");
const SA = () => ctx(superAdmin, "SUPER_ADMIN");

async function xlsx(entetes: string[], lignes: (string | number | null)[][], rtl = false): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Feuil1", rtl ? { views: [{ rightToLeft: true }] } : undefined);
  ws.addRow(["Résidence Test — export comptable"]); // ligne de titre (ignorée : 1 seule cellule)
  ws.addRow([]);
  ws.addRow(entetes);
  for (const l of lignes) ws.addRow(l);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function chemin(nom: string, c = copro) { return `${c}/import/${nom}`; }
async function importer(type: Parameters<typeof creerImport>[1]["type"], nom: string, buffer: Buffer, options?: Parameters<typeof creerImport>[1]["options"], c?: TenantContext) {
  FICHIERS.set(chemin(nom, c?.coproprieteId), buffer);
  return creerImport(c ?? S(), { type, storage_path: chemin(nom, c?.coproprieteId), nom_fichier: nom, options });
}

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.copropriete.create({ data: { nom: "Résidence Import", adresse: "1 rue Import", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 4, totalTantiemes: "1000.00" } }),
    admin.copropriete.create({ data: { nom: "Résidence Import B", adresse: "2 rue Import", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2 } }),
  ]);
  copro = a.id; coproB = b.id;
  const users = await Promise.all(["syndic", "conseil", "amina", "sa"].map((n) => admin.utilisateur.create({ data: { email: `${n}-import@test.local`, telephone: n === "amina" ? "+212611000001" : null, nom: n.toUpperCase(), prenom: "I", statutCompte: "ACTIF" } })));
  [syndic, conseil, amina, superAdmin] = users.map((u) => u.id) as [string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: conseil, coproprieteId: copro, role: "CONSEIL_SYNDICAL" },
    { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" }, { utilisateurId: superAdmin, coproprieteId: copro, role: "SUPER_ADMIN" },
  ] });
});
afterAll(async () => {
  for (const c of [copro, coproB]) {
    const lotIds = (await admin.lot.findMany({ where: { coproprieteId: c }, select: { id: true } })).map((l) => l.id);
    await admin.notification.deleteMany({ where: { coproprieteId: c } });
    await admin.exportLog.deleteMany({ where: { coproprieteId: c } });
    await admin.importJobLog.deleteMany({ where: { coproprieteId: c } });
    await admin.invitation.deleteMany({ where: { coproprieteId: c } });
    await admin.soldeOuverture.deleteMany({ where: { coproprieteId: c } });
    await admin.importJob.deleteMany({ where: { coproprieteId: c } });
    await admin.document.deleteMany({ where: { coproprieteId: c } });
    await admin.contratLog.deleteMany({ where: { coproprieteId: c } });
    await admin.contrat.deleteMany({ where: { coproprieteId: c } });
    await admin.badge.deleteMany({ where: { coproprieteId: c } });
    await admin.vehicule.deleteMany({ where: { coproprieteId: c } });
    await admin.prestataire.deleteMany({ where: { coproprieteId: c } });
    await admin.personnel.deleteMany({ where: { coproprieteId: c } });
    await admin.quittance.deleteMany({ where: { appelDeFondsLot: { lotId: { in: lotIds } } } });
    await admin.paiement.deleteMany({ where: { lotId: { in: lotIds } } });
    await admin.appelDeFondsLot.deleteMany({ where: { lotId: { in: lotIds } } });
    await admin.appelDeFonds.deleteMany({ where: { coproprieteId: c } });
    await admin.lotOccupant.deleteMany({ where: { lotId: { in: lotIds } } });
    await admin.lotProprietaire.deleteMany({ where: { lotId: { in: lotIds } } });
    await admin.lot.deleteMany({ where: { coproprieteId: c } });
    await admin.auditLog.deleteMany({ where: { coproprieteId: c } });
    await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: c } });
  }
  await admin.utilisateur.deleteMany({ where: { OR: [{ email: { endsWith: "-import@test.local" } }, { telephone: { in: ["+212611000010", "+212611000011", "+212611000012"] } }] } });
  await admin.copropriete.deleteMany({ where: { id: { in: [copro, coproB] } } });
  await admin.$disconnect(); await disconnectTenantDb();
});

describe("M24 — parsing et détection", () => {
  it("normalise téléphones (espaces, 06 → +212), décimaux (« 1 250,50 », « 25/1000 »), dates (jj/mm/aaaa, série Excel)", () => {
    expect(normaliserTelephone("06 12 34 56 78")).toBe("+212612345678");
    expect(normaliserTelephone("+212 6-12-34-56-78")).toBe("+212612345678");
    expect(normaliserTelephone("00212612345678")).toBe("+212612345678");
    expect(normaliserTelephone("12")).toBeNull();
    expect(normaliserDecimal("1 250,50")).toBe("1250.50");
    expect(normaliserDecimal("25/1000")).toBe("25.00");
    expect(normaliserDecimal("-300")).toBe("-300.00");
    expect(normaliserDecimal("(300)")).toBe("-300.00");
    expect(normaliserDecimal("abc")).toBeNull();
    expect(normaliserDate("15/01/2026")).toBe("2026-01-15");
    expect(normaliserDate("46037")).toBe("2026-01-15");
    expect(normaliserDate("2026-01-15T00:00:00.000Z")).toBe("2026-01-15");
  });
  it("détecte les colonnes FR, AR et EN par synonymes, sans doublon de champ", async () => {
    const fr = detecterMapping("LOTS_PROPRIETAIRES", ["N° lot", "Étage", "Tantièmes", "Nom du propriétaire", "Prénom", "GSM", "E-mail", "Quote-part %"]);
    expect(fr.map((m) => m.champ)).toEqual(["numero", "etage", "tantiemes", "nom", "prenom", "telephone", "email", "quote_part"]);
    const ar = detecterMapping("LOTS_PROPRIETAIRES", ["رقم الشقة", "الأجزاء", "المالك", "الهاتف"]);
    expect(ar.map((m) => m.champ)).toEqual(["numero", "tantiemes", "nom", "telephone"]);
    const en = detecterMapping("SOLDES_OUVERTURE", ["Unit", "Amount due", "As of"]);
    expect(en.map((m) => m.champ)).toEqual(["numero", "montant", "date_reference"]);
    // Tableur « sale » : lignes vides, titre, cellule fusionnée (n° de lot vide hérité), csv « ; ».
    const csv = Buffer.from("﻿Titre du fichier\n\nLot;Millièmes;Propriétaire;Tel\nA1;250;Bennani Amina;06 11 00 00 10\n;;Bennani Karim;06 11 00 00 11\n\nA2;25/1000;Idrissi;0611000012\n", "utf8");
    const t = await lireTableur(csv, "lots.csv");
    expect(t.entetes).toEqual(["Lot", "Millièmes", "Propriétaire", "Tel"]);
    expect(t.lignes.map((l) => l.valeurs[0])).toEqual(["A1", "A1", "A2"]);
  });
});

describe("M24 — lots & propriétaires", () => {
  let jobId: string;
  it("analyse : mapping auto, aperçu, avertissements (doublon de lot, somme des tantièmes ≠ règlement, même personne sur deux lots)", async () => {
    const b = await xlsx(["N° lot", "Étage", "Bâtiment", "Tantièmes", "Nom du propriétaire", "Prénom", "Téléphone", "Quote-part %"], [
      ["A1", 1, "A", 300, "Bennani", "Amina", "06 11 00 00 01", 100],
      ["A2", 2, "A", "250", "Idrissi", "Omar", "0611000010", 100],
      ["A3", 3, "B", "250", "Idrissi", "Omar", "06-11-00-00-10", 100],
      ["P1", null, "A", "100", "Alaoui", "Sara", "0611000011", "50"],
      ["P1", null, "A", "100", "Alaoui", "Karim", "0611000012", "50"],
    ]);
    const j = await importer("LOTS_PROPRIETAIRES", "lots-fr.xlsx", b);
    jobId = j.id;
    expect(j.statut).toBe("PRET");
    expect(j.nbLignes).toBe(5);
    const apercu = j.apercu as { colonnes: { champ: string | null }[]; avertissements: string[]; lignes: { erreurs: string[] }[] };
    expect(apercu.colonnes.map((c) => c.champ)).toEqual(["numero", "etage", "batiment", "tantiemes", "nom", "prenom", "telephone", "quote_part"]);
    expect(apercu.avertissements.join(" ")).toMatch(/double.*P1/);
    expect(apercu.avertissements.join(" ")).not.toMatch(/diffère/); // somme 1000 = total du règlement
    expect(apercu.lignes.every((l) => l.erreurs.length === 0)).toBe(true);
  });
  it("exécution : lots créés, membre connu (Amina) rattaché sans invitation, une invitation par personne (Omar → 2 lots), indivision P1 50/50 ; rejeu = rien deux fois", async () => {
    const r = await lancerImport(S(), jobId, { enLigne: true });
    expect(r.statut).toBe("TERMINE");
    const resultat = r.resultat as { crees: number; mis_a_jour: number; erreurs: unknown[] };
    expect(resultat.crees).toBe(4); // A1, A2, A3, P1 (2e ligne P1 = mise à jour / invitation)
    expect(resultat.erreurs).toHaveLength(0);
    const lots = await admin.lot.findMany({ where: { coproprieteId: copro }, orderBy: { numero: "asc" } });
    expect(lots.map((l) => `${l.numero}:${l.typeLot}:${l.tantiemes}`)).toEqual(["A1:APPARTEMENT:300", "A2:APPARTEMENT:250", "A3:APPARTEMENT:250", "P1:PARKING:100"]);
    // Amina (téléphone connu, membre) : rattachée directement, aucune invitation.
    const a1 = lots.find((l) => l.numero === "A1")!;
    expect(await admin.lotProprietaire.count({ where: { lotId: a1.id, utilisateurId: amina, dateFin: null } })).toBe(1);
    const invitations = await admin.invitation.findMany({ where: { coproprieteId: copro, importJobId: jobId }, orderBy: { creeLe: "asc" } });
    expect(invitations).toHaveLength(3); // Omar (A2 + A3), Sara, Karim
    const omar = invitations.find((i) => ((i.preRempliJson ?? {}) as { nom?: string }).nom === "Idrissi")!;
    expect(((omar.preRempliJson ?? {}) as { lots: unknown[] }).lots).toHaveLength(2);
    expect(omar.roleCible).toBe("PROPRIETAIRE");
    expect(omar.envoyeeLe).toBeNull();
    expect(invitations.filter((i) => i.roleCible === "INDIVISAIRE")).toHaveLength(2);
    // Rejeu du même fichier : tout est déjà appliqué (empreintes), rien de créé.
    const j2 = await importer("LOTS_PROPRIETAIRES", "lots-fr-bis.xlsx", FICHIERS.get(chemin("lots-fr.xlsx"))!);
    const r2 = await lancerImport(S(), j2.id, { enLigne: true });
    expect((r2.resultat as { deja_appliquees: number; crees: number }).deja_appliquees).toBe(5);
    expect((r2.resultat as { crees: number }).crees).toBe(0);
    expect(await admin.invitation.count({ where: { coproprieteId: copro } })).toBe(3);
    expect(await admin.lot.count({ where: { coproprieteId: copro } })).toBe(4);
    const rapport = await rapportImport(S(), jobId);
    expect(rapport.lignes).toHaveLength(5);
    expect(rapport.lignes.filter((l) => l[1] === "CREE")).toHaveLength(4);
  });
  it("mapping non reconnu → ANALYSE ; correction PATCH → PRET ; conseil lit mais n'importe pas ; annulation", async () => {
    const b = await xlsx(["Code", "Parts", "Personne"], [["B1", 100, "Tazi Nour"]]);
    const j = await importer("LOTS_PROPRIETAIRES", "lots-inconnu.xlsx", b);
    expect(j.statut).toBe("ANALYSE");
    await expect(lancerImport(S(), j.id, { enLigne: true })).rejects.toBeInstanceOf(ImportError);
    const corrige = await modifierMapping(S(), j.id, { colonnes: [{ index: 0, champ: "numero" }, { index: 1, champ: "tantiemes" }, { index: 2, champ: "nom" }], options: { inviter: false } });
    expect(corrige.statut).toBe("PRET");
    expect(await obtenirImport(C(), j.id)).toMatchObject({ id: j.id, statut: "PRET" });
    await expect(creerImport(C(), { type: "LOTS_PROPRIETAIRES", storage_path: chemin("lots-inconnu.xlsx"), nom_fichier: "x.xlsx" })).rejects.toThrow(/syndic/);
    const annule = await annulerImport(S(), j.id);
    expect(annule.statut).toBe("ANNULE");
    await expect(lancerImport(S(), j.id, { enLigne: true })).rejects.toMatchObject({ code: "IMPORT_STATUT_INVALIDE" });
  });
  it("acceptation d'une invitation pré-remplie : identité, lot rattaché ; indivision rééquilibrée (100 → 50/50) ; accepte_par_id posé", async () => {
    const invs = await admin.invitation.findMany({ where: { coproprieteId: copro, roleCible: "INDIVISAIRE" }, orderBy: { creeLe: "asc" } });
    const p1 = await admin.lot.findFirst({ where: { coproprieteId: copro, numero: "P1" } });
    const u1 = "10000000-0000-4000-8000-000000000001", u2 = "10000000-0000-4000-8000-000000000002";
    const r1 = await admin.$queryRaw<{ resultat: { statut: string } }[]>`SELECT public.invitation_accepter(${invs[0]!.code}, ${u1}::uuid, ${"sara-import@test.local"}, ${"+212611000011"}, true, NULL) AS resultat`;
    expect(r1[0]!.resultat.statut).toBe("OK");
    let parts = await admin.lotProprietaire.findMany({ where: { lotId: p1!.id, dateFin: null } });
    expect(parts.map((p) => p.quotePart.toString())).toEqual(["100"]);
    const u1row = await admin.utilisateur.findUnique({ where: { id: u1 } });
    expect(u1row?.nom).toBe("Alaoui");
    const r2 = await admin.$queryRaw<{ resultat: { statut: string } }[]>`SELECT public.invitation_accepter(${invs[1]!.code}, ${u2}::uuid, ${"karim-import@test.local"}, ${null}, true, NULL) AS resultat`;
    expect(r2[0]!.resultat.statut).toBe("OK");
    parts = await admin.lotProprietaire.findMany({ where: { lotId: p1!.id, dateFin: null } });
    expect(parts.map((p) => p.quotePart.toString()).sort()).toEqual(["50", "50"]);
    expect((await admin.invitation.findUnique({ where: { id: invs[0]!.id } }))?.accepteParId).toBe(u1);
    await admin.lotProprietaire.deleteMany({ where: { utilisateurId: { in: [u1, u2] } } });
    await admin.roleUtilisateur.deleteMany({ where: { utilisateurId: { in: [u1, u2] } } });
    await admin.utilisateur.deleteMany({ where: { id: { in: [u1, u2] } } });
  });
  it("envoi en masse : jamais automatique ; csv « nom, téléphone, lien » + envoyee_le ; audité", async () => {
    expect(await admin.invitation.count({ where: { coproprieteId: copro, envoyeeLe: { not: null } } })).toBe(0);
    const r = await envoyerInvitationsEnMasse(S(), { canal: "CSV" });
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.lignes[0]![7]).toMatch(/\/fr\/invitation\//);
    expect(r.lignes[0]![8]).toMatch(/wa\.me/);
    expect(await admin.invitation.count({ where: { coproprieteId: copro, statut: "EN_ATTENTE", envoyeeLe: null, preRempliJson: { not: { equals: null } } } })).toBe(0);
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "INVITATIONS_ENVOI_MASSE" } })).toBe(1);
    await expect(envoyerInvitationsEnMasse(C(), { canal: "CSV" })).rejects.toThrow(/syndic/);
  });
});

describe("M24 — soldes d'ouverture", () => {
  it("dû → ligne d'appel SOLDE_OUVERTURE (première du relevé), avoir déduit du solde ; FIFO paie l'ouverture d'abord ; escalade", async () => {
    const b = await xlsx(["Appartement", "Reste à payer", "Arrêté au", "Observation"], [["A1", "1 250,50", "15/01/2026", "Arriérés 2025"], ["A2", "-300", "15/01/2026", "Trop-perçu"], ["ZZ", "10", "", ""]]);
    const j = await importer("SOLDES_OUVERTURE", "soldes.xlsx", b);
    expect(j.statut).toBe("PRET");
    const r = await lancerImport(S(), j.id, { enLigne: true });
    const res = r.resultat as { crees: number; erreurs: { n: number; message: string }[] };
    expect(res.crees).toBe(2);
    expect(res.erreurs).toHaveLength(1);
    expect(res.erreurs[0]!.message).toMatch(/ZZ/);
    const a1 = (await admin.lot.findFirst({ where: { coproprieteId: copro, numero: "A1" } }))!;
    const a2 = (await admin.lot.findFirst({ where: { coproprieteId: copro, numero: "A2" } }))!;
    const solde = await obtenirSoldeLot(S(), a1.id);
    expect(solde.solde_du).toBe("1250.50");
    expect(solde.solde_ouverture?.montant).toBe("1250.50");
    expect(solde.lignes).toHaveLength(1);
    const appel = await admin.appelDeFonds.findFirst({ where: { coproprieteId: copro, type: "SOLDE_OUVERTURE" }, include: { lignes: true } });
    expect(appel?.periode).toBe("2026-01");
    expect(appel?.montantTotal.toString()).toBe("1250.5");
    const solde2 = await obtenirSoldeLot(S(), a2.id);
    expect(solde2.avoir_ouverture).toBe("300.00");
    expect(solde2.solde_du).toBe("0.00");
    // Un appel courant plus récent + paiement FIFO : l'ouverture (la plus ancienne) est réglée d'abord.
    const courant = await admin.appelDeFonds.create({ data: { coproprieteId: copro, periode: "2026-09", type: "CHARGES_COURANTES", montantTotal: "500.00", dateEcheance: new Date("2026-09-30"), statut: "EMIS", lignes: { create: [{ lotId: a1.id, montantDu: "500.00" }] } } });
    const fifo = await withTenant(S(), (db) => appliquerPaiementFifo(db, S(), { lotId: a1.id, montant: "1300.00", methode: "VIREMENT", payeurUtilisateurId: null }));
    expect(fifo.affectations[0]).toMatchObject({ appel_de_fonds_lot_id: appel!.lignes[0]!.id, montant: "1250.50", statut: "PAYE" });
    expect(fifo.affectations[1]).toMatchObject({ montant: "49.50", statut: "PARTIEL" });
    void courant;
    // Escalade : une ouverture non réglée (dû ancien) est escaladée comme toute ligne en souffrance.
    const b2 = await xlsx(["Lot", "Solde", "Date"], [["A3", "800", "01/03/2026"]]);
    const j2 = await importer("SOLDES_OUVERTURE", "soldes-a3.xlsx", b2);
    await lancerImport(S(), j2.id, { enLigne: true });
    const esc = await executerEscaladeImpayes(copro);
    const a3 = (await admin.lot.findFirst({ where: { coproprieteId: copro, numero: "A3" } }))!;
    const ligneA3 = await admin.appelDeFondsLot.findFirst({ where: { lotId: a3.id, appelDeFonds: { type: "SOLDE_OUVERTURE" } } });
    expect(esc.escalades.some((e) => e.appelDeFondsLotId === ligneA3!.id)).toBe(true);
    expect(ligneA3?.niveauEscalade).not.toBe("N0");
  });
});

describe("M24 — autres types, RLS, onboarding, démo", () => {
  it("prestataires, contrats (prestataire créé à la volée, doublon ignoré), véhicules / badges, personnel (invitation GARDIEN pré-remplie)", async () => {
    const p = await lancerImport(S(), (await importer("PRESTATAIRES", "presta.xlsx", await xlsx(["Société", "Métier", "Tel", "ICE"], [["Otis Maroc", "Ascenseur", "0522000000", "001234567000089"], ["Otis Maroc", "Ascenseur", "0522000000", ""]]))).id, { enLigne: true });
    expect((p.resultat as { crees: number; ignorees: number }).crees).toBe(1);
    const c = await lancerImport(S(), (await importer("CONTRATS", "contrats.xlsx", await xlsx(["Objet", "Type", "Fournisseur", "Début", "Fin", "Fréquence", "Montant"], [["Maintenance ascenseur", "ascenseur", "Otis Maroc", "01/01/2026", "31/12/2026", "mensuel", "1 500,00"], ["Assurance multirisque", "assurance", "AXA", "2026-01-01", "", "annuelle", "18000"], ["Maintenance ascenseur", "ascenseur", "Otis Maroc", "01/01/2026", "", "", ""]]))).id, { enLigne: true });
    expect((c.resultat as { crees: number; ignorees: number }).crees).toBe(2);
    expect(await admin.contrat.count({ where: { coproprieteId: copro, type: "ASSURANCE_IMMEUBLE", statut: "ACTIF" } })).toBe(1);
    expect(await admin.prestataire.count({ where: { coproprieteId: copro } })).toBe(2);
    const v = await lancerImport(S(), (await importer("VEHICULES_BADGES", "veh.xlsx", await xlsx(["Lot", "Plaque", "Marque", "Badge", "Type badge", "Caution"], [["A1", "12345 a 6", "Dacia", "TC-1", "télécommande", "300"], ["A2", "", "", "BP-9", "badge", ""], ["A1", "12345-A-6", "", "", "", ""]]))).id, { enLigne: true });
    expect((v.resultat as { crees: number; ignorees: number }).crees).toBe(2);
    expect((await admin.vehicule.findFirst({ where: { coproprieteId: copro } }))?.immatriculation).toBe("12345-A-6");
    expect(await admin.badge.count({ where: { coproprieteId: copro } })).toBe(2);
    const g = await lancerImport(S(), (await importer("PERSONNEL", "perso.xlsx", await xlsx(["Nom", "Prénom", "GSM", "Poste", "Embauche", "Salaire"], [["Ouazzani", "Rachid", "06 11 00 00 20", "gardien", "15/01/2024", "3500"]]))).id, { enLigne: true });
    expect((g.resultat as { crees: number }).crees).toBe(1);
    const inv = await admin.invitation.findFirst({ where: { coproprieteId: copro, roleCible: "GARDIEN" } });
    expect((inv?.preRempliJson as { poste?: string; salaire_brut_mensuel?: string })?.poste).toBe("GARDIEN");
    expect((inv?.preRempliJson as { salaire_brut_mensuel?: string })?.salaire_brut_mensuel).toBe("3500.00");
  });
  it("RLS : l'import de la copropriété A ne crée rien dans B, même avec un id forgé ; B n'a aucun lot", async () => {
    await expect(withTenant(S(), (db) => db.lot.create({ data: { coproprieteId: coproB, numero: "X1", typeLot: "APPARTEMENT", tantiemes: "10.00" } }))).rejects.toThrow();
    const j = await importer("LOTS_PROPRIETAIRES", "lots-b.xlsx", await xlsx(["Lot", "Tantièmes"], [["X1", 10]]), { inviter: false });
    await lancerImport(S(), j.id, { enLigne: true });
    expect(await admin.lot.count({ where: { coproprieteId: coproB } })).toBe(0);
    expect(await admin.lot.count({ where: { coproprieteId: copro, numero: "X1" } })).toBe(1);
    await expect(obtenirImport(ctx(syndic, "SYNDIC", coproB), j.id)).rejects.toThrow(/introuvable/i);
  });
  it("checklist d'onboarding calculée (lots, tantièmes, invitations, assurance…) ; premier appel ignore SOLDE_OUVERTURE ; conseil lit, résident non", async () => {
    const c = await checklistOnboarding(S());
    const e = Object.fromEntries(c.etapes.map((x) => [x.cle, x.fait]));
    expect(e.residence_creee).toBe(true);
    expect(e.lots_importes).toBe(true);
    expect(e.proprietaires_invites).toBe(true);
    expect(e.assurance_saisie).toBe(true);
    expect(e.premier_appel).toBe(true); // appel CHARGES_COURANTES créé dans le test FIFO
    expect(e.rib_saisi).toBe(false);
    expect(e.gardien_cree).toBe(false);
    expect(c.complet).toBe(false);
    expect((await checklistOnboarding(C())).total).toBe(10);
    await expect(checklistOnboarding(ctx(amina, "PROPRIETAIRE"))).rejects.toThrow();
  });
  it("démo : SUPER_ADMIN crée une résidence est_demo avec invitation SYNDIC ; syndic refusé ; purge une fois expirée", async () => {
    await expect(creerDemo(S(), {})).rejects.toThrow();
    const d = await creerDemo(SA(), { nom: "Démo test import", jours: 1 });
    expect(d.est_demo).toBe(true);
    expect(d.invitation_syndic.code).toHaveLength(8);
    expect(await admin.lot.count({ where: { coproprieteId: d.id } })).toBe(5);
    const avant = await purgerDemosExpirees(new Date(), admin);
    expect(avant.purgees).toBe(0);
    const apres = await purgerDemosExpirees(new Date(Date.now() + 2 * 86_400_000), admin);
    expect(apres.purgees).toBe(1);
    expect(apres.erreurs).toEqual([]);
    expect(await admin.copropriete.findUnique({ where: { id: d.id } })).toBeNull();
  });
});
