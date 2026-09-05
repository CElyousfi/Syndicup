/**
 * Tests M15 — Location courte durée (Doc A §10.2) : règlement (régimes), déclarations (workflow
 * ENCADREE / AUTORISEE / INTERDITE / NON_DEFINI, gestionnaire requis), séjours (déclaration
 * VALIDEE requise, chevauchement, quota de nuits, délai de déclaration, transitions, journal
 * append-only), lien incident ↔ séjour, job quotidien idempotent, anonymisation CNDP des
 * voyageurs.
 *
 * Prérequis : Supabase local + migration m15 + rôle app_local.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  modifierReglement,
  obtenirReglement,
  creerDeclaration,
  deciderDeclaration,
  cloturerDeclaration,
  designerGestionnaire,
  creerSejour,
  modifierSejour,
  annulerSejour,
  confirmerArrivee,
  confirmerDepart,
  sejoursDuJour,
  obtenirSejour,
  syntheseLot,
  executerSejoursQuotidien,
  LcdError,
  PermissionRefuseeError,
} from "../lib/lcd/lcd";
import { executerSejoursQuotidienCopropriete } from "../lib/lcd/jobs";
import { creerIncident } from "../lib/incidents/incidents";
import { sejourCreateSchema, reglementLcdUpdateSchema, declarationLcdDecisionSchema } from "../lib/lcd/schemas";
import { executerAnonymisationCndp, ANONYME_VOYAGEUR } from "../lib/users/anonymisation";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let copro: string;
let syndic: string;
let amina: string; // PROPRIETAIRE occupant lot A1
let mre: string; // PROPRIETAIRE absent (MRE) lot A2
let gardien: string;
let gestionnaire: string; // GESTIONNAIRE_LCD (compte existant dans la copro)
let locataire: string;
let lotA1: string;
let lotA2: string;

const ctx = (utilisateurId: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId, coproprieteId: copro, role });
const ctxSyndic = () => ctx(syndic, "SYNDIC");
const ctxAmina = () => ctx(amina, "PROPRIETAIRE");
const ctxMre = () => ctx(mre, "PROPRIETAIRE");
const ctxGardien = () => ctx(gardien, "GARDIEN");
const ctxGest = () => ctx(gestionnaire, "GESTIONNAIRE_LCD");

const PARAMS = {
  declaration_prealable_obligatoire: true,
  delai_declaration_heures: 24,
  nb_nuits_max_par_an: 10,
  nb_voyageurs_max_par_lot: 3,
  gestionnaire_obligatoire_si_proprietaire_absent: true,
  contact_gardien_obligatoire: true,
};

/** Date ISO à J+n (UTC). */
function jour(delta: number, base = new Date()): string {
  const d = new Date(base);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  const c = await admin.copropriete.create({
    data: { nom: "Résidence LCD Tests", adresse: "3 rue LCD", ville: "Marrakech", typeResidence: "RESIDENCE_FERMEE", nbLots: 4 },
  });
  copro = c.id;
  const users = await Promise.all(
    ["syndic", "amina", "mre", "gardien", "gest", "loc"].map((n) => admin.utilisateur.create({ data: { email: `${n}-lcd@test.local`, statutCompte: "ACTIF" } }))
  );
  [syndic, amina, mre, gardien, gestionnaire, locataire] = users.map((u) => u.id) as [string, string, string, string, string, string];
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" },
      { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" },
      { utilisateurId: mre, coproprieteId: copro, role: "PROPRIETAIRE" },
      { utilisateurId: gardien, coproprieteId: copro, role: "GARDIEN" },
      { utilisateurId: gestionnaire, coproprieteId: copro, role: "GESTIONNAIRE_LCD" },
      { utilisateurId: locataire, coproprieteId: copro, role: "LOCATAIRE" },
    ],
  });
  const [l1, l2] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "100.00" } }),
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "VILLA", numero: "V2", tantiemes: "100.00" } }),
  ]);
  lotA1 = l1.id;
  lotA2 = l2.id;
  await admin.lotProprietaire.createMany({
    data: [
      { lotId: lotA1, utilisateurId: amina, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: lotA2, utilisateurId: mre, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    ],
  });
  await admin.lotOccupant.create({ data: { lotId: lotA1, utilisateurId: amina, typeOccupation: "PROPRIETAIRE_OCCUPANT", dateDebut: new Date("2024-01-01") } });
});

