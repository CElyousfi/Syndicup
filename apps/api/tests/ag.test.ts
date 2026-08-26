/**
 * Tests M6 (ROADMAP_BACKLOG.md) : Assemblées Générales — Master Spec Partie 8, Doc A §6.
 * ⚠️ Module légalement sensible (docs/LEGAL_QUESTIONS_BRIEF.md §0/§2/§4) : les tests couvrent la
 * STRUCTURE et les mécaniques de calcul (Master Spec Partie 8.3/8.4), pas des valeurs légales
 * disputées. Prérequis : Supabase local démarré + migration `20260823120000_m6_assemblees_generales`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerAg,
  convoquerAg,
  ouvrirAg,
  annulerAg,
  creerResolution,
  voter,
  finaliserResolution,
  cloturerAg,
  obtenirResultatsResolution,
  listerVotesNominatifs,
  creerProcuration,
  PermissionRefuseeError,
  ContrainteMetierError,
} from "../lib/ag/ag";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string; // paramètres légaux configurés, total_tantiemes = 120 (60+40+20)
let coproNonConfiguree: string; // paramètres légaux NULL — pour tester les blocages 422
// Copropriété dédiée aux tests qui créent des lots supplémentaires à la volée (égalité,
// procurations) — total_tantiemes volontairement NON configuré pour ne pas heurter le trigger
// M3 "somme des tantièmes ≤ total du règlement" à chaque nouveau lot de test.
let coproExtra: string;
let syndicA: string;
let alice: string; // lot 60 tantiemes, PLEIN
let bob: string; // lot 40 tantiemes, PLEIN
let charlie: string; // indivisaire non-représentant
let dave: string; // indivisaire représentant

let lotAlice: string;
let lotBob: string;
let lotIndivision: string;

const ctxSyndicA = (): TenantContext => ({ utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" });
const ctxAlice = (): TenantContext => ({ utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" });
const ctxBob = (): TenantContext => ({ utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" });
const ctxCharlie = (): TenantContext => ({ utilisateurId: charlie, coproprieteId: coproA, role: "INDIVISAIRE" });
const ctxDave = (): TenantContext => ({ utilisateurId: dave, coproprieteId: coproA, role: "INDIVISAIRE" });
const ctxAliceExtra = (): TenantContext => ({ utilisateurId: alice, coproprieteId: coproExtra, role: "PROPRIETAIRE" });
const ctxBobExtra = (): TenantContext => ({ utilisateurId: bob, coproprieteId: coproExtra, role: "PROPRIETAIRE" });
const ctxCharlieExtra = (): TenantContext => ({ utilisateurId: charlie, coproprieteId: coproExtra, role: "PROPRIETAIRE" });
const ctxDaveExtra = (): TenantContext => ({ utilisateurId: dave, coproprieteId: coproExtra, role: "PROPRIETAIRE" });
const ctxSyndicExtra = (): TenantContext => ({ utilisateurId: syndicA, coproprieteId: coproExtra, role: "SYNDIC" });

const HIER = () => new Date(Date.now() - 24 * 60 * 60 * 1000);
const DANS_20_JOURS = () => new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
const DANS_5_JOURS = () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  const [copro, coproNc, coproEx] = await Promise.all([
    admin.copropriete.create({
      data: {
        nom: "Résidence AG",
        adresse: "1 rue AG",
        ville: "Casablanca",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 3,
        totalTantiemes: "120.00",
        delaiConvocationJours: 15,
        quorumPremiereConvocation: "0.500",
        limiteProcurationsMandataire: 2,
      },
    }),
    admin.copropriete.create({
      data: {
        nom: "Résidence AG Non Configurée",
        adresse: "2 rue AG",
        ville: "Rabat",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 1,
      },
    }),
    admin.copropriete.create({
      data: {
        nom: "Résidence AG Extra",
        adresse: "3 rue AG",
        ville: "Fès",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 4,
        limiteProcurationsMandataire: 2,
      },
    }),
  ]);
  coproA = copro.id;
  coproNonConfiguree = coproNc.id;
  coproExtra = coproEx.id;

  const [us, ua, ub, uc, ud] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-ag@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-ag@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-ag@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "charlie-ag@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "dave-ag@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  bob = ub.id;
  charlie = uc.id;
  dave = ud.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: charlie, coproprieteId: coproA, role: "INDIVISAIRE" },
      { utilisateurId: dave, coproprieteId: coproA, role: "INDIVISAIRE" },
      { utilisateurId: syndicA, coproprieteId: coproExtra, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproExtra, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproExtra, role: "PROPRIETAIRE" },
      { utilisateurId: charlie, coproprieteId: coproExtra, role: "PROPRIETAIRE" },
      { utilisateurId: dave, coproprieteId: coproExtra, role: "PROPRIETAIRE" },
    ],
  });

  const [l1, l2, l3] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "AG1", tantiemes: "60.00" } }),
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "AG2", tantiemes: "40.00" } }),
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "AG3", tantiemes: "20.00" } }),
  ]);
  lotAlice = l1.id;
  lotBob = l2.id;
  lotIndivision = l3.id;

  await admin.lotProprietaire.createMany({
    data: [
      { lotId: lotAlice, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: lotBob, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: lotIndivision, utilisateurId: charlie, quotePart: "50.00", typePropriete: "INDIVISION", estRepresentantIndivision: false, dateDebut: new Date("2024-01-01") },
      { lotId: lotIndivision, utilisateurId: dave, quotePart: "50.00", typePropriete: "INDIVISION", estRepresentantIndivision: true, dateDebut: new Date("2024-01-01") },
    ],
  });
});

afterAll(async () => {
  const coproIds = [coproA, coproNonConfiguree, coproExtra];
  await admin.agNotificationLog.deleteMany({});
  await admin.agVote.deleteMany({});
  await admin.agProcuration.deleteMany({});
  await admin.agPv.deleteMany({});
  await admin.agResolution.deleteMany({});
  await admin.assembleeGenerale.deleteMany({ where: { coproprieteId: { in: coproIds } } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.appelDeFondsLot.deleteMany({ where: { lotId: lotIndivision } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lot: { coproprieteId: { in: coproIds } } } });
  await admin.lot.deleteMany({ where: { coproprieteId: { in: coproIds } } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: { in: coproIds } } });
  await admin.notification.deleteMany({ where: { coproprieteId: { in: coproIds } } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice, bob, charlie, dave] } } });
  await admin.copropriete.deleteMany({ where: { id: { in: coproIds } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Convocation (Master Spec Partie 8.2)", () => {
  it("convoque une AG dont le délai respecte copropriete.delaiConvocationJours", async () => {
    const ag = await creerAg(ctxSyndicA(), { type: "ORDINAIRE", date_ag: DANS_20_JOURS().toISOString() });
    const convoquee = await convoquerAg(ctxSyndicA(), ag.id);
    expect(convoquee.statut).toBe("CONVOQUEE");
  });

  it("écrit une notification dans la boîte de réception (M9) de chaque destinataire actif", async () => {
    const ag = await creerAg(ctxSyndicA(), { type: "ORDINAIRE", date_ag: DANS_20_JOURS().toISOString() });
    await convoquerAg(ctxSyndicA(), ag.id);
    const notifAlice = await admin.notification.findFirst({
      where: { utilisateurId: alice, templateCode: "AG_CONVOCATION", contenuJson: { path: ["ag_id"], equals: ag.id } },
    });
    expect(notifAlice?.statutEnvoi).toBe("ENVOYE");
    expect(notifAlice?.canal).toBe("EMAIL");
  });

  it("rejette la convocation si le délai est insuffisant", async () => {
    const ag = await creerAg(ctxSyndicA(), { type: "ORDINAIRE", date_ag: DANS_5_JOURS().toISOString() });
    await expect(convoquerAg(ctxSyndicA(), ag.id)).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("rejette la convocation si delai_convocation_jours n'est pas configuré (LEGAL_QUESTIONS_BRIEF.md §1)", async () => {
    const ctx: TenantContext = { utilisateurId: syndicA, coproprieteId: coproNonConfiguree, role: "SYNDIC" };
    const ag = await creerAg(ctx, { type: "ORDINAIRE", date_ag: DANS_20_JOURS().toISOString() });
    await expect(convoquerAg(ctx, ag.id)).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("un PROPRIETAIRE ne peut pas convoquer", async () => {
    const ag = await creerAg(ctxSyndicA(), { type: "ORDINAIRE", date_ag: DANS_20_JOURS().toISOString() });
    await expect(convoquerAg(ctxAlice(), ag.id)).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("Ouverture (Doc A §6.4)", () => {
  it("ouvre une AG convoquée dont la date est atteinte, quorum_requis pris du snapshot copropriete", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "CONVOQUEE" },
    });
    const ouverte = await ouvrirAg(ctxSyndicA(), ag.id);
    expect(ouverte.statut).toBe("EN_COURS");
    expect(ouverte.quorumRequis?.toString()).toBe("0.5");
  });

  it("rejette l'ouverture avant la date prévue", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: DANS_20_JOURS(), statut: "CONVOQUEE" },
    });
    await expect(ouvrirAg(ctxSyndicA(), ag.id)).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("rejette l'ouverture si quorum_premiere_convocation n'est pas configuré", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproNonConfiguree, type: "ORDINAIRE", dateAg: HIER(), statut: "CONVOQUEE" },
    });
    const ctx: TenantContext = { utilisateurId: syndicA, coproprieteId: coproNonConfiguree, role: "SYNDIC" };
    await expect(ouvrirAg(ctx, ag.id)).rejects.toBeInstanceOf(ContrainteMetierError);
  });
});

describe("Vote et majorité (Master Spec Partie 8.4) — tests critiques", () => {
  it("majorité SIMPLE : 60 tantièmes POUR contre 40 CONTRE → ADOPTEE", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, {
      ordre: 1,
      texte: "Approbation budget",
      type_majorite: "SIMPLE",
    });
    await voter(ctxAlice(), ag.id, { resolution_id: resolution.id, lot_id: lotAlice, valeur: "POUR" });
    await voter(ctxBob(), ag.id, { resolution_id: resolution.id, lot_id: lotBob, valeur: "CONTRE" });
    const finalisee = await finaliserResolution(ctxSyndicA(), ag.id, resolution.id);
    expect(finalisee.resultat).toBe("ADOPTEE");
  });

  it("TEST CRITIQUE — égalité parfaite 50/50 en tantièmes → REJETEE", async () => {
    // Utilise coproExtra (total_tantiemes non configuré) pour créer deux lots de tantièmes
    // strictement identiques sans heurter le trigger M3 de coproA (déjà à 120/120).
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproExtra, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicExtra(), ag.id, {
      ordre: 1,
      texte: "Résolution égalité",
      type_majorite: "SIMPLE",
    });
    const [lotX, lotY] = await Promise.all([
      admin.lot.create({ data: { coproprieteId: coproExtra, typeLot: "PARKING", numero: "EQ1", tantiemes: "20.00" } }),
      admin.lot.create({ data: { coproprieteId: coproExtra, typeLot: "PARKING", numero: "EQ2", tantiemes: "20.00" } }),
    ]);
    await admin.lotProprietaire.createMany({
      data: [
        { lotId: lotX.id, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
        { lotId: lotY.id, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      ],
    });
    await voter(ctxAliceExtra(), ag.id, { resolution_id: resolution.id, lot_id: lotX.id, valeur: "POUR" });
    await voter(ctxBobExtra(), ag.id, { resolution_id: resolution.id, lot_id: lotY.id, valeur: "CONTRE" });
    const finalisee = await finaliserResolution(ctxSyndicExtra(), ag.id, resolution.id);
    expect(finalisee.resultat).toBe("REJETEE");
  });

  it("majorité DOUBLE : rejetée si la majorité en nombre et en tantièmes ne concordent pas", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, {
      ordre: 1,
      texte: "Travaux d'amélioration",
      type_majorite: "DOUBLE",
    });
    // Alice (60 tantièmes, 1 lot) vote POUR ; Bob (40 tantièmes, 1 lot) vote CONTRE.
    // Majorité en tantièmes : POUR (60>40). Majorité en nombre : 1 POUR vs 1 CONTRE → égalité en
    // nombre, pas de majorité stricte en nombre → DOUBLE majorité non atteinte → REJETEE.
    await voter(ctxAlice(), ag.id, { resolution_id: resolution.id, lot_id: lotAlice, valeur: "POUR" });
    await voter(ctxBob(), ag.id, { resolution_id: resolution.id, lot_id: lotBob, valeur: "CONTRE" });
    const finalisee = await finaliserResolution(ctxSyndicA(), ag.id, resolution.id);
    expect(finalisee.resultat).toBe("REJETEE");
  });

  it("majorité UNANIMITE : adoptée seulement si 100% des tantièmes de la copropriété votent POUR", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, {
      ordre: 1,
      texte: "Aliénation partie commune",
      type_majorite: "UNANIMITE",
    });
    await voter(ctxAlice(), ag.id, { resolution_id: resolution.id, lot_id: lotAlice, valeur: "POUR" });
    let finalisee = await finaliserResolution(ctxSyndicA(), ag.id, resolution.id);
    expect(finalisee.resultat).toBe("REJETEE"); // 60/100 seulement

    const resolution2 = await creerResolution(ctxSyndicA(), ag.id, {
      ordre: 2,
      texte: "Aliénation partie commune (2)",
      type_majorite: "UNANIMITE",
    });
    await voter(ctxAlice(), ag.id, { resolution_id: resolution2.id, lot_id: lotAlice, valeur: "POUR" });
    await voter(ctxBob(), ag.id, { resolution_id: resolution2.id, lot_id: lotBob, valeur: "POUR" });
    await voter(ctxDave(), ag.id, { resolution_id: resolution2.id, lot_id: lotIndivision, valeur: "POUR" });
    finalisee = await finaliserResolution(ctxSyndicA(), ag.id, resolution2.id);
    expect(finalisee.resultat).toBe("ADOPTEE"); // 120/120 (total_tantiemes de coproA)
  });

  it("un lot ne peut voter deux fois pour la même résolution", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, { ordre: 1, texte: "R", type_majorite: "SIMPLE" });
    await voter(ctxAlice(), ag.id, { resolution_id: resolution.id, lot_id: lotAlice, valeur: "POUR" });
    await expect(
      voter(ctxAlice(), ag.id, { resolution_id: resolution.id, lot_id: lotAlice, valeur: "CONTRE" })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });
});

describe("Indivision (Doc A §2.4) — test critique blocage impayé", () => {
  it("seul le représentant désigné de l'indivision peut voter pour le lot", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, { ordre: 1, texte: "R", type_majorite: "SIMPLE" });
    await expect(
      voter(ctxCharlie(), ag.id, { resolution_id: resolution.id, lot_id: lotIndivision, valeur: "POUR" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
    const vote = await voter(ctxDave(), ag.id, { resolution_id: resolution.id, lot_id: lotIndivision, valeur: "POUR" });
    expect(vote.utilisateurId).toBe(dave);
  });

  it("TEST CRITIQUE — le vote de l'indivisaire est bloqué si le lot a un impayé", async () => {
    const appelDeFonds = await admin.appelDeFonds.create({
      data: {
        coproprieteId: coproA,
        periode: "2026-01",
        type: "CHARGES_COURANTES",
        montantTotal: "100.00",
        dateEcheance: new Date("2026-01-31"),
        statut: "EMIS",
      },
    });
    await admin.appelDeFondsLot.create({
      data: { appelDeFondsId: appelDeFonds.id, lotId: lotIndivision, montantDu: "50.00", statut: "IMPAYE" },
    });

    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, { ordre: 1, texte: "R", type_majorite: "SIMPLE" });
    await expect(
      voter(ctxDave(), ag.id, { resolution_id: resolution.id, lot_id: lotIndivision, valeur: "POUR" })
    ).rejects.toBeInstanceOf(ContrainteMetierError);

    // Nettoyage immédiat : l'impayé simulé ici ne doit pas polluer les tests suivants qui font
    // aussi voter le représentant de l'indivision (UNANIMITE, clôture/quorum).
    await admin.appelDeFondsLot.deleteMany({ where: { appelDeFondsId: appelDeFonds.id } });
    await admin.appelDeFonds.delete({ where: { id: appelDeFonds.id } });
  });
});

describe("Anonymisation des résultats (Doc A §12.3) — test critique", () => {
  it("un résident obtient les résultats agrégés mais pas le détail nominatif ; le syndic voit le détail", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, { ordre: 1, texte: "R", type_majorite: "SIMPLE" });
    await voter(ctxAlice(), ag.id, { resolution_id: resolution.id, lot_id: lotAlice, valeur: "POUR" });
    await voter(ctxBob(), ag.id, { resolution_id: resolution.id, lot_id: lotBob, valeur: "CONTRE" });

    const resultatsAlice = await obtenirResultatsResolution(ctxAlice(), resolution.id);
    const tallyPour = resultatsAlice.find((r) => r.valeur === "POUR");
    // $queryRaw désérialise les numeric Postgres en Decimal.js — comparaison via .toString().
    expect(tallyPour?.tantiemes_total.toString()).toBe("60");

    await expect(listerVotesNominatifs(ctxAlice(), resolution.id)).rejects.toBeInstanceOf(
      PermissionRefuseeError
    );
    const nominatifs = await listerVotesNominatifs(ctxSyndicA(), resolution.id);
    expect(nominatifs.map((v) => v.utilisateurId).sort()).toEqual([alice, bob].sort());
  });
});

describe("Procurations (Doc A §6.5)", () => {
  it("un mandataire vote au nom du mandant avec les tantièmes du lot du mandant", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    const procuration = await creerProcuration(ctxAlice(), ag.id, { lot_id: lotAlice, mandataire_id: bob });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, { ordre: 1, texte: "R", type_majorite: "SIMPLE" });
    const vote = await voter(ctxBob(), ag.id, {
      resolution_id: resolution.id,
      procuration_id: procuration.id,
      valeur: "POUR",
    });
    expect(vote.lotId).toBe(lotAlice);
    expect(vote.utilisateurId).toBe(bob);
    expect(vote.tantiemesRepresentes.toString()).toBe("60");
  });

  it("rejette la procuration au-delà de la limite légale configurée", async () => {
    // coproExtra (total_tantiemes non configuré) pour créer librement des lots supplémentaires.
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproExtra, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS" },
    });
    // limite = 2 (copropriete.limiteProcurationsMandataire) — 2 mandants distincts vers bob, la 3e doit échouer.
    const [lotAliceExtra, lotMandant3, lotMandant4] = await Promise.all([
      admin.lot.create({ data: { coproprieteId: coproExtra, typeLot: "PARKING", numero: "MAND1", tantiemes: "1.00" } }),
      admin.lot.create({ data: { coproprieteId: coproExtra, typeLot: "PARKING", numero: "MAND3", tantiemes: "1.00" } }),
      admin.lot.create({ data: { coproprieteId: coproExtra, typeLot: "PARKING", numero: "MAND4", tantiemes: "1.00" } }),
    ]);
    await admin.lotProprietaire.createMany({
      data: [
        { lotId: lotAliceExtra.id, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
        { lotId: lotMandant3.id, utilisateurId: charlie, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
        { lotId: lotMandant4.id, utilisateurId: dave, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      ],
    });
    await creerProcuration(ctxAliceExtra(), ag.id, { lot_id: lotAliceExtra.id, mandataire_id: bob });
    await creerProcuration(ctxCharlieExtra(), ag.id, { lot_id: lotMandant3.id, mandataire_id: bob });
    await expect(
      creerProcuration(ctxDaveExtra(), ag.id, { lot_id: lotMandant4.id, mandataire_id: bob })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
    // Nettoyage laissé à afterAll (lotMandant3 porte désormais une ag_procuration active).
  });
});

describe("Clôture et PV (Master Spec Partie 8.6)", () => {
  it("bloque la clôture s'il reste des résolutions EN_ATTENTE", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS", quorumRequis: "0.500" },
    });
    await creerResolution(ctxSyndicA(), ag.id, { ordre: 1, texte: "R", type_majorite: "SIMPLE" });
    await expect(cloturerAg(ctxSyndicA(), ag.id)).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("clôture, calcule le quorum atteint et génère un PV avec hash d'intégrité", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "EN_COURS", quorumRequis: "0.500" },
    });
    const resolution = await creerResolution(ctxSyndicA(), ag.id, { ordre: 1, texte: "R", type_majorite: "SIMPLE" });
    await voter(ctxAlice(), ag.id, { resolution_id: resolution.id, lot_id: lotAlice, valeur: "POUR" });
    await voter(ctxBob(), ag.id, { resolution_id: resolution.id, lot_id: lotBob, valeur: "CONTRE" });
    await voter(ctxDave(), ag.id, { resolution_id: resolution.id, lot_id: lotIndivision, valeur: "ABSTENTION" });
    await finaliserResolution(ctxSyndicA(), ag.id, resolution.id);

    const { ag: cloturee, pv } = await cloturerAg(ctxSyndicA(), ag.id);
    expect(cloturee.statut).toBe("CLOTUREE");
    // 60 + 40 + 20 = 120 tantièmes ont voté (POUR/CONTRE/ABSTENTION comptent tous pour le quorum,
    // Master Spec Partie 8.3) sur un total_tantiemes de 120 configuré sur coproA → 1.
    expect(cloturee.quorumAtteint?.toString()).toBe("1");
    expect(pv.hashIntegrite).toHaveLength(64); // sha256 hex
  });
});

describe("Annulation (Doc A §12.2)", () => {
  it("annule une AG avec motif obligatoire", async () => {
    const ag = await creerAg(ctxSyndicA(), { type: "ORDINAIRE", date_ag: DANS_20_JOURS().toISOString() });
    const annulee = await annulerAg(ctxSyndicA(), ag.id, "Décès du syndic.");
    expect(annulee.statut).toBe("ANNULEE");
    expect(annulee.motifAnnulation).toBe("Décès du syndic.");
  });

  it("rejette l'annulation d'une AG déjà clôturée", async () => {
    const ag = await admin.assembleeGenerale.create({
      data: { coproprieteId: coproA, type: "ORDINAIRE", dateAg: HIER(), statut: "CLOTUREE" },
    });
    await expect(annulerAg(ctxSyndicA(), ag.id, "motif")).rejects.toBeInstanceOf(ContrainteMetierError);
  });
});
