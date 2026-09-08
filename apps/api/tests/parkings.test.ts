/**
 * M23 — Parkings et caves : attributions (chevauchement → 409, notification, libération), plaques
 * (normalisation, unicité 409, résident limité à ses lots, recherche gardien AUDITÉE, jamais un
 * résident), badges (caution liée à un paiement du lot, perdu → tâche M22 + notif syndic,
 * restitution), place visiteur (uniquement PARKING_VISITEUR), « véhicule sur ma place », RLS
 * (résident : ses lots seulement), jobs (expiration + dépassement visiteur ; redevance mensuelle
 * → appel de fonds REDEVANCE_PARKING idempotent).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { attribuerEmplacement, attribuerPlaceVisiteur, creerBadge, creerEmplacement, creerVehicule, declarerBadgePerdu, libererEmplacement, listerBadges, listerEmplacements, listerVehicules, mesAttributions, modifierEmplacement, notifierVehiculeMalStationne, obtenirEmplacement, planEmplacements, rechercherVehicule, restituerBadge, visiteursAujourdhui, IntrouvableError, PermissionRefuseeError } from "../lib/parkings/parkings";
import { normaliserImmatriculation, immatriculationSchema } from "../lib/parkings/schemas";
import { executerParkingsQuotidien, executerRedevancesParking } from "../lib/parkings/jobs";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, amina: string, leila: string, rachid: string, lot1: string, lot2: string;
const ctx = (u: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId: u, coproprieteId: copro, role });
const S = () => ctx(syndic, "SYNDIC");
const A = () => ctx(amina, "PROPRIETAIRE");
const L = () => ctx(leila, "LOCATAIRE");
const G = () => ctx(rachid, "GARDIEN");
const SYS = (): TenantContext => ({ utilisateurId: "00000000-0000-0000-0000-000000000000", coproprieteId: copro, role: "SUPER_ADMIN" });
const PAGE = { page: 1, limit: 50, skip: 0, take: 50 };
const TRI = { champ: "code" as const, sens: "asc" as const };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (j: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + j); return d; };

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence Parkings", adresse: "4 rue Parkings", ville: "Tanger", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2 } });
  copro = c.id;
  const users = await Promise.all(["syndic", "amina", "leila", "rachid"].map((n) => admin.utilisateur.create({ data: { email: `${n}-parkings@test.local`, nom: n.toUpperCase(), prenom: "P", statutCompte: "ACTIF" } })));
  [syndic, amina, leila, rachid] = users.map((u) => u.id) as [string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" },
    { utilisateurId: leila, coproprieteId: copro, role: "LOCATAIRE" }, { utilisateurId: rachid, coproprieteId: copro, role: "GARDIEN" },
  ] });
  const [l1, l2] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "500.00", statut: "OCCUPE" } }),
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A2", tantiemes: "500.00", statut: "OCCUPE" } }),
  ]);
  lot1 = l1.id; lot2 = l2.id;
  await admin.lotProprietaire.createMany({ data: [{ lotId: lot1, utilisateurId: amina, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") }] });
  await admin.lotOccupant.createMany({ data: [{ lotId: lot2, utilisateurId: leila, typeOccupation: "LOCATAIRE", dateDebut: new Date("2025-01-01") }] });
});
afterAll(async () => {
  await admin.exportLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.tacheLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.tache.deleteMany({ where: { coproprieteId: copro } });
  await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: copro } } });
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.visite.deleteMany({ where: { coproprieteId: copro } });
  await admin.badge.deleteMany({ where: { coproprieteId: copro } });
  await admin.paiement.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFonds: { coproprieteId: copro } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: copro } });
  await admin.vehicule.deleteMany({ where: { coproprieteId: copro } });
  await admin.attributionEmplacement.deleteMany({ where: { coproprieteId: copro } });
  await admin.emplacement.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotOccupant.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.lotProprietaire.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-parkings@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect(); await disconnectTenantDb();
});

let empP1: string, empV1: string, empPmr: string;
describe("M23 — emplacements et attributions", () => {
  it("le syndic crée les emplacements (code unique → 409) ; une place visiteur n'est jamais attribuable ; le résident ne crée pas", async () => {
    empP1 = (await creerEmplacement(S(), { type: "PARKING_COMMUN", code: "P-1", niveau: "-1", attribuable: true })).id;
    empV1 = (await creerEmplacement(S(), { type: "PARKING_VISITEUR", code: "V-1", niveau: "-1", attribuable: true })).id;
    empPmr = (await creerEmplacement(S(), { type: "PARKING_PMR", code: "PMR", niveau: "0", attribuable: false })).id;
    await creerEmplacement(S(), { type: "PARKING_COMMUN", code: "P-2", niveau: "-1", attribuable: true });
    await expect(creerEmplacement(S(), { type: "PARKING_COMMUN", code: "P-1", attribuable: true })).rejects.toMatchObject({ code: "EMPLACEMENT_CODE_EXISTANT" });
    await expect(creerEmplacement(A(), { type: "PARKING_COMMUN", code: "P-9", attribuable: true })).rejects.toBeInstanceOf(PermissionRefuseeError);
    expect((await obtenirEmplacement(S(), empV1)).attribuable).toBe(false);
    await expect(attribuerEmplacement(S(), empV1, { lot_id: lot1, type: "ROTATION", date_debut: iso(plus(0)) })).rejects.toMatchObject({ code: "EMPLACEMENT_STATUT_INVALIDE" });
    await expect(attribuerEmplacement(S(), empPmr, { lot_id: lot1, type: "ROTATION", date_debut: iso(plus(0)) })).rejects.toMatchObject({ code: "EMPLACEMENT_STATUT_INVALIDE" });
  });
  it("attribution → emplacement ATTRIBUE + notification aux résidents du lot ; chevauchement → 409 ; période disjointe OK ; libération → DISPONIBLE", async () => {
    const e = await attribuerEmplacement(S(), empP1, { lot_id: lot1, type: "LOCATION_INTERNE", date_debut: iso(plus(-10)), date_fin: iso(plus(20)), redevance_mensuelle: "150.00" });
    expect(e.statut).toBe("ATTRIBUE");
    expect(e.attributionCourante?.lotNumero).toBe("A1");
    expect(e.attributionCourante?.redevanceMensuelle).toBe("150.00");
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: amina, templateCode: "ATTRIBUTION_EMPLACEMENT" } })).toBe(1);
    await expect(attribuerEmplacement(S(), empP1, { lot_id: lot2, type: "ROTATION", date_debut: iso(plus(15)), date_fin: iso(plus(40)) })).rejects.toMatchObject({ code: "ATTRIBUTION_CHEVAUCHEMENT" });
    await expect(attribuerEmplacement(S(), empP1, { lot_id: lot2, type: "ROTATION", date_debut: iso(plus(-30)) })).rejects.toMatchObject({ code: "ATTRIBUTION_CHEVAUCHEMENT" });
    const futur = await attribuerEmplacement(S(), empP1, { lot_id: lot2, type: "TEMPORAIRE", date_debut: iso(plus(30)), date_fin: iso(plus(35)) });
    expect(futur.attributions).toHaveLength(2);
    expect(futur.attributionCourante?.lotNumero).toBe("A1");
    // Résident : ses attributions seulement (RLS + plan lisible).
    expect((await mesAttributions(A())).map((a) => a.lotNumero)).toEqual(["A1"]);
    expect((await mesAttributions(L())).map((a) => a.lotNumero)).toEqual(["A2"]);
    const plan = await planEmplacements(A());
    expect(plan.totaux.total).toBe(4);
    expect(plan.totaux.attribues).toBe(1);
    // Libération aujourd'hui → DISPONIBLE, attribution close, résident prévenu.
    const lib = await libererEmplacement(S(), empP1, { motif: "Vente du lot" });
    expect(lib.statut).toBe("DISPONIBLE");
    expect(lib.attributionCourante).toBeNull();
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: amina, templateCode: "ATTRIBUTION_EXPIREE" } })).toBe(1);
    await expect(modifierEmplacement(S(), empP1, { statut: "HORS_SERVICE" })).resolves.toMatchObject({ statut: "HORS_SERVICE" });
    await modifierEmplacement(S(), empP1, { statut: "DISPONIBLE" });
    const liste = await listerEmplacements(G(), {}, PAGE, TRI);
    expect(liste.total).toBe(4);
  });
});

describe("M23 — véhicules", () => {
  it("normalisation de plaque (majuscules, espaces → tiret) ; unicité par copropriété → 409 ; résident limité à ses lots", async () => {
    expect(normaliserImmatriculation(" 12345 a 6 ")).toBe("12345-A-6");
    expect(normaliserImmatriculation("ww 123456")).toBe("WW-123456");
    expect(immatriculationSchema.safeParse("12345 - a - 6").data).toBe("12345-A-6");
    expect(immatriculationSchema.safeParse("!!").success).toBe(false);
    const v = await creerVehicule(A(), { lot_id: lot1, immatriculation: "12345 a 6", marque: "Dacia", type: "VOITURE" });
    expect(v.immatriculation).toBe("12345-A-6");
    expect(v.utilisateurId).toBe(amina);
    await expect(creerVehicule(L(), { lot_id: lot2, immatriculation: "12345-A-6", type: "VOITURE" })).rejects.toMatchObject({ code: "IMMATRICULATION_EXISTANTE" });
    await expect(creerVehicule(L(), { lot_id: lot1, immatriculation: "99999-Z-1", type: "VOITURE" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    await creerVehicule(L(), { lot_id: lot2, immatriculation: "98765-b-40", type: "VOITURE" });
    await creerVehicule(S(), { lot_id: lot2, immatriculation: "4567-C-12", type: "MOTO" });
    expect((await listerVehicules(A(), {})).map((x) => x.immatriculation)).toEqual(["12345-A-6"]);
    expect((await listerVehicules(L(), {})).map((x) => x.immatriculation).sort()).toEqual(["4567-C-12", "98765-B-40"]);
    expect(await listerVehicules(S(), {})).toHaveLength(3);
  });
  it("recherche de plaque : gardien / syndic OK et AUDITÉE (VEHICULE_RECHERCHE) ; résident refusé ; plaque inconnue → aucun exact", async () => {
    const r = await rechercherVehicule(G(), "12345 a 6");
    expect(r.exact?.lotNumero).toBe("A1");
    expect(r.exact?.marque).toBe("Dacia");
    const audits = await admin.auditLog.findMany({ where: { coproprieteId: copro, action: "VEHICULE_RECHERCHE", acteurId: rachid } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.apresJson).toMatchObject({ immatriculation: "12345-A-6", resultats: 1 });
    await expect(rechercherVehicule(A(), "98765-B-40")).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(rechercherVehicule(L(), "12345-A-6")).rejects.toBeInstanceOf(PermissionRefuseeError);
    const inconnue = await rechercherVehicule(S(), "00000-X-0");
    expect(inconnue.exact).toBeNull();
    expect(inconnue.similaires).toHaveLength(0);
  });
});

describe("M23 — badges", () => {
  let badgeId: string;
  it("remise avec caution liée à un paiement du lot (autre lot → 422) ; identifiant unique par type → 409 ; le résident voit ses badges", async () => {
    const appel = await admin.appelDeFonds.create({ data: { coproprieteId: copro, periode: "2026-01", type: "CHARGES_COURANTES", montantTotal: "1000.00", dateEcheance: new Date("2026-01-31"), statut: "EMIS", lignes: { create: [{ lotId: lot1, montantDu: "500.00" }, { lotId: lot2, montantDu: "500.00" }] } }, include: { lignes: true } });
    const ligne2 = appel.lignes.find((l) => l.lotId === lot2)!;
    const paiement = await admin.paiement.create({ data: { lotId: lot2, appelDeFondsLotId: ligne2.id, montant: "300.00", methode: "ESPECES", statut: "VALIDE" } });
    await expect(creerBadge(S(), { lot_id: lot1, type: "TELECOMMANDE_PARKING", identifiant: "TC-1", remis_le: "2026-09-01", caution_montant: "300.00", caution_paiement_id: paiement.id })).rejects.toMatchObject({ code: "BADGE_STATUT_INVALIDE" });
    const b = await creerBadge(S(), { lot_id: lot2, type: "TELECOMMANDE_PARKING", identifiant: "TC-1", remis_le: "2026-09-01", caution_montant: "300.00", caution_paiement_id: paiement.id });
    badgeId = b.id;
    expect(b.cautionPaiement?.montant).toBe("300.00");
    expect(b.statut).toBe("ACTIF");
    await expect(creerBadge(S(), { lot_id: lot1, type: "TELECOMMANDE_PARKING", identifiant: "TC-1", remis_le: "2026-09-01" })).rejects.toMatchObject({ code: "BADGE_IDENTIFIANT_EXISTANT" });
    await creerBadge(S(), { lot_id: lot1, type: "BADGE_PIETON", identifiant: "TC-1", remis_le: "2026-09-01" });
    await expect(creerBadge(L(), { lot_id: lot2, type: "CLE_CAVE", identifiant: "K-1", remis_le: "2026-09-01" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: leila, templateCode: "BADGE_REMIS" } })).toBe(1);
    expect((await listerBadges(L(), {})).map((x) => x.identifiant)).toEqual(["TC-1"]);
    expect((await listerBadges(A(), {})).map((x) => x.type)).toEqual(["BADGE_PIETON"]);
    expect(await listerBadges(G(), {})).toHaveLength(2);
  });
  it("perdu (par le locataire du lot) → PERDU + notification syndic ; syndic → tâche M22 « désactiver » unique ; restitution ; transitions invalides → 422", async () => {
    const perdu = await declarerBadgePerdu(L(), badgeId, { commentaire: "Perdu au marché", creer_tache: true });
    expect(perdu.statut).toBe("PERDU");
    expect(perdu.tache_id).toBeNull();
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "BADGE_PERDU" } })).toBe(1);
    await expect(declarerBadgePerdu(L(), badgeId, { creer_tache: true })).rejects.toMatchObject({ code: "BADGE_STATUT_INVALIDE" });
    const autre = (await listerBadges(A(), {}))[0]!;
    // Badge d'un autre lot : invisible sous RLS → 404 (jamais 403 qui révélerait l'existence).
    await expect(declarerBadgePerdu(L(), autre.id, { creer_tache: true })).rejects.toBeInstanceOf(IntrouvableError);
    const t1 = await declarerBadgePerdu(S(), autre.id, { creer_tache: true });
    expect(t1.tache_id).toBeTruthy();
    const tache = await admin.tache.findUniqueOrThrow({ where: { id: t1.tache_id! } });
    expect(tache.origine).toBe("SYSTEME");
    expect(tache.assigneeId).toBe(syndic);
    expect(tache.titre).toContain("TC-1");
    const rest = await restituerBadge(S(), badgeId, { restitue_le: "2026-09-08", caution_rendue: false });
    expect(rest.statut).toBe("RESTITUE");
    expect(rest.restitueLe).toBe("2026-09-08");
    await expect(restituerBadge(S(), badgeId, { caution_rendue: true })).rejects.toMatchObject({ code: "BADGE_STATUT_INVALIDE" });
    const audit = await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "BADGE_RESTITUE", entiteId: badgeId } });
    expect(audit?.apresJson).toMatchObject({ caution_rendue: false, caution_montant: "300.00" });
  });
});

describe("M23 — places visiteurs et « véhicule sur ma place »", () => {
  let visiteId: string;
  it("le gardien attribue une place visiteur à SA visite (PARKING_VISITEUR seulement → 422 sinon ; place occupée → 409) ; liste du jour", async () => {
    const v = await admin.visite.create({ data: { coproprieteId: copro, gardienId: rachid, lotId: lot1, visiteurNom: "Livreur", statut: "AUTORISE" } });
    visiteId = v.id;
    await expect(attribuerPlaceVisiteur(G(), visiteId, { emplacement_id: empP1, immatriculation: "55555-D-9", heure_limite: null })).rejects.toMatchObject({ code: "EMPLACEMENT_NON_VISITEUR" });
    await expect(attribuerPlaceVisiteur(A(), visiteId, { emplacement_id: empV1, immatriculation: null, heure_limite: null })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const limite = new Date(Date.now() - 60_000).toISOString();
    const r = await attribuerPlaceVisiteur(G(), visiteId, { emplacement_id: empV1, immatriculation: "55555 d 9", heure_limite: limite });
    expect(r.emplacement?.code).toBe("V-1");
    expect(r.immatriculation).toBe("55555-D-9");
    const v2 = await admin.visite.create({ data: { coproprieteId: copro, gardienId: rachid, lotId: lot2, visiteurNom: "Cousin", statut: "AUTORISE" } });
    // Place occupée seulement si l'heure limite n'est pas passée : ici passée → réutilisable ; on la remet dans le futur pour tester le 409.
    await admin.visite.update({ where: { id: visiteId }, data: { heureLimite: new Date(Date.now() + 3_600_000) } });
    await expect(attribuerPlaceVisiteur(G(), v2.id, { emplacement_id: empV1, immatriculation: null, heure_limite: null })).rejects.toMatchObject({ code: "ATTRIBUTION_CHEVAUCHEMENT" });
    const jour = await visiteursAujourdhui(G());
    expect(jour.visites.map((x) => x.immatriculation)).toEqual(["55555-D-9"]);
    expect(jour.places_libres).toHaveLength(0);
    await expect(visiteursAujourdhui(A())).rejects.toBeInstanceOf(PermissionRefuseeError);
    await admin.visite.update({ where: { id: visiteId }, data: { heureLimite: new Date(Date.now() - 60_000) } });
  });
  it("incident PARKING avec plaque signalée → le gardien prévient le lot du véhicule (recherche auditée) ; plaque inconnue → 422 ; résident refusé", async () => {
    const inc = await admin.incident.create({ data: { coproprieteId: copro, lotId: lot2, categorie: "PARKING", sousCategorie: "Véhicule sur ma place", partie: "COMMUNE", urgence: "NORMALE", statut: "OUVERT", creePar: leila, emplacementId: empP1, immatriculationSignalee: "12345-A-6" } });
    const r = await notifierVehiculeMalStationne(G(), inc.id, {});
    expect(r).toMatchObject({ immatriculation: "12345-A-6", lot: "A1", notifies: 1 });
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: amina, templateCode: "VEHICULE_MAL_STATIONNE" } })).toBe(1);
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "VEHICULE_RECHERCHE", entite: "incident", entiteId: inc.id } })).toBe(1);
    await expect(notifierVehiculeMalStationne(G(), inc.id, { immatriculation: "00000-X-0" })).rejects.toMatchObject({ code: "IMMATRICULATION_INCONNUE" });
    await expect(notifierVehiculeMalStationne(L(), inc.id, {})).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("M23 — jobs", () => {
  it("quotidien : attribution expirée → DISPONIBLE + ATTRIBUTION_EXPIREE une seule fois ; début arrivé → ATTRIBUE ; dépassement visiteur → gardien une fois", async () => {
    const e = await creerEmplacement(S(), { type: "PARKING_COMMUN", code: "P-J", attribuable: true });
    await attribuerEmplacement(S(), e.id, { lot_id: lot1, type: "TEMPORAIRE", date_debut: iso(plus(-10)), date_fin: iso(plus(-1)) });
    await admin.emplacement.update({ where: { id: e.id }, data: { statut: "ATTRIBUE" } });
    const e2 = await creerEmplacement(S(), { type: "MOTO", code: "M-J", attribuable: true });
    await admin.attributionEmplacement.create({ data: { coproprieteId: copro, emplacementId: e2.id, lotId: lot2, type: "ROTATION", dateDebut: plus(-1), dateFin: null } });
    const avant = await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: amina, templateCode: "ATTRIBUTION_EXPIREE" } });
    const r1 = await withTenant(SYS(), (db) => executerParkingsQuotidien(db, copro));
    expect(r1).toMatchObject({ expirees: 1, demarrees: 1, depassements: 1 });
    expect((await admin.emplacement.findUniqueOrThrow({ where: { id: e.id } })).statut).toBe("DISPONIBLE");
    expect((await admin.emplacement.findUniqueOrThrow({ where: { id: e2.id } })).statut).toBe("ATTRIBUE");
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: amina, templateCode: "ATTRIBUTION_EXPIREE" } })).toBe(avant + 1);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: rachid, templateCode: "VISITEUR_DEPASSEMENT" } })).toBe(1);
    const r2 = await withTenant(SYS(), (db) => executerParkingsQuotidien(db, copro));
    expect(r2).toMatchObject({ expirees: 0, demarrees: 0, depassements: 0 });
  });
  it("mensuel : redevances actives → un appel REDEVANCE_PARKING par période (une ligne par lot, montant = somme) ; rejeu = rien ; aucune redevance = rien", async () => {
    const e = await creerEmplacement(S(), { type: "PARKING_COMMUN", code: "P-R", attribuable: true });
    await attribuerEmplacement(S(), e.id, { lot_id: lot2, type: "LOCATION_INTERNE", date_debut: iso(plus(-40)), redevance_mensuelle: "150.00" });
    const e2 = await creerEmplacement(S(), { type: "PARKING_COMMUN", code: "P-R2", attribuable: true });
    await attribuerEmplacement(S(), e2.id, { lot_id: lot2, type: "LOCATION_INTERNE", date_debut: iso(plus(-40)), redevance_mensuelle: "50.50" });
    const now = new Date("2026-10-01T06:00:00Z");
    const r1 = await withTenant(SYS(), (db) => executerRedevancesParking(db, copro, now));
    expect(r1).toEqual({ appels: 1, lignes: 1 });
    const appel = await admin.appelDeFonds.findUniqueOrThrow({ where: { coproprieteId_periode_type: { coproprieteId: copro, periode: "2026-10", type: "REDEVANCE_PARKING" } }, include: { lignes: true } });
    expect(appel.montantTotal.toString()).toBe("200.5");
    expect(appel.lignes).toHaveLength(1);
    expect(appel.lignes[0]!.lotId).toBe(lot2);
    expect(appel.dateEcheance.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(await withTenant(SYS(), (db) => executerRedevancesParking(db, copro, now))).toEqual({ appels: 0, lignes: 0 });
    expect(await withTenant(SYS(), (db) => executerRedevancesParking(db, copro, new Date("2020-01-01T06:00:00Z")))).toEqual({ appels: 0, lignes: 0 });
  });
});