afterAll(async () => {
  await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: copro } } });
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.sejourEvenement.deleteMany({ where: { coproprieteId: copro } });
  await admin.sejourCourteDuree.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotLocationCourteDuree.deleteMany({ where: { coproprieteId: copro } });
  await admin.invitation.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotOccupant.deleteMany({ where: { lotId: { in: [lotA1, lotA2] } } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: [lotA1, lotA2] } } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-lcd@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

async function fixerRegime(regime: "NON_DEFINI" | "AUTORISEE" | "ENCADREE" | "INTERDITE") {
  await admin.copropriete.update({ where: { id: copro }, data: { regimeLcd: regime, parametresLcdJson: regime === "ENCADREE" ? PARAMS : undefined } });
}
async function purgerLcd() {
  await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: copro } } });
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.sejourEvenement.deleteMany({ where: { coproprieteId: copro } });
  await admin.sejourCourteDuree.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotLocationCourteDuree.deleteMany({ where: { coproprieteId: copro } });
}

describe("Règlement (régime LCD)", () => {
  it("Zod : ENCADREE exige les paramètres ; refus d'un motif absent hors validation", () => {
    expect(reglementLcdUpdateSchema.safeParse({ regime_lcd: "ENCADREE" }).success).toBe(false);
    expect(reglementLcdUpdateSchema.safeParse({ regime_lcd: "ENCADREE", parametres_lcd_json: PARAMS }).success).toBe(true);
    expect(reglementLcdUpdateSchema.safeParse({ regime_lcd: "ENCADREE", parametres_lcd_json: { ...PARAMS, inconnu: 1 } }).success).toBe(false);
    expect(declarationLcdDecisionSchema.safeParse({ decision: "REFUSEE" }).success).toBe(false);
    expect(declarationLcdDecisionSchema.safeParse({ decision: "VALIDEE" }).success).toBe(true);
  });

  it("le syndic fixe le régime avec audit ; un propriétaire ne peut pas", async () => {
    await expect(modifierReglement(ctxAmina(), { regime_lcd: "AUTORISEE" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const r = await modifierReglement(ctxSyndic(), { regime_lcd: "ENCADREE", parametres_lcd_json: PARAMS });
    expect(r.regimeLcd).toBe("ENCADREE");
    const lu = await obtenirReglement(ctxGardien());
    expect(lu.parametresLcdJson).toMatchObject({ nb_nuits_max_par_an: 10 });
    const audit = await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "LCD_REGLEMENT_MODIFIE" } });
    expect(audit).not.toBeNull();
  });
});

