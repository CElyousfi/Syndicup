/**
 * Modifications & suppressions des données de référence (espaces communs, prestataires,
 * invitations, lots, documents) — le cas nominal et la règle de garde de chacun : une donnée
 * qui a une histoire ne se supprime pas (409 ContrainteMetierError), elle se désactive.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerEspaceCommun,
  modifierEspaceCommun,
  supprimerEspaceCommun,
  creerReservation,
  ContrainteMetierError as EspaceContrainteError,
  PermissionRefuseeError as EspacePermissionError,
} from "../lib/espaces-communs/espaces-communs";
import {
  creerPrestataire,
  modifierPrestataire,
  supprimerPrestataire,
  creerIncident,
  assignerIncident,
  ContrainteMetierError as PrestataireContrainteError,
} from "../lib/incidents/incidents";
import {
  creerInvitation,
  annulerInvitation,
  InvitationDejaAccepteeError,
  PermissionRefuseeError as InvitationPermissionError,
} from "../lib/auth/invitations";
import { supprimerLot, ContrainteMetierError as LotContrainteError } from "../lib/lots/lots";
import { supprimerDocument, ContrainteMetierError as DocContrainteError } from "../lib/documents/documents";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproA: string;
let syndicA: string;
let alice: string;
let lotAlice: string;

const ctxSyndicA = (): TenantContext => ({ utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" });
const ctxAlice = (): TenantContext => ({ utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" });

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Modif-Suppr",
      adresse: "2 rue des Tests",
      ville: "Rabat",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 2,
    },
  });
  coproA = copro.id;
  const [us, ua] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-ms@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-ms@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
    ],
  });
  const lot = await admin.lot.create({
    data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "MS1", tantiemes: "100.00" },
  });
  lotAlice = lot.id;
  await admin.lotProprietaire.create({
    data: { lotId: lotAlice, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  });
});

afterAll(async () => {
  await admin.reservationEspaceCommun.deleteMany({ where: { espace: { coproprieteId: coproA } } });
  await admin.espaceCommun.deleteMany({ where: { coproprieteId: coproA } });
  await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: coproA } } });
  await admin.incident.deleteMany({ where: { coproprieteId: coproA } });
  await admin.prestataire.deleteMany({ where: { coproprieteId: coproA } });
  await admin.invitation.deleteMany({ where: { coproprieteId: coproA } });
  await admin.document.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lot: { coproprieteId: coproA } } });
  await admin.lot.deleteMany({ where: { coproprieteId: coproA } });
  await admin.notification.deleteMany({ where: { coproprieteId: coproA } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice] } } });
  await admin.copropriete.deleteMany({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Espaces communs — modification et suppression", () => {
  it("le syndic modifie un espace (nom, capacité, réservable) et l'audit est écrit", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), { nom: "Salle A", type: "salle", capacite: 20 });
    const maj = await modifierEspaceCommun(ctxSyndicA(), espace.id, { nom: "Salle des fêtes", capacite: 40, reservable: false });
    expect(maj.nom).toBe("Salle des fêtes");
    expect(maj.capacite).toBe(40);
    expect(maj.reservable).toBe(false);
    const audit = await admin.auditLog.findFirst({ where: { entiteId: espace.id, action: "ESPACE_COMMUN_MODIFIE" } });
    expect(audit).not.toBeNull();
  });

  it("un PROPRIETAIRE ne peut ni modifier ni supprimer un espace", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), { nom: "Piscine", type: "piscine" });
    await expect(modifierEspaceCommun(ctxAlice(), espace.id, { nom: "X" })).rejects.toBeInstanceOf(EspacePermissionError);
    await expect(supprimerEspaceCommun(ctxAlice(), espace.id)).rejects.toBeInstanceOf(EspacePermissionError);
  });

  it("supprime un espace sans réservation, refuse (409) dès qu'une réservation existe", async () => {
    const vide = await creerEspaceCommun(ctxSyndicA(), { nom: "Terrain", type: "sport" });
    await supprimerEspaceCommun(ctxSyndicA(), vide.id);
    expect(await admin.espaceCommun.findUnique({ where: { id: vide.id } })).toBeNull();

    const reserve = await creerEspaceCommun(ctxSyndicA(), { nom: "Salle B", type: "salle", reservable: true, validation_automatique: true });
    const debut = new Date(Date.now() + 48 * 3600 * 1000);
    await creerReservation(ctxAlice(), {
      espace_id: reserve.id,
      lot_id: lotAlice,
      date_debut: debut.toISOString(),
      date_fin: new Date(debut.getTime() + 3600 * 1000).toISOString(),
    });
    await expect(supprimerEspaceCommun(ctxSyndicA(), reserve.id)).rejects.toBeInstanceOf(EspaceContrainteError);
    expect(await admin.espaceCommun.findUnique({ where: { id: reserve.id } })).not.toBeNull();
  });
});

describe("Prestataires — modification et suppression", () => {
  it("modifie la fiche et désactive ; supprime sans historique ; refuse avec interventions", async () => {
    const p = await creerPrestataire(ctxSyndicA(), { nom: "Plomb SARL", specialite: "plomberie", contact: "0600000000" });
    const maj = await modifierPrestataire(ctxSyndicA(), p.id, { contact: "0611111111", actif: false });
    expect(maj.contact).toBe("0611111111");
    expect(maj.actif).toBe(false);

    const libre = await creerPrestataire(ctxSyndicA(), { nom: "Elec SARL", specialite: "electricite", contact: "0622222222" });
    await supprimerPrestataire(ctxSyndicA(), libre.id);
    expect(await admin.prestataire.findUnique({ where: { id: libre.id } })).toBeNull();

    const incident = await creerIncident(ctxSyndicA(), {
      categorie: "PLOMBERIE",
      sous_categorie: "fuite",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    await modifierPrestataire(ctxSyndicA(), p.id, { actif: true });
    await assignerIncident(ctxSyndicA(), incident.id, p.id);
    await expect(supprimerPrestataire(ctxSyndicA(), p.id)).rejects.toBeInstanceOf(PrestataireContrainteError);
  });
});

describe("Invitations — annulation", () => {
  it("annule une invitation EN_ATTENTE (→ EXPIREE) et refuse une seconde annulation", async () => {
    const inv = await creerInvitation(ctxSyndicA(), { role_cible: "GARDIEN", canal: "QR_CODE" });
    const annulee = await annulerInvitation(ctxSyndicA(), inv.id);
    expect(annulee.statut).toBe("EXPIREE");
    await expect(annulerInvitation(ctxSyndicA(), inv.id)).rejects.toBeInstanceOf(InvitationDejaAccepteeError);
  });

  it("un PROPRIETAIRE ne peut pas annuler une invitation", async () => {
    const inv = await creerInvitation(ctxSyndicA(), { role_cible: "GARDIEN", canal: "QR_CODE" });
    await expect(annulerInvitation(ctxAlice(), inv.id)).rejects.toBeInstanceOf(InvitationPermissionError);
  });
});

describe("Lots — suppression gardée", () => {
  it("supprime un lot vierge, refuse un lot avec propriétaire", async () => {
    const vierge = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "CAVE", numero: "MS-C1", tantiemes: "5.00" },
    });
    await supprimerLot(ctxSyndicA(), vierge.id);
    expect(await admin.lot.findUnique({ where: { id: vierge.id } })).toBeNull();
    await expect(supprimerLot(ctxSyndicA(), lotAlice)).rejects.toBeInstanceOf(LotContrainteError);
  });
});

describe("Documents — suppression", () => {
  it("refuse (409) la suppression d'un document généré par la plateforme (PV)", async () => {
    const pv = await admin.document.create({
      data: {
        coproprieteId: coproA,
        type: "PV_AG",
        nom: "PV AG 2026",
        visibilite: "PUBLIC_COPROPRIETE",
        storagePath: `${coproA}/pv/ag-2026.pdf`,
      },
    });
    await expect(supprimerDocument(ctxSyndicA(), pv.id)).rejects.toBeInstanceOf(DocContrainteError);
    expect(await admin.document.findUnique({ where: { id: pv.id } })).not.toBeNull();
  });
});
