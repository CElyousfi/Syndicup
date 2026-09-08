/**
 * M25 — Cabinet / portefeuille : l'accès à une copropriété passe UNIQUEMENT par role_utilisateur posé par
 * cabinet_appliquer_acces ; assignation → rôles créés / révoqués atomiquement (membre retiré, mandat
 * terminé, changement de gestionnaire) ; le SYNDIC en place confirme la passation (son rôle est cédé) ;
 * un membre du cabinet A ne lit pas une copropriété du cabinet B (portefeuille ni tenant) ; le gestionnaire
 * ne voit que ses copropriétés ; les KPI de la vue correspondent aux requêtes directes sur les données ;
 * comptable = SYNDIC_COMPTABLE lecture seule (RLS additive) ; agenda / alertes ; prestataire copié.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { creerCabinet, ajouterMembre, modifierMembre, proposerMandat, confirmerMandat, modifierMandat, terminerMandat, portefeuille, agenda, alertes, listerCabinets, listerMembres, creerPrestataireModele, copierPrestataire, mandatDeLaCopropriete, obtenirCabinet, CabinetError, PermissionRefuseeError, IntrouvableError } from "../lib/cabinet/cabinet";
import { rafraichirPortefeuilleKpi } from "../lib/cabinet/jobs";
import { obtenirSoldeLot, listerAppelsDeFonds } from "../lib/finances/finances";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let coproA: string, coproB: string, coproC: string, superAdmin: string, cabAdmin: string, gestionnaire: string, comptable: string, syndicA: string, syndicB: string, etranger: string, lotA: string;
const acteur = (u: string, superAdminFlag = false) => ({ utilisateurId: u, superAdmin: superAdminFlag });
const ctx = (u: string, role: TenantContext["role"], c: string): TenantContext => ({ utilisateurId: u, coproprieteId: c, role });
const roleActif = (u: string, c: string, role: string) => admin.roleUtilisateur.findFirst({ where: { utilisateurId: u, coproprieteId: c, role: role as never, actif: true } });

beforeAll(async () => {
  const [a, b, c] = await Promise.all([
    admin.copropriete.create({ data: { nom: "Résidence Cabinet A", adresse: "1 rue A", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 3 } }),
    admin.copropriete.create({ data: { nom: "Résidence Cabinet B", adresse: "2 rue B", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2 } }),
    admin.copropriete.create({ data: { nom: "Résidence Cabinet C", adresse: "3 rue C", ville: "Fès", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2 } }),
  ]);
  coproA = a.id; coproB = b.id; coproC = c.id;
  const users = await Promise.all(["sa", "cabadmin", "gest", "compta", "syndica", "syndicb", "etranger"].map((n) => admin.utilisateur.create({ data: { email: `${n}-cabinet@test.local`, telephone: n === "compta" ? "+212611000090" : null, nom: n.toUpperCase(), prenom: "C", statutCompte: "ACTIF" } })));
  [superAdmin, cabAdmin, gestionnaire, comptable, syndicA, syndicB, etranger] = users.map((u) => u.id) as [string, string, string, string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: superAdmin, coproprieteId: coproA, role: "SUPER_ADMIN" },
    { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
    { utilisateurId: syndicB, coproprieteId: coproB, role: "SYNDIC" },
    { utilisateurId: etranger, coproprieteId: coproC, role: "SYNDIC" },
  ] });
  const lot = await admin.lot.create({ data: { coproprieteId: coproA, numero: "A1", typeLot: "APPARTEMENT", tantiemes: "500.00" } });
  lotA = lot.id;
  await admin.lot.create({ data: { coproprieteId: coproA, numero: "A2", typeLot: "APPARTEMENT", tantiemes: "500.00" } });
  const appel = await admin.appelDeFonds.create({ data: { coproprieteId: coproA, periode: "2026-01", type: "CHARGES_COURANTES", montantTotal: "1000.00", dateEcheance: new Date("2026-01-31"), statut: "EMIS", lignes: { create: [{ lotId: lotA, montantDu: "600.00", montantPaye: "600.00", statut: "PAYE" }, { lotId: (await admin.lot.findFirst({ where: { coproprieteId: coproA, numero: "A2" } }))!.id, montantDu: "400.00", statut: "IMPAYE" }] } } });
  void appel;
  await admin.incident.create({ data: { coproprieteId: coproA, categorie: "PLOMBERIE", sousCategorie: "Fuite", partie: "COMMUNE", urgence: "URGENTE", statut: "OUVERT", creePar: syndicA } });
  await admin.tache.create({ data: { coproprieteId: coproA, titre: "Tâche en retard", origine: "MANUELLE", priorite: "HAUTE", statut: "A_FAIRE", dateEcheance: new Date("2026-01-01"), creeParId: syndicA } });
  await admin.assembleeGenerale.create({ data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: new Date(Date.now() + 10 * 86_400_000), statut: "PLANIFIEE" } });
});
afterAll(async () => {
  const copros = [coproA, coproB, coproC];
  for (const c of copros) {
    const lotIds = (await admin.lot.findMany({ where: { coproprieteId: c }, select: { id: true } })).map((l) => l.id);
    await admin.notification.deleteMany({ where: { coproprieteId: c } });
    await admin.exportLog.deleteMany({ where: { coproprieteId: c } });
    await admin.tacheLog.deleteMany({ where: { coproprieteId: c } });
    await admin.tache.deleteMany({ where: { coproprieteId: c } });
    await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: c } } });
    await admin.incident.deleteMany({ where: { coproprieteId: c } });
    await admin.assembleeGenerale.deleteMany({ where: { coproprieteId: c } });
    await admin.contratEcheance.deleteMany({ where: { contrat: { coproprieteId: c } } });
    await admin.cabinetCopropriete.updateMany({ where: { coproprieteId: c }, data: { contratId: null } });
    await admin.contratLog.deleteMany({ where: { coproprieteId: c } });
    await admin.contrat.deleteMany({ where: { coproprieteId: c } });
    await admin.prestataire.deleteMany({ where: { coproprieteId: c } });
    await admin.appelDeFondsLot.deleteMany({ where: { lotId: { in: lotIds } } });
    await admin.appelDeFonds.deleteMany({ where: { coproprieteId: c } });
    await admin.lot.deleteMany({ where: { coproprieteId: c } });
    await admin.auditLog.deleteMany({ where: { coproprieteId: c } });
    await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: c } });
  }
  const cabs = (await admin.cabinet.findMany({ where: { nom: { startsWith: "Cabinet Test" } }, select: { id: true } })).map((x) => x.id);
  await admin.cabinetLog.deleteMany({ where: { cabinetId: { in: cabs } } });
  await admin.cabinetCopropriete.deleteMany({ where: { cabinetId: { in: cabs } } });
  await admin.cabinetPrestataire.deleteMany({ where: { cabinetId: { in: cabs } } });
  await admin.cabinetMembre.deleteMany({ where: { cabinetId: { in: cabs } } });
  await admin.copropriete.updateMany({ where: { id: { in: copros } }, data: { cabinetId: null } });
  await admin.copropriete.deleteMany({ where: { OR: [{ id: { in: copros } }, { nom: "Résidence Cabinet D" }] } });
  await admin.cabinet.deleteMany({ where: { id: { in: cabs } } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-cabinet@test.local" } } });
  await admin.$disconnect(); await disconnectTenantDb();
});

let cabinetId: string, cabinetB: string, mandatA: string;
describe("M25 — cabinet, membres, accès", () => {
  it("SUPER_ADMIN crée le cabinet (admin désigné) ; un syndic ne peut pas ; l'admin ajoute gestionnaire et comptable (par téléphone) ; un étranger ne voit rien", async () => {
    await expect(creerCabinet(acteur(syndicA), { nom: "Cabinet Test X" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const c = await creerCabinet(acteur(superAdmin, true), { nom: "Cabinet Test Atlas", parametres: { seuil_recouvrement: 70, delai_justificatifs_jours: 7 }, admin_utilisateur_id: cabAdmin });
    cabinetId = c.id;
    cabinetB = (await creerCabinet(acteur(superAdmin, true), { nom: "Cabinet Test Autre", admin_utilisateur_id: etranger })).id;
    expect((await listerCabinets(acteur(cabAdmin))).map((x) => x.id)).toEqual([cabinetId]);
    expect(await listerCabinets(acteur(gestionnaire))).toEqual([]);
    await ajouterMembre(acteur(cabAdmin), cabinetId, { utilisateur_id: gestionnaire, role: "CABINET_GESTIONNAIRE" });
    await ajouterMembre(acteur(cabAdmin), cabinetId, { telephone: "06 11 00 00 90", role: "CABINET_COMPTABLE" });
    await expect(ajouterMembre(acteur(gestionnaire), cabinetId, { utilisateur_id: syndicA, role: "CABINET_GESTIONNAIRE" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(ajouterMembre(acteur(cabAdmin), cabinetId, { telephone: "0699999999", role: "CABINET_GESTIONNAIRE" })).rejects.toBeInstanceOf(IntrouvableError);
    expect((await listerMembres(acteur(cabAdmin), cabinetId)).map((m) => m.role).sort()).toEqual(["CABINET_ADMIN", "CABINET_COMPTABLE", "CABINET_GESTIONNAIRE"]);
    await expect(obtenirCabinet(acteur(etranger), cabinetId)).rejects.toBeInstanceOf(IntrouvableError);
    // Aucun rôle de copropriété tant qu'aucun mandat n'est actif.
    expect(await roleActif(gestionnaire, coproA, "SYNDIC")).toBeNull();
  });
  it("mandat proposé sur A (EN_ATTENTE, syndic notifié) → le SYNDIC en place confirme : son rôle est cédé, gestionnaire = SYNDIC, comptable = SYNDIC_COMPTABLE, contrat d'honoraires créé ; doublon → 409", async () => {
    const m = await proposerMandat(acteur(cabAdmin), cabinetId, { copropriete_id: coproA, gestionnaire_principal_id: gestionnaire, date_debut_mandat: "2026-09-01", honoraires_mensuels: "2500.00" });
    mandatA = m.id;
    expect(m.statut).toBe("EN_ATTENTE");
    expect(await admin.notification.count({ where: { coproprieteId: coproA, utilisateurId: syndicA, templateCode: "MANDAT_PROPOSE" } })).toBe(1);
    expect(await roleActif(gestionnaire, coproA, "SYNDIC")).toBeNull();
    await expect(proposerMandat(acteur(cabAdmin), cabinetId, { copropriete_id: coproA, date_debut_mandat: "2026-09-01" })).rejects.toMatchObject({ code: "MANDAT_EXISTANT" });
    // Le conseil ne confirme pas ; un syndic d'une autre copropriété non plus (contexte tenant).
    await expect(confirmerMandat(ctx(syndicA, "CONSEIL_SYNDICAL", coproA), cabinetId)).rejects.toBeInstanceOf(PermissionRefuseeError);
    const vue = await mandatDeLaCopropriete(ctx(syndicA, "SYNDIC", coproA));
    expect(vue?.statut).toBe("EN_ATTENTE");
    expect(vue?.peutConfirmer).toBe(true);
    expect(vue?.cabinet.nom).toBe("Cabinet Test Atlas");
    const r = await confirmerMandat(ctx(syndicA, "SYNDIC", coproA), cabinetId);
    expect(r).toMatchObject({ statut: "ACTIF", syndics_cedes: 1 });
    expect(await roleActif(syndicA, coproA, "SYNDIC")).toBeNull();
    expect(await roleActif(gestionnaire, coproA, "SYNDIC")).not.toBeNull();
    expect((await roleActif(gestionnaire, coproA, "SYNDIC"))?.cabinetId).toBe(cabinetId);
    expect(await roleActif(comptable, coproA, "SYNDIC_COMPTABLE")).not.toBeNull();
    expect((await admin.copropriete.findUnique({ where: { id: coproA } }))?.cabinetId).toBe(cabinetId);
    const mandat = await admin.cabinetCopropriete.findUnique({ where: { id: mandatA }, include: { contrat: true } });
    expect(mandat?.contrat?.type).toBe("SYNDIC_PROFESSIONNEL");
    expect(mandat?.contrat?.montantPeriode?.toString()).toBe("2500");
    expect(await admin.contratEcheance.count({ where: { contratId: mandat!.contratId!, type: "PAIEMENT" } })).toBeGreaterThan(0);
    expect(await admin.notification.count({ where: { coproprieteId: coproA, utilisateurId: gestionnaire, templateCode: "MANDAT_CONFIRME" } })).toBe(1);
  });
  it("comptable : lecture seule des finances de A (solde, appels) sous SYNDIC_COMPTABLE ; aucun accès à C", async () => {
    const solde = await obtenirSoldeLot(ctx(comptable, "SYNDIC_COMPTABLE", coproA), lotA);
    expect(solde.lignes).toHaveLength(1);
    const appels = await listerAppelsDeFonds(ctx(comptable, "SYNDIC_COMPTABLE", coproA), 1, 10);
    expect(appels.total ?? appels.rows?.length ?? 1).toBeTruthy();
    // Écriture refusée : rôle non listé pour la génération d'appels (matrice) et RLS.
    await expect(withTenant(ctx(comptable, "SYNDIC_COMPTABLE", coproA), (db) => db.depense.create({ data: { coproprieteId: coproA, libelle: "x", categorie: "AUTRE", montantHt: "1.00", tva: "0.00", montantTtc: "1.00", statut: "BROUILLON", creeParId: comptable, dateDepense: new Date() } }))).rejects.toThrow();
    expect(await withTenant(ctx(comptable, "SYNDIC_COMPTABLE", coproC), (db) => db.lot.count({ where: { coproprieteId: coproC } }))).toBe(0);
  });
  it("portefeuille : KPI de la vue = requêtes directes ; admin voit A, gestionnaire voit A (sa copro), cabinet B ne voit rien de A ; alertes et agenda ; csv", async () => {
    await rafraichirPortefeuilleKpi(admin);
    const p = await portefeuille(acteur(cabAdmin), cabinetId, {}, { champ: "nom", sens: "asc" });
    expect(p.lignes.map((l) => l.nom)).toEqual(["Résidence Cabinet A"]);
    const l = p.lignes[0]!;
    expect(l.nb_lots).toBe(2);
    expect(l.appele).toBe("1000.00");
    expect(l.encaisse).toBe("600.00");
    expect(l.taux_recouvrement).toBe(60);
    expect(l.impayes_montant).toBe("400.00");
    expect(l.impayes_nb_lots).toBe(1);
    expect(l.incidents_ouverts).toBe(1);
    expect(l.incidents_urgents).toBe(1);
    expect(l.taches_retard).toBe(1);
    expect(l.prochaine_ag).not.toBeNull();
    expect(l.assurance_active).toBe(false);
    expect(l.alertes).toEqual(expect.arrayContaining(["ASSURANCE_ABSENTE", "RECOUVREMENT_FAIBLE", "TACHES_EN_RETARD", "INCIDENTS_URGENTS"]));
    expect(p.totaux.honoraires_mensuels).toBe("2500.00");
    expect((await portefeuille(acteur(gestionnaire), cabinetId, {}, { champ: "nom", sens: "asc" })).lignes).toHaveLength(1);
    expect((await portefeuille(acteur(comptable), cabinetId, {}, { champ: "nom", sens: "asc" })).lignes).toHaveLength(1);
    await expect(portefeuille(acteur(etranger), cabinetId, {}, { champ: "nom", sens: "asc" })).rejects.toBeInstanceOf(IntrouvableError);
    expect((await portefeuille(acteur(etranger), cabinetB, {}, { champ: "nom", sens: "asc" })).lignes).toEqual([]);
    const al = await alertes(acteur(cabAdmin), cabinetId);
    expect(al.items.map((i) => i.code)).toEqual(expect.arrayContaining(["ASSURANCE_ABSENTE", "RECOUVREMENT_FAIBLE", "TACHES_EN_RETARD", "INCIDENTS_URGENTS"]));
    const ag = await agenda(acteur(gestionnaire), cabinetId, 60);
    expect(ag.evenements.some((e) => e.type === "AG")).toBe(true);
    expect(ag.evenements.some((e) => e.type === "TACHE" && e.retard)).toBe(true);
    expect(ag.evenements.some((e) => e.type === "ECHEANCE_CONTRAT")).toBe(true);
  });
  it("gestionnaire ne voit pas une copropriété d'un mandat dont il n'est pas principal ; changement de gestionnaire principal bascule le rôle SYNDIC ; copropriété créée par le cabinet = mandat ACTIF direct", async () => {
    const mB = await proposerMandat(acteur(cabAdmin), cabinetId, { copropriete_id: coproB, gestionnaire_principal_id: cabAdmin, date_debut_mandat: "2026-09-01" });
    await confirmerMandat(ctx(syndicB, "SYNDIC", coproB), cabinetId);
    await rafraichirPortefeuilleKpi(admin);
    expect((await portefeuille(acteur(gestionnaire), cabinetId, {}, { champ: "nom", sens: "asc" })).lignes.map((l) => l.nom)).toEqual(["Résidence Cabinet A"]);
    expect((await portefeuille(acteur(cabAdmin), cabinetId, {}, { champ: "nom", sens: "asc" })).lignes).toHaveLength(2);
    expect(await roleActif(cabAdmin, coproB, "SYNDIC")).not.toBeNull();
    await modifierMandat(acteur(cabAdmin), cabinetId, mB.id, { gestionnaire_principal_id: gestionnaire });
    expect(await roleActif(cabAdmin, coproB, "SYNDIC")).toBeNull();
    expect(await roleActif(gestionnaire, coproB, "SYNDIC")).not.toBeNull();
    const mD = await proposerMandat(acteur(cabAdmin), cabinetId, { nouvelle_copropriete: { nom: "Résidence Cabinet D", adresse: "4 rue D", ville: "Tanger", nb_lots: 6 }, gestionnaire_principal_id: gestionnaire, date_debut_mandat: "2026-09-01" });
    expect(mD.statut).toBe("ACTIF");
    expect(await roleActif(gestionnaire, mD.copropriete.id, "SYNDIC")).not.toBeNull();
    await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: mD.copropriete.id } });
    await admin.cabinetCopropriete.deleteMany({ where: { id: mD.id } });
    await admin.auditLog.deleteMany({ where: { coproprieteId: mD.copropriete.id } });
    await admin.copropriete.delete({ where: { id: mD.copropriete.id } });
  });
  it("retirer le comptable révoque SYNDIC_COMPTABLE partout ; terminer le mandat A révoque le SYNDIC du gestionnaire (même transaction) et détache la copropriété ; dernier admin protégé", async () => {
    const membres = await listerMembres(acteur(cabAdmin), cabinetId);
    const compta = membres.find((m) => m.role === "CABINET_COMPTABLE")!;
    await modifierMembre(acteur(cabAdmin), cabinetId, compta.id, { actif: false });
    expect(await roleActif(comptable, coproA, "SYNDIC_COMPTABLE")).toBeNull();
    expect(await roleActif(comptable, coproB, "SYNDIC_COMPTABLE")).toBeNull();
    await expect(modifierMembre(acteur(cabAdmin), cabinetId, membres.find((m) => m.role === "CABINET_ADMIN")!.id, { actif: false })).rejects.toMatchObject({ code: "CABINET_STATUT_INVALIDE" });
    const fin = await terminerMandat(acteur(cabAdmin), cabinetId, mandatA, { date_fin: "2026-09-08", motif: "Test" });
    expect(fin.statut).toBe("TERMINE");
    expect(await roleActif(gestionnaire, coproA, "SYNDIC")).toBeNull();
    expect(await roleActif(gestionnaire, coproB, "SYNDIC")).not.toBeNull(); // mandat B toujours actif
    expect((await admin.copropriete.findUnique({ where: { id: coproA } }))?.cabinetId).toBeNull();
    expect(await admin.auditLog.count({ where: { coproprieteId: coproA, action: "MANDAT_TERMINE" } })).toBe(1);
    await expect(terminerMandat(acteur(cabAdmin), cabinetId, mandatA, {})).rejects.toMatchObject({ code: "MANDAT_STATUT_INVALIDE" });
    expect(await admin.cabinetLog.count({ where: { cabinetId, type: "ACCES_APPLIQUE" } })).toBeGreaterThanOrEqual(4);
  });
  it("annuaire du cabinet : modèle copié dans une copropriété visible (copie, idempotent) ; refusé hors portefeuille", async () => {
    const modele = await creerPrestataireModele(acteur(cabAdmin), cabinetId, { nom: "Otis Maroc", specialite: "Ascenseur", telephone: "+212522000000" });
    const c1 = await copierPrestataire(acteur(gestionnaire), cabinetId, modele.id, coproB);
    expect(c1.copie).toBe(true);
    const c2 = await copierPrestataire(acteur(gestionnaire), cabinetId, modele.id, coproB);
    expect(c2.copie).toBe(false);
    expect(await admin.prestataire.count({ where: { coproprieteId: coproB, cabinetPrestataireId: modele.id } })).toBe(1);
    await expect(copierPrestataire(acteur(gestionnaire), cabinetId, modele.id, coproC)).rejects.toBeInstanceOf(IntrouvableError);
    await expect(creerPrestataireModele(acteur(etranger), cabinetId, { nom: "X", specialite: "Y" })).rejects.toBeInstanceOf(IntrouvableError);
    expect(CabinetError).toBeDefined();
  });
});