describe("Déclarations — régimes", () => {
  it("NON_DEFINI → 422 LCD_REGIME_NON_DEFINI", async () => {
    await fixerRegime("NON_DEFINI");
    await expect(creerDeclaration(ctxAmina(), { lot_id: lotA1 })).rejects.toMatchObject({ code: "LCD_REGIME_NON_DEFINI" });
  });

  it("INTERDITE → 422 LCD_INTERDITE", async () => {
    await fixerRegime("INTERDITE");
    await expect(creerDeclaration(ctxAmina(), { lot_id: lotA1 })).rejects.toMatchObject({ code: "LCD_INTERDITE" });
  });

  it("ENCADREE sans paramètres → 422 LCD_PARAMETRE_NON_CONFIGURE", async () => {
    await admin.copropriete.update({ where: { id: copro }, data: { regimeLcd: "ENCADREE", parametresLcdJson: undefined } });
    await admin.copropriete.update({ where: { id: copro }, data: { parametresLcdJson: { declaration_prealable_obligatoire: true } } });
    await expect(creerDeclaration(ctxAmina(), { lot_id: lotA1 })).rejects.toMatchObject({ code: "LCD_PARAMETRE_NON_CONFIGURE" });
  });

  it("AUTORISEE → déclaration VALIDEE directement ; une seconde déclaration ouverte → 409", async () => {
    await fixerRegime("AUTORISEE");
    const d = await creerDeclaration(ctxAmina(), { lot_id: lotA1, plateformes: ["Airbnb"] });
    expect(d.statut).toBe("VALIDEE");
    await expect(creerDeclaration(ctxAmina(), { lot_id: lotA1 })).rejects.toMatchObject({ code: "CONFLICT" });
    // Un propriétaire ne déclare pas le lot d'un autre ; un locataire jamais.
    await expect(creerDeclaration(ctxAmina(), { lot_id: lotA2 })).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(creerDeclaration(ctx(locataire, "LOCATAIRE"), { lot_id: lotA1 })).rejects.toBeInstanceOf(PermissionRefuseeError);
    await purgerLcd();
  });

  it("ENCADREE → EN_ATTENTE, puis décision syndic VALIDEE / REFUSEE avec motif, notifications", async () => {
    await purgerLcd();
    await fixerRegime("ENCADREE");
    const d = await creerDeclaration(ctxAmina(), { lot_id: lotA1 });
    expect(d.statut).toBe("EN_ATTENTE");
    // Le syndic a été prévenu.
    const notif = await admin.notification.findFirst({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "LCD_DECLARATION_A_VALIDER" } });
    expect(notif).not.toBeNull();

    await expect(deciderDeclaration(ctxAmina(), d.id, { decision: "VALIDEE" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const refusee = await deciderDeclaration(ctxSyndic(), d.id, { decision: "REFUSEE", motif: "Nuisances 2025" });
    expect(refusee.statut).toBe("REFUSEE");
    expect(refusee.motifDecision).toBe("Nuisances 2025");
    const notifProprio = await admin.notification.findFirst({ where: { coproprieteId: copro, utilisateurId: amina, templateCode: "LCD_DECLARATION_DECISION" } });
    expect(notifProprio).not.toBeNull();
    // Le gardien ne voit pas une déclaration REFUSEE.
    const vuGardien = await withTenant(ctxGardien(), (db) => db.lotLocationCourteDuree.findUnique({ where: { id: d.id } }));
    expect(vuGardien).toBeNull();

    const validee = await deciderDeclaration(ctxSyndic(), d.id, { decision: "VALIDEE" });
    expect(validee.statut).toBe("VALIDEE");
    expect((await withTenant(ctxGardien(), (db) => db.lotLocationCourteDuree.findUnique({ where: { id: d.id } })))?.id).toBe(d.id);
  });

  it("propriétaire absent (MRE) sans gestionnaire → 422 LCD_GESTIONNAIRE_REQUIS ; avec gestionnaire → OK", async () => {
    await expect(creerDeclaration(ctxMre(), { lot_id: lotA2 })).rejects.toMatchObject({ code: "LCD_GESTIONNAIRE_REQUIS" });
    const d = await creerDeclaration(ctxMre(), { lot_id: lotA2, gestionnaire_id: gestionnaire });
    expect(d.gestionnaireId).toBe(gestionnaire);
    // Le gestionnaire voit sa déclaration.
    const vues = await withTenant(ctxGest(), (db) => db.lotLocationCourteDuree.findMany());
    expect(vues.map((x) => x.id)).toEqual([d.id]);
  });

  it("désignation d'un gestionnaire sans compte → invitation GESTIONNAIRE_LCD sur le lot", async () => {
    const d = await admin.lotLocationCourteDuree.findFirstOrThrow({ where: { lotId: lotA1, dateFin: null } });
    const r = await designerGestionnaire(ctxAmina(), d.id, { email: "nouveau-gest@example.ma", canal: "SMS" });
    expect(r.invitation).not.toBeNull();
    const inv = await admin.invitation.findUnique({ where: { id: r.invitation!.id } });
    expect(inv?.roleCible).toBe("GESTIONNAIRE_LCD");
    expect(inv?.lotId).toBe(lotA1);
    // Compte existant membre de la copropriété → rôle créé + désigné.
    const r2 = await designerGestionnaire(ctxAmina(), d.id, { utilisateur_id: locataire, canal: "SMS" });
    expect(r2.declaration.gestionnaireId).toBe(locataire);
    expect(await admin.roleUtilisateur.findFirst({ where: { utilisateurId: locataire, coproprieteId: copro, role: "GESTIONNAIRE_LCD" } })).not.toBeNull();
    // Remise à zéro pour la suite (Amina gère seule son lot).
    await admin.lotLocationCourteDuree.update({ where: { id: d.id }, data: { gestionnaireId: null } });
  });
});

describe("Séjours", () => {
  let sejourId: string;

  it("séjour sur déclaration non VALIDEE → 422 ; règles ENCADREE : voyageurs max, délai, quota", async () => {
    // Lot A2 : déclaration EN_ATTENTE (ENCADREE) → refus.
    await expect(
      creerSejour(ctxMre(), { lot_id: lotA2, date_arrivee: jour(5), date_depart: jour(7), nb_voyageurs: 2, voyageur_principal_nom: "X" })
    ).rejects.toMatchObject({ code: "LCD_DECLARATION_NON_VALIDEE" });
    // Lot A1 (VALIDEE) : trop de voyageurs.
    await expect(
      creerSejour(ctxAmina(), { lot_id: lotA1, date_arrivee: jour(5), date_depart: jour(7), nb_voyageurs: 4, voyageur_principal_nom: "X" })
    ).rejects.toMatchObject({ code: "LCD_VOYAGEURS_MAX" });
    // Délai de déclaration (24 h) : arrivée aujourd'hui → refus.
    await expect(
      creerSejour(ctxAmina(), { lot_id: lotA1, date_arrivee: jour(0), date_depart: jour(2), nb_voyageurs: 1, voyageur_principal_nom: "X" })
    ).rejects.toMatchObject({ code: "LCD_DELAI_DECLARATION" });
    // Quota 10 nuits/an : 12 nuits → refus.
    await expect(
      creerSejour(ctxAmina(), { lot_id: lotA1, date_arrivee: jour(5), date_depart: jour(17), nb_voyageurs: 1, voyageur_principal_nom: "X" })
    ).rejects.toMatchObject({ code: "LCD_QUOTA_NUITS_DEPASSE" });
  });

  it("création : événement DECLARE, audit, syndic + gardien notifiés (gardien_informe_le), idempotence", async () => {
    const input = { lot_id: lotA1, date_arrivee: jour(5), date_depart: jour(8), heure_arrivee_prevue: "16:00", nb_voyageurs: 2, voyageur_principal_nom: "Sara El Idrissi", piece_identite_type: "CIN" as const, piece_identite_fin: "12ab" };
    expect(sejourCreateSchema.safeParse({ ...input, piece_identite_fin: "123456" }).success).toBe(false);
    const cle = "11111111-1111-4111-8111-111111111111";
    const s = await creerSejour(ctxAmina(), input, cle);
    sejourId = s.id;
    expect(s.statut).toBe("PREVU");
    expect(s.pieceIdentiteFin).toBe("12AB");
    const rejeu = await creerSejour(ctxAmina(), input, cle);
    expect(rejeu.id).toBe(s.id);
    expect(await admin.sejourCourteDuree.count({ where: { lotId: lotA1 } })).toBe(1);
    const evs = await admin.sejourEvenement.findMany({ where: { sejourId }, orderBy: { horodatage: "asc" } });
    expect(evs.map((e) => e.type)).toEqual(["DECLARE", "GARDIEN_NOTIFIE"]);
    expect((await admin.sejourCourteDuree.findUnique({ where: { id: sejourId } }))?.gardienInformeLe).not.toBeNull();
    expect(await admin.notification.findFirst({ where: { coproprieteId: copro, utilisateurId: gardien, templateCode: "LCD_SEJOUR_GARDIEN" } })).not.toBeNull();
    expect(await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "LCD_SEJOUR_DECLARE", entiteId: sejourId } })).not.toBeNull();
  });

  it("chevauchement sur le même lot → 409 LCD_SEJOUR_CHEVAUCHEMENT ; enchaînement le même jour → OK", async () => {
    await expect(
      creerSejour(ctxAmina(), { lot_id: lotA1, date_arrivee: jour(7), date_depart: jour(9), nb_voyageurs: 1, voyageur_principal_nom: "Y" })
    ).rejects.toMatchObject({ code: "LCD_SEJOUR_CHEVAUCHEMENT" });
    const suivant = await creerSejour(ctxAmina(), { lot_id: lotA1, date_arrivee: jour(8), date_depart: jour(10), nb_voyageurs: 1, voyageur_principal_nom: "Y" });
    expect(suivant.statut).toBe("PREVU");
    await annulerSejour(ctxAmina(), suivant.id, { motif: "test" });
    expect((await admin.sejourCourteDuree.findUnique({ where: { id: suivant.id } }))?.statut).toBe("ANNULE");
  });

  it("modification (PREVU seulement) et transitions gardien : arrivée puis départ, journal append-only", async () => {
    const modif = await modifierSejour(ctxAmina(), sejourId, { nb_voyageurs: 3 });
    expect(modif.nbVoyageurs).toBe(3);
    // Le locataire / le propriétaire ne confirment pas ; le gardien oui.
    await expect(confirmerArrivee(ctxAmina(), sejourId, {})).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(confirmerDepart(ctxGardien(), sejourId)).rejects.toMatchObject({ code: "UNPROCESSABLE_ENTITY" });
    const enCours = await confirmerArrivee(ctxGardien(), sejourId, { nb_voyageurs_constate: 2 });
    expect(enCours.statut).toBe("EN_COURS");
    expect(enCours.nbVoyageurs).toBe(3); // le déclaré n'est jamais écrasé
    await expect(modifierSejour(ctxAmina(), sejourId, { nb_voyageurs: 1 })).rejects.toMatchObject({ code: "UNPROCESSABLE_ENTITY" });
    // Le gardien voit le séjour du jour ; le détail porte le journal.
    const dj = await sejoursDuJour(ctxGardien());
    expect(dj.enCours.map((s) => s.id)).toContain(sejourId);
    const detail = await obtenirSejour(ctxGardien(), sejourId);
    expect(detail.evenements.map((e) => e.type)).toContain("ARRIVEE_CONFIRMEE");

    // Incident lié au séjour en cours → événement INCIDENT_LIE.
    const inc = await creerIncident(ctxGardien(), { categorie: "NUISANCES", sous_categorie: "Bruit nocturne", partie: "PRIVATIVE", urgence: "NORMALE", lot_id: lotA1, sejour_id: sejourId });
    expect(inc.sejourId).toBe(sejourId);

    const termine = await confirmerDepart(ctxGardien(), sejourId);
    expect(termine.statut).toBe("TERMINE");
    const evs = await admin.sejourEvenement.findMany({ where: { sejourId }, orderBy: { horodatage: "asc" } });
    expect(evs.map((e) => e.type)).toEqual(["DECLARE", "GARDIEN_NOTIFIE", "MODIFIE", "ARRIVEE_CONFIRMEE", "INCIDENT_LIE", "DEPART_CONFIRME"]);
    expect((evs[3]!.detailsJson as { nb_voyageurs_constate: number }).nb_voyageurs_constate).toBe(2);
    // Append-only : UPDATE refusé au niveau base.
    await expect(withTenant(ctxSyndic(), (db) => db.sejourEvenement.update({ where: { id: evs[0]!.id }, data: { type: "ANNULE" } }))).rejects.toThrow();
    // Un séjour TERMINE reste liable ≤ 7 jours ; un incident sur un séjour ANNULE est refusé.
    const annule = await admin.sejourCourteDuree.findFirstOrThrow({ where: { lotId: lotA1, statut: "ANNULE" } });
    await expect(
      creerIncident(ctxGardien(), { categorie: "NUISANCES", sous_categorie: "Bruit", partie: "PRIVATIVE", urgence: "NORMALE", lot_id: lotA1, sejour_id: annule.id })
    ).rejects.toBeInstanceOf(LcdError);
  });

  it("synthèse du lot : nuits utilisées, quota, incidents liés ; clôture refusée tant qu'un séjour est prévu", async () => {
    const prevu = await creerSejour(ctxAmina(), { lot_id: lotA1, date_arrivee: jour(20), date_depart: jour(22), nb_voyageurs: 1, voyageur_principal_nom: "Z" });
    const synth = await syntheseLot(ctxAmina(), lotA1);
    expect(synth.nuitsQuota).toBe(10);
    expect(synth.nuitsUtilisees).toBe(3 + 2);
    // Incidents liés : comptés sous la RLS incident — le syndic voit celui créé par le gardien,
    // le propriétaire uniquement les siens (Doc A §12.3).
    expect((await syntheseLot(ctxSyndic(), lotA1)).incidentsLies).toBeGreaterThanOrEqual(1);
    const decl = await admin.lotLocationCourteDuree.findFirstOrThrow({ where: { lotId: lotA1, dateFin: null } });
    await expect(cloturerDeclaration(ctxAmina(), decl.id, {})).rejects.toMatchObject({ code: "CONFLICT" });
    await annulerSejour(ctxAmina(), prevu.id, {});
    const cloturee = await cloturerDeclaration(ctxAmina(), decl.id, {});
    expect(cloturee.statut).toBe("CLOTUREE");
    expect(cloturee.dateFin).not.toBeNull();
  });
});

