/**
 * Tests M7 (ROADMAP_BACKLOG.md) : confidentialité RLS sur `incident`/`incident_log`/`prestataire`
 * (Master Spec Partie 4.2, Doc A §12.3), workflow assignation/changement de statut, et
 * validation Zod des payloads.
 *
 * Prérequis : Supabase local démarré + migration `20260819150000_m7_incidents` appliquée + rôle
 * app_local créé (npm run setup:local-role --workspace=@copropriete-maroc/database).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerIncident,
  listerIncidents,
  changerStatutIncident,
  assignerIncident,
  creerPrestataire,
  PermissionRefuseeError,
  IncidentIntrouvableError,
  PrestataireIntrouvableError,
} from "../lib/incidents/incidents";
import { incidentCreateSchema, prestataireCreateSchema } from "../lib/incidents/schemas";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let alice: string; // PROPRIETAIRE, crée un incident
let bob: string; // PROPRIETAIRE, crée un autre incident
let gardienA: string;
let prestaUtilisateur: string; // compte applicatif du prestataire assigné
let autrePrestaUtilisateur: string; // compte d'un AUTRE prestataire (non assigné)

let lotA1: string;
let prestataireId: string;
let autrePrestataireId: string;

const ctxSyndicA = (): TenantContext => ({
  utilisateurId: syndicA,
  coproprieteId: coproA,
  role: "SYNDIC",
});
const ctxAlice = (): TenantContext => ({
  utilisateurId: alice,
  coproprieteId: coproA,
  role: "PROPRIETAIRE",
});
const ctxBob = (): TenantContext => ({
  utilisateurId: bob,
  coproprieteId: coproA,
  role: "PROPRIETAIRE",
});
const ctxGardienA = (): TenantContext => ({
  utilisateurId: gardienA,
  coproprieteId: coproA,
  role: "GARDIEN",
});
const ctxPresta = (): TenantContext => ({
  utilisateurId: prestaUtilisateur,
  coproprieteId: coproA,
  role: "PRESTATAIRE",
});
const ctxAutrePresta = (): TenantContext => ({
  utilisateurId: autrePrestaUtilisateur,
  coproprieteId: coproA,
  role: "PRESTATAIRE",
});

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Incidents",
      adresse: "1 rue Incidents",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 5,
    },
  });
  coproA = copro.id;

  const [us, ua, ub, ug, up, uap] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-inc@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-inc@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-inc@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "gardien-inc@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "presta-inc@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "autre-presta-inc@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  bob = ub.id;
  gardienA = ug.id;
  prestaUtilisateur = up.id;
  autrePrestaUtilisateur = uap.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: gardienA, coproprieteId: coproA, role: "GARDIEN" },
      { utilisateurId: prestaUtilisateur, coproprieteId: coproA, role: "PRESTATAIRE" },
      { utilisateurId: autrePrestaUtilisateur, coproprieteId: coproA, role: "PRESTATAIRE" },
    ],
  });

  const lot = await admin.lot.create({
    data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "100.00" },
  });
  lotA1 = lot.id;
  await admin.lotProprietaire.create({
    data: {
      lotId: lotA1,
      utilisateurId: alice,
      quotePart: "100.00",
      typePropriete: "PLEIN",
      dateDebut: new Date("2024-01-01"),
    },
  });

  const [presta, autrePresta] = await Promise.all([
    admin.prestataire.create({
      data: {
        coproprieteId: coproA,
        nom: "Plombier Rapide",
        specialite: "Plomberie",
        contact: "0600000000",
        utilisateurId: prestaUtilisateur,
      },
    }),
    admin.prestataire.create({
      data: {
        coproprieteId: coproA,
        nom: "Ascenseur Pro",
        specialite: "Ascenseur",
        contact: "0611111111",
        utilisateurId: autrePrestaUtilisateur,
      },
    }),
  ]);
  prestataireId = presta.id;
  autrePrestataireId = autrePresta.id;
});

afterAll(async () => {
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.incidentLog.deleteMany({});
  await admin.incident.deleteMany({ where: { coproprieteId: coproA } });
  await admin.prestataire.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: lotA1 } });
  await admin.lot.deleteMany({ where: { id: lotA1 } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.notification.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({
    where: { id: { in: [syndicA, alice, bob, gardienA, prestaUtilisateur, autrePrestaUtilisateur] } },
  });
  await admin.copropriete.deleteMany({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Création d'incident et calcul du SLA (Doc A §5)", () => {
  it("un PROPRIETAIRE peut créer un incident sur son lot, SLA calculé selon l'urgence", async () => {
    const incident = await creerIncident(ctxAlice(), {
      lot_id: lotA1,
      categorie: "PLOMBERIE",
      sous_categorie: "Fuite eau",
      description: "Fuite sous l'évier.",
      partie: "PRIVATIVE",
      urgence: "URGENTE",
    });
    expect(incident.statut).toBe("OUVERT");
    expect(incident.slaDeadline).toBeTruthy();
    const deltaHeures =
      (incident.slaDeadline!.getTime() - incident.creeLe.getTime()) / (1000 * 60 * 60);
    expect(deltaHeures).toBeCloseTo(4, 1);
  });

  it("un incident URGENCE_MAXIMALE a un SLA de 30 minutes", async () => {
    const incident = await creerIncident(ctxSyndicA(), {
      lot_id: null,
      categorie: "ASCENSEUR",
      sous_categorie: "Ascenseur bloqué",
      partie: "COMMUNE",
      urgence: "URGENCE_MAXIMALE",
    });
    const [notifSyndic, notifGardien] = await Promise.all([
      admin.notification.findFirst({
        where: { utilisateurId: syndicA, templateCode: "INCIDENT_URGENCE_MAXIMALE" },
      }),
      admin.notification.findFirst({
        where: { utilisateurId: gardienA, templateCode: "INCIDENT_URGENCE_MAXIMALE" },
      }),
    ]);
    expect(notifSyndic?.statutEnvoi).toBe("EN_ATTENTE");
    expect(notifGardien?.statutEnvoi).toBe("EN_ATTENTE");
    const deltaMinutes =
      (incident.slaDeadline!.getTime() - incident.creeLe.getTime()) / (1000 * 60);
    expect(deltaMinutes).toBeCloseTo(30, 0);
  });

  it("un PRESTATAIRE ne peut pas créer d'incident (reçoit l'assignation, ne crée pas)", async () => {
    await expect(
      creerIncident(ctxPresta(), {
        lot_id: null,
        categorie: "SECURITE",
        sous_categorie: "Intrusion",
        partie: "COMMUNE",
        urgence: "URGENTE",
      })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("Confidentialité RLS sur `incident` (Master Spec Partie 4.2 / Doc A §12.3)", () => {
  it("le syndic voit tous les incidents de sa copropriété", async () => {
    const aliceIncident = await creerIncident(ctxAlice(), {
      lot_id: lotA1,
      categorie: "ELECTRICITE",
      sous_categorie: "Panne générale",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    const bobIncident = await creerIncident(ctxBob(), {
      lot_id: null,
      categorie: "NETTOYAGE",
      sous_categorie: "Poubelles débordantes",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });

    const syndicRows = await withTenant(ctxSyndicA(), (db) =>
      db.incident.findMany({ where: { id: { in: [aliceIncident.id, bobIncident.id] } } })
    );
    expect(syndicRows.map((r) => r.id).sort()).toEqual(
      [aliceIncident.id, bobIncident.id].sort()
    );

    const aliceRows = await withTenant(ctxAlice(), (db) =>
      db.incident.findMany({ where: { id: { in: [aliceIncident.id, bobIncident.id] } } })
    );
    expect(aliceRows.map((r) => r.id)).toEqual([aliceIncident.id]);
  });

  it("un prestataire ne voit que les incidents qui lui sont assignés", async () => {
    const incident = await creerIncident(ctxBob(), {
      lot_id: null,
      categorie: "PARKING",
      sous_categorie: "Barrière en panne",
      partie: "COMMUNE",
      urgence: "URGENTE",
    });
    await assignerIncident(ctxSyndicA(), incident.id, prestataireId);

    const rowsAssigne = await withTenant(ctxPresta(), (db) =>
      db.incident.findMany({ where: { id: incident.id } })
    );
    expect(rowsAssigne).toHaveLength(1);

    const rowsAutre = await withTenant(ctxAutrePresta(), (db) =>
      db.incident.findMany({ where: { id: incident.id } })
    );
    expect(rowsAutre).toHaveLength(0);
  });
});

describe("Assignation à un prestataire (Master Spec Partie 4.2)", () => {
  it("l'assignation d'un ticket OUVERT le fait passer automatiquement en EN_COURS", async () => {
    const incident = await creerIncident(ctxAlice(), {
      lot_id: lotA1,
      categorie: "STRUCTURE",
      sous_categorie: "Fissure",
      partie: "PRIVATIVE",
      urgence: "NORMALE",
    });
    expect(incident.statut).toBe("OUVERT");
    const assigne = await assignerIncident(ctxSyndicA(), incident.id, prestataireId);
    expect(assigne.statut).toBe("EN_COURS");
    expect(assigne.assigneAId).toBe(prestataireId);
  });

  it("un PROPRIETAIRE ne peut pas assigner un incident", async () => {
    const incident = await creerIncident(ctxAlice(), {
      lot_id: lotA1,
      categorie: "NUISANCES",
      sous_categorie: "Bruit nocturne",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    await expect(assignerIncident(ctxAlice(), incident.id, prestataireId)).rejects.toBeInstanceOf(
      PermissionRefuseeError
    );
  });

  it("rejette l'assignation à un prestataire d'une autre copropriété", async () => {
    const autreCopro = await admin.copropriete.create({
      data: {
        nom: "Autre Copro",
        adresse: "9 rue X",
        ville: "Rabat",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 1,
      },
    });
    const prestaEtranger = await admin.prestataire.create({
      data: { coproprieteId: autreCopro.id, nom: "Étranger", specialite: "X", contact: "0" },
    });
    const incident = await creerIncident(ctxAlice(), {
      lot_id: lotA1,
      categorie: "ADMINISTRATIF",
      sous_categorie: "Erreur facturation",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    await expect(
      assignerIncident(ctxSyndicA(), incident.id, prestaEtranger.id)
    ).rejects.toBeInstanceOf(PrestataireIntrouvableError);

    await admin.prestataire.delete({ where: { id: prestaEtranger.id } });
    await admin.copropriete.delete({ where: { id: autreCopro.id } });
  });
});

describe("Changement de statut (Master Spec Partie 4.2)", () => {
  it("le prestataire assigné peut changer le statut de SON ticket", async () => {
    const incident = await creerIncident(ctxBob(), {
      lot_id: null,
      categorie: "EQUIPEMENTS_COLLECTIFS",
      sous_categorie: "Piscine",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    await assignerIncident(ctxSyndicA(), incident.id, prestataireId);
    const log = await changerStatutIncident(ctxPresta(), incident.id, {
      statut: "RESOLU",
      commentaire: "Réparé.",
    });
    expect(log.statutApres).toBe("RESOLU");
  });

  it("un prestataire NON assigné ne peut pas changer le statut du ticket", async () => {
    const incident = await creerIncident(ctxBob(), {
      lot_id: null,
      categorie: "JARDINS_ESPACES_VERTS",
      sous_categorie: "Arrosage en panne",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    await assignerIncident(ctxSyndicA(), incident.id, prestataireId);
    // La policy RLS "tenant_isolation" sur `incident` cache déjà la ligne à un prestataire non
    // assigné (Doc A §12.3, défense en profondeur Partie 1.6) : la vérification applicative
    // "assertPrestataireAssigne" n'est donc jamais atteinte ici, la requête échoue en amont avec
    // IncidentIntrouvableError plutôt que PermissionRefuseeError — les deux mènent au même refus.
    await expect(
      changerStatutIncident(ctxAutrePresta(), incident.id, { statut: "EN_COURS" })
    ).rejects.toBeInstanceOf(IncidentIntrouvableError);
  });

  it("le gardien peut changer le statut d'un incident (Doc A §5.3)", async () => {
    const incident = await creerIncident(ctxAlice(), {
      lot_id: lotA1,
      categorie: "SECURITE",
      sous_categorie: "Interphone défaillant",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    const log = await changerStatutIncident(ctxGardienA(), incident.id, { statut: "EN_COURS" });
    expect(log.statutApres).toBe("EN_COURS");
  });
});

describe("Prestataires — annuaire (nécessaire au-delà du tableau Master Spec littéral)", () => {
  it("seul le syndic peut créer un prestataire", async () => {
    await expect(
      creerPrestataire(ctxAlice(), { nom: "X", specialite: "Y", contact: "Z" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);

    const created = await creerPrestataire(ctxSyndicA(), {
      nom: "Électricien Express",
      specialite: "Électricité",
      contact: "0622222222",
    });
    expect(created.id).toBeTruthy();
    await admin.prestataire.delete({ where: { id: created.id } });
  });
});

describe("Pagination listerIncidents", () => {
  it("le syndic voit un total cohérent avec les incidents créés dans les tests précédents", async () => {
    const { total, rows } = await listerIncidents(ctxSyndicA(), 1, 100);
    expect(total).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("Validation Zod des payloads incidents (CLAUDE.md §1.5)", () => {
  it("rejette une catégorie hors liste fermée (Doc A §5.1)", () => {
    const result = incidentCreateSchema.safeParse({
      categorie: "INEXISTANTE",
      sous_categorie: "X",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    expect(result.success).toBe(false);
  });

  it("accepte un incident minimal valide", () => {
    const result = incidentCreateSchema.safeParse({
      categorie: "PLOMBERIE",
      sous_categorie: "Fuite eau",
      partie: "COMMUNE",
      urgence: "NORMALE",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un prestataire sans contact", () => {
    const result = prestataireCreateSchema.safeParse({ nom: "X", specialite: "Y", contact: "" });
    expect(result.success).toBe(false);
  });
});
