/**
 * Tests M19 — Contrats, assurances, échéances (Doc A §7, §8) : calcul pur des échéances pour chaque
 * périodicité (fins de mois, horizon, préavis → RENOUVELLEMENT), activation (seuil AG → 422 sans
 * résolution), génération idempotente, dépense BROUILLON liée depuis une échéance (idempotente),
 * suspension / résiliation (échéances annulées), job quotidien (J-30 / J-7 une seule fois, MANQUEE,
 * EXPIRE, reconduction tacite avec échéancier prolongé), assurance absente → alerte mensuelle
 * dédoublonnée, tableau de bord M18 alimenté, export journalisé, RLS (conseil lit, ne gère pas ;
 * propriétaire ne voit rien).
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
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { ajouterMois, calculerEcheances, dateUtc, dureeEnMois, isoDate } from "../lib/contrats/echeancier";
import { activerContrat, ajouterEcheance, contratsARenouveler, creerContrat, echeancier, etatAssurance, exporterContrats, genererDepenseDepuisEcheance, genererEcheances, listerContrats, listerEcheances, modifierContrat, modifierEcheance, obtenirContrat, resilierContrat, suspendreContrat, ContratError, PermissionRefuseeError } from "../lib/contrats/contrats";
import { executerAlerteAssurance, executerJobContrats } from "../lib/contrats/jobs";
import { tableauDeBord } from "../lib/rapports/tableau-de-bord";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, conseil: string, amina: string, prestataire: string, posteId: string, resolutionAdoptee: string;
const ctx = (u: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId: u, coproprieteId: copro, role });
const S = () => ctx(syndic, "SYNDIC");
const C = () => ctx(conseil, "CONSEIL_SYNDICAL");
const A = () => ctx(amina, "PROPRIETAIRE");
const pagination = { page: 1, limit: 50, skip: 0, take: 50 };
const tri = { champ: "date_fin" as const, sens: "asc" as const };
const NOW = new Date("2026-09-06T10:00:00.000Z");
const plusJours = (n: number) => isoDate(new Date(NOW.getTime() + n * 86_400_000));

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence Contrats", adresse: "1 rue C", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2, seuilContratAg: "20000.00" } });
  copro = c.id;
  const users = await Promise.all(["syndic", "conseil", "amina"].map((n) => admin.utilisateur.create({ data: { email: `${n}-contrats@test.local`, statutCompte: "ACTIF" } })));
  [syndic, conseil, amina] = users.map((u) => u.id) as [string, string, string];
  await admin.roleUtilisateur.createMany({ data: [{ utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: conseil, coproprieteId: copro, role: "CONSEIL_SYNDICAL" }, { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" }] });
  const p = await admin.prestataire.create({ data: { coproprieteId: copro, nom: "Ascenseurs Atlas", specialite: "Ascenseur", contact: "+212600000077" } });
  prestataire = p.id;
  const budget = await admin.budgetAg.create({ data: { coproprieteId: copro, exercice: "2026", montantTotal: "0.00", statut: "ACTIF" } });
  const poste = await admin.budgetPoste.create({ data: { budgetAgId: budget.id, categorie: "ENTRETIEN_COURANT", libelle: "Maintenance ascenseur", montantPrevu: "12000.00", ordre: 1 } });
  posteId = poste.id;
  const ag = await admin.assembleeGenerale.create({ data: { coproprieteId: copro, type: "ORDINAIRE", dateAg: new Date("2026-03-15T10:00:00Z"), statut: "CLOTUREE", resolutions: { create: [{ ordre: 1, texte: "Contrat de gardiennage 24/7", typeMajorite: "SIMPLE", resultat: "ADOPTEE" }] } }, include: { resolutions: true } });
  resolutionAdoptee = ag.resolutions[0]!.id;
});

afterAll(async () => {
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.contratLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.contratEcheance.deleteMany({ where: { contrat: { coproprieteId: copro } } });
  await admin.depenseLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.depense.deleteMany({ where: { coproprieteId: copro } });
  await admin.contrat.deleteMany({ where: { coproprieteId: copro } });
  await admin.document.deleteMany({ where: { coproprieteId: copro } });
  await admin.budgetPoste.deleteMany({ where: { budgetAg: { coproprieteId: copro } } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: copro } });
  await admin.agResolution.deleteMany({ where: { ag: { coproprieteId: copro } } });
  await admin.assembleeGenerale.deleteMany({ where: { coproprieteId: copro } });
  await admin.prestataire.deleteMany({ where: { coproprieteId: copro } });
  await admin.exportLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-contrats@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect(); await disconnectTenantDb();
});

describe("M19 — calcul des échéances (pur)", () => {
  it("mensuelle : fins de mois bornées, ancre conservée (31/01 → 28/02 → 31/03)", () => {
    const e = calculerEcheances({ dateDebut: dateUtc("2026-01-31"), dateFin: null, periodicite: "MENSUELLE", montantPeriode: "1000.00", preavisJours: null, aPartirDe: dateUtc("2026-01-01"), horizon: dateUtc("2026-04-30") });
    expect(e.map((x) => isoDate(x.date))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(e.every((x) => x.type === "PAIEMENT" && x.montant === "1000.00")).toBe(true);
    expect(isoDate(ajouterMois(dateUtc("2024-01-31"), 1))).toBe("2024-02-29"); // bissextile
  });
  it("trimestrielle / semestrielle / annuelle / ponctuelle, bornées par date_fin et horizon", () => {
    const base = { dateDebut: dateUtc("2026-01-15"), montantPeriode: "300.00", preavisJours: null, aPartirDe: dateUtc("2026-01-01"), horizon: dateUtc("2027-12-31") };
    expect(calculerEcheances({ ...base, dateFin: dateUtc("2026-12-31"), periodicite: "TRIMESTRIELLE" }).map((x) => isoDate(x.date))).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
    expect(calculerEcheances({ ...base, dateFin: null, periodicite: "SEMESTRIELLE" }).map((x) => isoDate(x.date))).toEqual(["2026-01-15", "2026-07-15", "2027-01-15", "2027-07-15"]);
    expect(calculerEcheances({ ...base, dateFin: null, periodicite: "ANNUELLE" }).map((x) => isoDate(x.date))).toEqual(["2026-01-15", "2027-01-15"]);
    expect(calculerEcheances({ ...base, dateFin: null, periodicite: "PONCTUELLE" }).map((x) => isoDate(x.date))).toEqual(["2026-01-15"]);
    // Fenêtre qui commence après le début : seules les occurrences futures.
    expect(calculerEcheances({ ...base, dateFin: null, periodicite: "MENSUELLE", aPartirDe: dateUtc("2026-06-20"), horizon: dateUtc("2026-08-31") }).map((x) => isoDate(x.date))).toEqual(["2026-07-15", "2026-08-15"]);
  });
  it("préavis → une échéance RENOUVELLEMENT à date_fin − préavis ; durée en mois d'une période", () => {
    const e = calculerEcheances({ dateDebut: dateUtc("2026-01-01"), dateFin: dateUtc("2026-12-31"), periodicite: "ANNUELLE", montantPeriode: "5000.00", preavisJours: 60, aPartirDe: dateUtc("2026-01-01"), horizon: dateUtc("2027-06-30") });
    expect(e.map((x) => `${x.type}:${isoDate(x.date)}`)).toEqual(["PAIEMENT:2026-01-01", "RENOUVELLEMENT:2026-11-01"]);
    expect(dureeEnMois(dateUtc("2026-01-01"), dateUtc("2026-12-31"))).toBe(12);
    expect(dureeEnMois(dateUtc("2026-03-01"), dateUtc("2026-05-31"))).toBe(3);
  });
});

describe("M19 — cycle de vie, échéancier, dépenses", () => {
  let ascenseur: string, gardiennage: string;

  it("création BROUILLON avec documents ; conseil et propriétaire refusés ; activation → échéancier 12 mois idempotent", async () => {
    await expect(creerContrat(C(), { type: "NETTOYAGE", libelle: "x", date_debut: "2026-01-01", periodicite: "MENSUELLE" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(creerContrat(A(), { type: "NETTOYAGE", libelle: "x", date_debut: "2026-01-01", periodicite: "MENSUELLE" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const c = await creerContrat(S(), {
      type: "ASCENSEUR", libelle: "Maintenance ascenseur", reference: "ASC-2026-01", prestataire_id: prestataire, date_debut: "2026-01-31", date_fin: "2026-12-31", tacite: true, preavis_jours: 60,
      periodicite: "MENSUELLE", montant_periode: "1500.00", budget_poste_id: posteId, notes: "Visite mensuelle + astreinte.",
      document: { storage_path: `${copro}/contrats/${randomUUID()}-contrat.pdf`, nom: "Contrat ascenseur.pdf" },
    });
    ascenseur = c.id;
    (globalThis as Record<string, unknown>).__ascenseur = c.id;
    expect(c.statut).toBe("BROUILLON");
    expect(c.document?.type).toBe("CONTRAT");
    expect(c.montantPeriode).toBe("1500.00");
    expect(c.est_assurance).toBe(false);
    // Chemin hors périmètre refusé.
    await expect(creerContrat(S(), { type: "AUTRE", libelle: "y", date_debut: "2026-01-01", periodicite: "PONCTUELLE", document: { storage_path: `${randomUUID()}/contrats/x.pdf`, nom: "x.pdf" } })).rejects.toThrow();
    const active = await activerContrat(S(), ascenseur, randomUUID());
    expect(active.statut).toBe("ACTIF");
    const ech = await listerEcheances(C(), ascenseur);
    const paiements = ech.filter((e) => e.type === "PAIEMENT");
    // Depuis aujourd'hui (fenêtre 12 mois) jusqu'à date_fin : sept (30/09 → 31/12, fins de mois bornées) ; + RENOUVELLEMENT 01/11.
    expect(paiements.length).toBeGreaterThanOrEqual(3);
    expect(paiements.every((e) => e.montant === "1500.00")).toBe(true);
    expect(paiements.some((e) => e.dateEcheance.toISOString().slice(0, 10) === "2026-09-30")).toBe(true);
    expect(ech.some((e) => e.type === "RENOUVELLEMENT" && e.dateEcheance.toISOString().slice(0, 10) === "2026-11-01")).toBe(true);
    // Régénération : rien de nouveau.
    const regen = await genererEcheances(S(), ascenseur);
    expect(regen.creees).toBe(0);
    expect(await admin.contratEcheance.count({ where: { contratId: ascenseur } })).toBe(ech.length);
    expect(await admin.contratLog.count({ where: { contratId: ascenseur, type: "ECHEANCES_GENEREES" } })).toBe(2);
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "CONTRAT_ACTIVE", entiteId: ascenseur } })).toBe(1);
  });

  it("seuil AG : montant > seuil sans résolution → 422 ; avec résolution ADOPTEE → ACTIF", async () => {
    const g = await creerContrat(S(), { type: "GARDIENNAGE", libelle: "Gardiennage 24/7", date_debut: "2026-01-01", date_fin: "2027-12-31", periodicite: "MENSUELLE", montant_periode: "25000.00" });
    gardiennage = g.id;
    await expect(activerContrat(S(), gardiennage, randomUUID())).rejects.toMatchObject({ code: "CONTRAT_RESOLUTION_AG_REQUISE" });
    await modifierContrat(S(), gardiennage, { resolution_ag_id: resolutionAdoptee });
    const a = await activerContrat(S(), gardiennage, randomUUID());
    expect(a.statut).toBe("ACTIF");
    expect(a.resolutionAg?.resultat).toBe("ADOPTEE");
  });

  it("échéance → dépense BROUILLON liée (poste, prestataire, contrat) ; idempotente ; statut DEPENSE_GENEREE ; échéance manuelle et modification", async () => {
    const ech = await listerEcheances(S(), ascenseur);
    const e = ech.find((x) => x.type === "PAIEMENT")!;
    const cle = randomUUID();
    const r = await genererDepenseDepuisEcheance(S(), ascenseur, e.id, { source: "COMPTE_COURANT" }, cle);
    expect(r.echeance.statut).toBe("DEPENSE_GENEREE");
    expect(r.depense.statut).toBe("BROUILLON");
    expect(r.depense.montantTtc).toBe("1500.00");
    expect(r.depense.categorie).toBe("ENTRETIEN_COURANT");
    const dep = await admin.depense.findUniqueOrThrow({ where: { id: r.depense.id } });
    expect(dep.contratId).toBe(ascenseur); expect(dep.prestataireId).toBe(prestataire); expect(dep.budgetPosteId).toBe(posteId);
    const rejeu = await genererDepenseDepuisEcheance(S(), ascenseur, e.id, { source: "COMPTE_COURANT" }, cle);
    expect(rejeu.depense.id).toBe(r.depense.id);
    expect(await admin.depense.count({ where: { contratId: ascenseur } })).toBe(1);
    await expect(genererDepenseDepuisEcheance(S(), ascenseur, e.id, { source: "COMPTE_COURANT" }, randomUUID())).rejects.toMatchObject({ code: "CONTRAT_ECHEANCE_STATUT_INVALIDE" });
    await expect(genererDepenseDepuisEcheance(C(), ascenseur, e.id, { source: "COMPTE_COURANT" }, randomUUID())).rejects.toBeInstanceOf(PermissionRefuseeError);
    // Échéance manuelle (contrôle réglementaire) puis REALISEE.
    const manuelle = await ajouterEcheance(S(), ascenseur, { type: "CONTROLE_REGLEMENTAIRE", date_echeance: plusJours(45) });
    expect(manuelle.statut).toBe("A_VENIR");
    const faite = await modifierEcheance(S(), ascenseur, manuelle.id, { statut: "REALISEE" });
    expect(faite.statut).toBe("REALISEE");
    // Détail : documents signés (le contrat signé est SYNDIC_ONLY — RLS document : le conseil ne le voit pas), échéances, dépenses, journal.
    const detail = await obtenirContrat(S(), ascenseur);
    expect(detail.documents[0]!.url).toContain("/sign/documents/");
    expect((await obtenirContrat(C(), ascenseur)).documents).toHaveLength(0);
    expect(detail.depenses).toHaveLength(1);
    expect(detail.logs.map((l) => l.type)).toEqual(expect.arrayContaining(["CREE", "ACTIVE", "ECHEANCES_GENEREES", "DEPENSE_GENEREE", "ECHEANCE_MODIFIEE"]));
    // Échéancier transverse + à renouveler.
    const cal = await echeancier(C(), plusJours(0), plusJours(120));
    expect(cal.echeances.length).toBeGreaterThan(0);
    expect(cal.echeances.every((x) => x.contrat.id === ascenseur || x.contrat.id === gardiennage)).toBe(true);
    const aRenouveler = await contratsARenouveler(S(), 200, NOW);
    expect(aRenouveler.map((x) => x.id)).toContain(ascenseur);
    expect(aRenouveler.map((x) => x.id)).not.toContain(gardiennage);
  });

  it("suspendre / réactiver / résilier (échéances futures annulées) ; modification d'un RESILIE refusée ; liste + export journalisé ; RLS propriétaire", async () => {
    const s = await suspendreContrat(S(), gardiennage, { motif: "Litige facturation" }, randomUUID());
    expect(s.statut).toBe("SUSPENDU");
    const re = await activerContrat(S(), gardiennage, randomUUID());
    expect(re.statut).toBe("ACTIF");
    const avant = await admin.contratEcheance.count({ where: { contratId: gardiennage, statut: "A_VENIR" } });
    expect(avant).toBeGreaterThan(0);
    const r = await resilierContrat(S(), gardiennage, { motif: "Changement de prestataire", date_resiliation: plusJours(10) }, randomUUID());
    expect(r.statut).toBe("RESILIE");
    expect(await admin.contratEcheance.count({ where: { contratId: gardiennage, statut: "ANNULEE" } })).toBeGreaterThan(0);
    await expect(modifierContrat(S(), gardiennage, { libelle: "x" })).rejects.toMatchObject({ code: "CONTRAT_STATUT_INVALIDE" });
    await expect(suspendreContrat(C(), ascenseur, {}, randomUUID())).rejects.toBeInstanceOf(PermissionRefuseeError);
    const liste = await listerContrats(C(), {}, pagination, tri);
    expect(liste.total).toBe(2);
    expect(liste.par_statut.ACTIF).toBe(1);
    expect(liste.par_statut.RESILIE).toBe(1);
    expect(liste.assurance.immeuble_active).toBe(false);
    const filtre = await listerContrats(S(), { type: "ASCENSEUR", q: "ascenseur" }, pagination, tri);
    expect(filtre.total).toBe(1);
    const exp = await exporterContrats(C(), {}, "xlsx");
    expect(exp.nbLignes).toBe(2);
    expect(await admin.exportLog.count({ where: { coproprieteId: copro, type: "CONTRATS", utilisateurId: conseil } })).toBe(1);
    await expect(listerContrats(A(), {}, pagination, tri)).rejects.toBeInstanceOf(PermissionRefuseeError);
    // RLS : même avec un client tenant, un propriétaire ne voit aucune ligne.
    const vus = await withTenant(A(), (db) => db.contrat.findMany({ where: { coproprieteId: copro } }));
    expect(vus).toHaveLength(0);
  });
});

describe("M19 — jobs : rappels, échéances manquées, expiration, reconduction, assurance", () => {
  it("J-30 / J-7 une seule fois ; PAIEMENT dépassé → MANQUEE ; non tacite → EXPIRE ; tacite → prolongé + échéancier", async () => {
    // Nettoyage : contrat annuel non tacite déjà fini, contrat internet tacite fini, échéances forcées.
    const finiNonTacite = await creerContrat(S(), { type: "NETTOYAGE", libelle: "Nettoyage (ancien)", date_debut: "2025-09-01", date_fin: "2026-08-31", periodicite: "MENSUELLE", montant_periode: "2000.00" });
    await activerContrat(S(), finiNonTacite.id, randomUUID());
    const tacite = await creerContrat(S(), { type: "INTERNET", libelle: "Fibre local syndic", date_debut: "2025-09-01", date_fin: "2026-08-31", tacite: true, preavis_jours: 30, periodicite: "MENSUELLE", montant_periode: "300.00" });
    await activerContrat(S(), tacite.id, randomUUID());
    // Sur l'ascenseur : une échéance PAIEMENT passée (forcée) et une à J-5.
    await admin.contratEcheance.create({ data: { contratId: ascenseurId(), type: "PAIEMENT", dateEcheance: dateUtc(plusJours(-3)), montant: "1500.00" } });
    await admin.contratEcheance.create({ data: { contratId: ascenseurId(), type: "VISITE_TECHNIQUE", dateEcheance: dateUtc(plusJours(5)) } });

    const r1 = await withTenant(S(), (db) => executerJobContrats(db, copro, NOW));
    expect(r1.manquees).toBe(1);
    expect(r1.expires).toBe(1);
    expect(r1.reconduits).toBe(1);
    expect(r1.rappels).toBeGreaterThanOrEqual(1);
    expect((await admin.contrat.findUniqueOrThrow({ where: { id: finiNonTacite.id } })).statut).toBe("EXPIRE");
    const prolonge = await admin.contrat.findUniqueOrThrow({ where: { id: tacite.id } });
    expect(prolonge.statut).toBe("ACTIF");
    expect(prolonge.dateFin!.toISOString().slice(0, 10)).toBe("2027-08-31");
    expect(await admin.contratEcheance.count({ where: { contratId: tacite.id, statut: "A_VENIR", dateEcheance: { gt: dateUtc("2026-09-30") } } })).toBeGreaterThan(0);
    expect(await admin.contratEcheance.count({ where: { contratId: ascenseurId(), statut: "MANQUEE" } })).toBe(1);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "CONTRAT_EXPIRE" } })).toBe(1);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "CONTRAT_RECONDUIT" } })).toBe(1);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "CONTRAT_ECHEANCE_MANQUEE" } })).toBe(1);
    const proches = await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "CONTRAT_ECHEANCE_PROCHE" } });
    expect(proches).toBeGreaterThanOrEqual(1);
    // Rejeu : idempotent.
    const r2 = await withTenant(S(), (db) => executerJobContrats(db, copro, NOW));
    expect(r2).toEqual({ rappels: 0, manquees: 0, expires: 0, reconduits: 0 });
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "CONTRAT_ECHEANCE_PROCHE" } })).toBe(proches);
    expect(await admin.contratLog.count({ where: { contratId: tacite.id, type: "RECONDUIT" } })).toBe(1);
  });

  it("assurance immeuble absente → alerte syndic + conseil, dédoublonnée 28 jours ; police active → plus d'alerte ; tableau de bord M18", async () => {
    const a1 = await withTenant(S(), (db) => executerAlerteAssurance(db, copro, NOW));
    expect(a1.alerte).toBe(true);
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "ASSURANCE_IMMEUBLE_ABSENTE" } })).toBe(2);
    const a2 = await withTenant(S(), (db) => executerAlerteAssurance(db, copro, new Date(NOW.getTime() + 10 * 86_400_000)));
    expect(a2.alerte).toBe(false);
    const police = await creerContrat(S(), {
      type: "ASSURANCE_IMMEUBLE", libelle: "Multirisque immeuble", date_debut: "2026-01-01", date_fin: "2026-12-31", tacite: true, preavis_jours: 60, periodicite: "ANNUELLE", montant_periode: "18000.00",
      details_assurance: { assureur: "Wafa Assurance", numero_police: "MRI-778812", garanties: ["Incendie", "Dégât des eaux", "RC"], franchise: "1500.00", capital_assure: "12000000.00" },
      attestation: { storage_path: `${copro}/contrats/${randomUUID()}-attestation.pdf`, nom: "Attestation 2026.pdf" },
    });
    expect(police.est_assurance).toBe(true);
    expect(police.attestationDocument?.type).toBe("ATTESTATION_ASSURANCE");
    await activerContrat(S(), police.id, randomUUID());
    const etat = await etatAssurance(C());
    expect(etat.immeuble_active).toBe(true);
    expect(etat.polices.find((p) => p.id === police.id)).toMatchObject({ attestation: true, assureur: "Wafa Assurance", echue: false });
    const a3 = await withTenant(S(), (db) => executerAlerteAssurance(db, copro, new Date(NOW.getTime() + 40 * 86_400_000)));
    expect(a3.alerte).toBe(false);
    expect((await admin.copropriete.findUniqueOrThrow({ where: { id: copro } })).assuranceAlerteEnvoyeeLe).toBeNull();
    // Détails d'assurance refusés hors ASSURANCE_* (Zod) — côté service : effacés.
    await expect(creerContrat(S(), { type: "NETTOYAGE", libelle: "x", date_debut: "2026-01-01", periodicite: "MENSUELLE", details_assurance: { assureur: "a", numero_police: "b", garanties: [] } } as never)).resolves.toMatchObject({ detailsAssuranceJson: null });
    const tb = await tableauDeBord(S(), "2026", NOW);
    expect(tb.contrats).toMatchObject({ assurance_immeuble_active: true });
    expect(tb.contrats!.actifs).toBeGreaterThanOrEqual(2);
    expect(tb.contrats!.echeances_manquees).toBe(1);
  });
});

function ascenseurId(): string {
  return (globalThis as Record<string, unknown>).__ascenseur as string;
}