describe("Job quotidien lcd-sejours-quotidien", () => {
  it("rappelle l'arrivée du jour au gardien une seule fois et clôture automatiquement les départs passés", async () => {
    await purgerLcd();
    const decl = await admin.lotLocationCourteDuree.create({ data: { coproprieteId: copro, lotId: lotA1, declareParId: amina, statut: "VALIDEE", dateDebut: new Date("2026-01-01") } });
    const now = new Date();
    const arriveeAujourdhui = await admin.sejourCourteDuree.create({
      data: { coproprieteId: copro, lotId: lotA1, declarationLcdId: decl.id, declareParId: amina, dateArrivee: new Date(jour(0, now)), dateDepart: new Date(jour(2, now)), nbVoyageurs: 2, voyageurPrincipalNom: "Arrivant", heureArriveePrevue: "15:00" },
    });
    const departPasse = await admin.sejourCourteDuree.create({
      data: { coproprieteId: copro, lotId: lotA2, declarationLcdId: decl.id, declareParId: amina, dateArrivee: new Date(jour(-4, now)), dateDepart: new Date(jour(-1, now)), nbVoyageurs: 1, voyageurPrincipalNom: "Parti", statut: "EN_COURS" },
    });
    const prevuPasse = await admin.sejourCourteDuree.create({
      data: { coproprieteId: copro, lotId: lotA2, declarationLcdId: decl.id, declareParId: amina, dateArrivee: new Date(jour(-3, now)), dateDepart: new Date(jour(-2, now)), nbVoyageurs: 1, voyageurPrincipalNom: "Jamais venu", statut: "PREVU" },
    });

    const r1 = await executerSejoursQuotidienCopropriete(copro, now);
    expect(r1).toEqual({ rappelsArrivee: 1, departsAutomatiques: 1 });
    const r2 = await executerSejoursQuotidienCopropriete(copro, now);
    expect(r2).toEqual({ rappelsArrivee: 0, departsAutomatiques: 0 });

    expect((await admin.sejourCourteDuree.findUnique({ where: { id: departPasse.id } }))?.statut).toBe("TERMINE");
    // Jamais PREVU → EN_COURS automatiquement.
    expect((await admin.sejourCourteDuree.findUnique({ where: { id: prevuPasse.id } }))?.statut).toBe("PREVU");
    const evsDepart = await admin.sejourEvenement.findMany({ where: { sejourId: departPasse.id, type: "DEPART_CONFIRME" } });
    expect(evsDepart).toHaveLength(1);
    expect(evsDepart[0]!.acteurId).toBeNull();
    expect((evsDepart[0]!.detailsJson as { auto: boolean }).auto).toBe(true);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: gardien, templateCode: "LCD_ARRIVEE_AUJOURDHUI" } })).toBe(1);
    expect(await admin.sejourEvenement.count({ where: { sejourId: arriveeAujourdhui.id, type: "GARDIEN_NOTIFIE" } })).toBe(1);
    // Version « toutes copropriétés » de la fonction de service (même signature de résultat).
    await expect(withTenant({ utilisateurId: "00000000-0000-0000-0000-000000000000", coproprieteId: copro, role: "SUPER_ADMIN" }, (db) => executerSejoursQuotidien(db, copro, now))).resolves.toEqual({ rappelsArrivee: 0, departsAutomatiques: 0 });
  });
});

