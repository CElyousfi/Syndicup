/**
 * Tests M8 (ROADMAP_BACKLOG.md) : parties communes — Master Spec Partie 2.2/9.4, Doc A §7.
 * Prérequis : Supabase local démarré + migration `20260823160000_m8_parties_communes`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerEspaceCommun,
  creerReservation,
  validerReservation,
  rejeterReservation,
  annulerReservation,
  PermissionRefuseeError,
  ContrainteMetierError,
} from "../lib/espaces-communs/espaces-communs";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let alice: string;
let bob: string;
let lotAlice: string;

const ctxSyndicA = (): TenantContext => ({ utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" });
const ctxAlice = (): TenantContext => ({ utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" });
const ctxBob = (): TenantContext => ({ utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" });

const DEMAIN_10H = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const DEMAIN_12H = () => new Date(DEMAIN_10H().getTime() + 2 * 60 * 60 * 1000);
const DEMAIN_11H = () => new Date(DEMAIN_10H().getTime() + 1 * 60 * 60 * 1000);
const DEMAIN_13H = () => new Date(DEMAIN_10H().getTime() + 3 * 60 * 60 * 1000);

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Espaces Communs",
      adresse: "1 rue Commune",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 2,
    },
  });
  coproA = copro.id;

  const [us, ua, ub] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-ec@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-ec@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-ec@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  bob = ub.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" },
    ],
  });

  const lot = await admin.lot.create({
    data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "EC1", tantiemes: "100.00" },
  });
  lotAlice = lot.id;
  await admin.lotProprietaire.create({
    data: { lotId: lotAlice, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  });
});

afterAll(async () => {
  await admin.reservationEspaceCommun.deleteMany({ where: { espace: { coproprieteId: coproA } } });
  await admin.espaceCommun.deleteMany({ where: { coproprieteId: coproA } });
  // Les demandes EN_ATTENTE notifient le syndic (temps réel) — nettoyer avant la copropriété.
  await admin.notification.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: lotAlice } });
  await admin.lot.deleteMany({ where: { id: lotAlice } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice, bob] } } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.copropriete.deleteMany({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Création d'espace commun (syndic only)", () => {
  it("un PROPRIETAIRE ne peut pas créer un espace commun", async () => {
    await expect(
      creerEspaceCommun(ctxAlice(), { nom: "Salle", type: "SALLE_POLYVALENTE" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("Réservation — validation manuelle (Doc A §7.2)", () => {
  it("une réservation sur un espace en validation manuelle démarre EN_ATTENTE", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle polyvalente",
      type: "SALLE_POLYVALENTE",
      reservable: true,
      validation_automatique: false,
    });
    const reservation = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    expect(reservation.statut).toBe("EN_ATTENTE");
  });

  it("un PROPRIETAIRE ne peut pas réserver pour un lot dont il n'est pas propriétaire/occupant", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 2",
      type: "SALLE_POLYVALENTE",
      reservable: true,
    });
    await expect(
      creerReservation(ctxBob(), {
        espace_id: espace.id,
        lot_id: lotAlice,
        date_debut: DEMAIN_10H().toISOString(),
        date_fin: DEMAIN_12H().toISOString(),
      })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("le syndic peut valider une réservation EN_ATTENTE", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 3",
      type: "SALLE_POLYVALENTE",
      reservable: true,
    });
    const reservation = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    const validee = await validerReservation(ctxSyndicA(), reservation.id);
    expect(validee.statut).toBe("CONFIRMEE");
  });

  it("le syndic peut rejeter une réservation avec motif", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 4",
      type: "SALLE_POLYVALENTE",
      reservable: true,
    });
    const reservation = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    const rejetee = await rejeterReservation(ctxSyndicA(), reservation.id, "Espace en travaux.");
    expect(rejetee.statut).toBe("REJETEE");
    expect(rejetee.motifRejet).toBe("Espace en travaux.");
  });
});

describe("Détection de conflit de créneau (Doc A §7.2)", () => {
  it("rejette une réservation qui chevauche une réservation EN_ATTENTE/CONFIRMEE existante", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 5",
      type: "SALLE_POLYVALENTE",
      reservable: true,
    });
    await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    await expect(
      creerReservation(ctxAlice(), {
        espace_id: espace.id,
        lot_id: lotAlice,
        date_debut: DEMAIN_11H().toISOString(),
        date_fin: DEMAIN_13H().toISOString(),
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("une réservation ANNULEE ne bloque plus le créneau", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 6",
      type: "SALLE_POLYVALENTE",
      reservable: true,
    });
    const reservation = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    await annulerReservation(ctxAlice(), reservation.id);
    const nouvelle = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    expect(nouvelle.id).toBeTruthy();
  });
});

describe("Annulation (Master Spec Partie 3.2)", () => {
  it("un résident ne peut pas annuler la réservation d'un autre résident", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 7",
      type: "SALLE_POLYVALENTE",
      reservable: true,
    });
    const reservation = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    await expect(annulerReservation(ctxBob(), reservation.id)).rejects.toBeInstanceOf(
      PermissionRefuseeError
    );
  });

  it("le syndic peut annuler n'importe quelle réservation", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 8",
      type: "SALLE_POLYVALENTE",
      reservable: true,
    });
    const reservation = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    const annulee = await annulerReservation(ctxSyndicA(), reservation.id);
    expect(annulee.statut).toBe("ANNULEE");
  });
});

describe("Validation automatique (Doc A §7.2)", () => {
  it("une réservation sur un espace en validation automatique démarre CONFIRMEE", async () => {
    const espace = await creerEspaceCommun(ctxSyndicA(), {
      nom: "Salle 9",
      type: "SALLE_POLYVALENTE",
      reservable: true,
      validation_automatique: true,
    });
    const reservation = await creerReservation(ctxAlice(), {
      espace_id: espace.id,
      lot_id: lotAlice,
      date_debut: DEMAIN_10H().toISOString(),
      date_fin: DEMAIN_12H().toISOString(),
    });
    expect(reservation.statut).toBe("CONFIRMEE");
  });
});
