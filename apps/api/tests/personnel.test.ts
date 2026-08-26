/**
 * Tests M10 (ROADMAP_BACKLOG.md) : personnel gardien & visites — Master Spec Partie 13.3,
 * Doc A §9. Prérequis : Supabase local démarré + migration `20260824120000_m10_personnel_visites`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerPersonnel,
  listerPersonnel,
  changerStatutPersonnel,
  creerVisite,
  listerVisites,
  changerStatutVisite,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../lib/personnel/personnel";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let gardienA: string;
let alice: string;
let bob: string;
let lotAlice: string;
let lotBob: string;
let logeGardien: string;

const ctxSyndicA = (): TenantContext => ({ utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" });
const ctxGardienA = (): TenantContext => ({ utilisateurId: gardienA, coproprieteId: coproA, role: "GARDIEN" });
const ctxAlice = (): TenantContext => ({ utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" });
const ctxBob = (): TenantContext => ({ utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" });

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Personnel",
      adresse: "1 rue du Gardien",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 3,
    },
  });
  coproA = copro.id;

  const [us, ug, ua, ub] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-perso@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "gardien-perso@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-perso@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-perso@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  gardienA = ug.id;
  alice = ua.id;
  bob = ub.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: gardienA, coproprieteId: coproA, role: "GARDIEN" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" },
    ],
  });

  const [la, lb, loge] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "P1", tantiemes: "50.00" } }),
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "P2", tantiemes: "40.00" } }),
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "LOGE_GARDIEN", numero: "LG", tantiemes: "10.00" } }),
  ]);
  lotAlice = la.id;
  lotBob = lb.id;
  logeGardien = loge.id;
  await admin.lotProprietaire.createMany({
    data: [
      { lotId: lotAlice, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: lotBob, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    ],
  });
});

afterAll(async () => {
  await admin.notification.deleteMany({ where: { coproprieteId: coproA } });
  await admin.visite.deleteMany({ where: { coproprieteId: coproA } });
  await admin.personnel.deleteMany({ where: { coproprieteId: coproA } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: [lotAlice, lotBob] } } });
  await admin.lot.deleteMany({ where: { coproprieteId: coproA } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, gardienA, alice, bob] } } });
  await admin.copropriete.deleteMany({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Fiche personnel (Doc A §9.2)", () => {
  it("refuse une fiche pour un utilisateur sans rôle GARDIEN actif", async () => {
    await expect(
      creerPersonnel(ctxSyndicA(), { utilisateur_id: alice })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("refuse un logement de fonction qui n'est pas de type LOGE_GARDIEN", async () => {
    await expect(
      creerPersonnel(ctxSyndicA(), { utilisateur_id: gardienA, logement_lot_id: lotAlice })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("un PROPRIETAIRE ne peut pas créer de fiche personnel", async () => {
    await expect(
      creerPersonnel(ctxAlice(), { utilisateur_id: gardienA })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("le syndic crée la fiche du gardien avec sa loge, refuse le doublon, et tout le monde la lit", async () => {
    const fiche = await creerPersonnel(ctxSyndicA(), {
      utilisateur_id: gardienA,
      logement_lot_id: logeGardien,
    });
    expect(fiche.statut).toBe("PRESENT");
    expect(fiche.logementLotId).toBe(logeGardien);

    await expect(
      creerPersonnel(ctxSyndicA(), { utilisateur_id: gardienA })
    ).rejects.toBeInstanceOf(ContrainteMetierError);

    const vueAlice = await listerPersonnel(ctxAlice());
    expect(vueAlice.map((p) => p.id)).toContain(fiche.id);
  });

  it("le syndic marque le gardien ABSENT (Doc A §9.2 'Gardien absent')", async () => {
    const [fiche] = await listerPersonnel(ctxSyndicA());
    expect(fiche).toBeDefined();
    const updated = await changerStatutPersonnel(ctxSyndicA(), fiche!.id, { statut: "ABSENT" });
    expect(updated.statut).toBe("ABSENT");
  });
});

describe("Visites — workflow Doc A §9.2", () => {
  it("un PROPRIETAIRE ne peut pas enregistrer une visite", async () => {
    await expect(
      creerVisite(ctxAlice(), { lot_id: lotAlice, visiteur_nom: "Cousin" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("le gardien enregistre une visite → notification PUSH au résident du lot", async () => {
    const visite = await creerVisite(ctxGardienA(), { lot_id: lotAlice, visiteur_nom: "M. Plombier" });
    expect(visite.statut).toBe("EN_ATTENTE");
    const notif = await admin.notification.findFirst({
      where: { utilisateurId: alice, templateCode: "VISITE_NOUVELLE", contenuJson: { path: ["visite_id"], equals: visite.id } },
    });
    expect(notif?.canal).toBe("PUSH");
    expect(notif?.statutEnvoi).toBe("EN_ATTENTE");
  });

  it("un résident ne voit que les visites de ses propres lots (RLS Doc A §12.3)", async () => {
    const visiteBob = await creerVisite(ctxGardienA(), { lot_id: lotBob, visiteur_nom: "Livreur" });
    const vueAlice = await listerVisites(ctxAlice());
    expect(vueAlice.map((v) => v.id)).not.toContain(visiteBob.id);
    const vueBob = await listerVisites(ctxBob());
    expect(vueBob.map((v) => v.id)).toContain(visiteBob.id);
  });

  it("le résident autorise sa visite → le gardien reçoit la réponse ; double réponse refusée", async () => {
    const visite = await creerVisite(ctxGardienA(), { lot_id: lotAlice, visiteur_nom: "Mme Visite" });
    const autorisee = await changerStatutVisite(ctxAlice(), visite.id, { statut: "AUTORISE" });
    expect(autorisee.statut).toBe("AUTORISE");
    const notifGardien = await admin.notification.findFirst({
      where: { utilisateurId: gardienA, templateCode: "VISITE_REPONSE", contenuJson: { path: ["visite_id"], equals: visite.id } },
    });
    expect(notifGardien?.statutEnvoi).toBe("EN_ATTENTE");
    await expect(
      changerStatutVisite(ctxAlice(), visite.id, { statut: "REFUSE" })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("un résident ne peut pas répondre à la visite d'un autre lot (RLS → 404 anti-énumération)", async () => {
    const visite = await creerVisite(ctxGardienA(), { lot_id: lotBob, visiteur_nom: "Inconnu" });
    // La policy RLS sur `visite` cache la ligne à Alice avant même le check applicatif :
    // IntrouvableError (404), pas PermissionRefuseeError — on ne révèle pas l'existence de la
    // visite d'un autre lot (Doc A §12.3).
    await expect(
      changerStatutVisite(ctxAlice(), visite.id, { statut: "AUTORISE" })
    ).rejects.toBeInstanceOf(IntrouvableError);
  });

  it("le syndic ne répond pas à la place du résident (matrice personnel.autoriser_visiteur)", async () => {
    const visite = await creerVisite(ctxGardienA(), { lot_id: lotBob, visiteur_nom: "Autre" });
    await expect(
      changerStatutVisite(ctxSyndicA(), visite.id, { statut: "AUTORISE" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("le gardien peut clôturer en REFUSE sa propre visite enregistrée (relai)", async () => {
    const visite = await creerVisite(ctxGardienA(), { lot_id: lotAlice, visiteur_nom: "Refusé" });
    const refusee = await changerStatutVisite(ctxGardienA(), visite.id, { statut: "REFUSE" });
    expect(refusee.statut).toBe("REFUSE");
  });
});