describe("Anonymisation CNDP des voyageurs (M13 étendu)", () => {
  it("efface les données voyageur des séjours terminés au-delà de la rétention configurée", async () => {
    await admin.copropriete.update({ where: { id: copro }, data: { retentionDesactivationMois: 6 } });
    const decl = await admin.lotLocationCourteDuree.findFirstOrThrow({ where: { coproprieteId: copro, dateFin: null } });
    const ancien = await admin.sejourCourteDuree.create({
      data: { coproprieteId: copro, lotId: lotA1, declarationLcdId: decl.id, declareParId: amina, dateArrivee: new Date("2025-01-02"), dateDepart: new Date("2025-01-05"), nbVoyageurs: 1, voyageurPrincipalNom: "Ancien Voyageur", voyageurTelephone: "+212600000099", pieceIdentiteType: "CIN", pieceIdentiteFin: "ZZ99", statut: "TERMINE" },
    });
    const resultat = await executerAnonymisationCndp();
    expect(resultat.sejoursAnonymises).toBeGreaterThanOrEqual(1);
    const apres = await admin.sejourCourteDuree.findUniqueOrThrow({ where: { id: ancien.id } });
    expect(apres.voyageurPrincipalNom).toBe(ANONYME_VOYAGEUR);
    expect(apres.voyageurTelephone).toBeNull();
    expect(apres.pieceIdentiteFin).toBeNull();
    // Un séjour récent n'est pas touché.
    const recent = await admin.sejourCourteDuree.findFirst({ where: { coproprieteId: copro, voyageurPrincipalNom: "Arrivant" } });
    expect(recent).not.toBeNull();
    await admin.copropriete.update({ where: { id: copro }, data: { retentionDesactivationMois: null } });
  });
});
