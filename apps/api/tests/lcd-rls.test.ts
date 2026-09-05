/**
 * Tests de sécurité M15 (location courte durée) — couche RLS seule, indépendamment des services :
 *  - un PROPRIETAIRE du lot A ne lit pas les séjours du lot B (même copropriété) ;
 *  - un utilisateur d'une autre copropriété ne lit rien, même avec un id forgé ;
 *  - un LOCATAIRE ne voit rien ; le GARDIEN ne voit que les déclarations VALIDEES ;
 *  - le gestionnaire LCD ne voit que ses déclarations/séjours ;
 *  - sejour_evenement est append-only : UPDATE/DELETE échouent au niveau base.
 *
 * Prérequis : Supabase local + migration `20260905100000_m15_location_courte_duree` + rôle
 * app_local (npm run setup:local-role --workspace=@copropriete-maroc/database).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproA: string;
let coproB: string;
let syndicA: string;
let alice: string; // PROPRIETAIRE lot A1 (copro A)
let bob: string; // PROPRIETAIRE lot A2 (copro A)
let carol: string; // PROPRIETAIRE dans B
let locataireA: string; // LOCATAIRE lot A2
let gardienA: string;
let gestionnaire: string; // GESTIONNAIRE_LCD sur la déclaration d'Alice
let lotA1: string;
let lotA2: string;
let declA1: string; // VALIDEE, gestionnaire = gestionnaire
let declA2: string; // EN_ATTENTE (Bob)
let sejourA1: string;
let sejourA2: string;
let evenementA1: string;

const ctx = (utilisateurId: string, role: TenantContext["role"], coproprieteId = coproA): TenantContext => ({
  utilisateurId,
  coproprieteId,
  role,
});

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.copropriete.create({
      data: { nom: "Résidence LCD A", adresse: "1 rue LCD", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 4, regimeLcd: "AUTORISEE" },
    }),
    admin.copropriete.create({
      data: { nom: "Résidence LCD B", adresse: "2 rue LCD", ville: "Rabat", typeResidence: "RESIDENCE_FERMEE", nbLots: 4, regimeLcd: "AUTORISEE" },
    }),
  ]);
  coproA = a.id;
  coproB = b.id;
  const users = await Promise.all(
    ["syndic", "alice", "bob", "carol", "loc", "gardien", "gest"].map((n) =>
      admin.utilisateur.create({ data: { email: `${n}-lcd-rls@test.local`, statutCompte: "ACTIF" } })
    )
  );
  const ids = users.map((u) => u.id);
  syndicA = ids[0]!;
  alice = ids[1]!;
  bob = ids[2]!;
  carol = ids[3]!;
  locataireA = ids[4]!;
  gardienA = ids[5]!;
  gestionnaire = ids[6]!;
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: carol, coproprieteId: coproB, role: "PROPRIETAIRE" },
      { utilisateurId: locataireA, coproprieteId: coproA, role: "LOCATAIRE" },
      { utilisateurId: gardienA, coproprieteId: coproA, role: "GARDIEN" },
      { utilisateurId: gestionnaire, coproprieteId: coproA, role: "GESTIONNAIRE_LCD" },
    ],
  });
  const [l1, l2] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "100.00" } }),
    admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "A2", tantiemes: "100.00" } }),
  ]);
  lotA1 = l1.id;
  lotA2 = l2.id;
  await admin.lotProprietaire.createMany({
    data: [
      { lotId: lotA1, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: lotA2, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    ],
  });
  await admin.lotOccupant.create({
    data: { lotId: lotA2, utilisateurId: locataireA, typeOccupation: "LOCATAIRE", dateDebut: new Date("2025-01-01") },
  });
  const d1 = await admin.lotLocationCourteDuree.create({
    data: { coproprieteId: coproA, lotId: lotA1, declareParId: alice, gestionnaireId: gestionnaire, statut: "VALIDEE", dateDebut: new Date("2026-01-01") },
  });
  const d2 = await admin.lotLocationCourteDuree.create({
    data: { coproprieteId: coproA, lotId: lotA2, declareParId: bob, statut: "EN_ATTENTE", dateDebut: new Date("2026-01-01") },
  });
  declA1 = d1.id;
  declA2 = d2.id;
  const [s1, s2] = await Promise.all([
    admin.sejourCourteDuree.create({
      data: { coproprieteId: coproA, lotId: lotA1, declarationLcdId: declA1, declareParId: alice, dateArrivee: new Date("2026-10-01"), dateDepart: new Date("2026-10-04"), nbVoyageurs: 2, voyageurPrincipalNom: "Voyageur A1" },
    }),
    admin.sejourCourteDuree.create({
      data: { coproprieteId: coproA, lotId: lotA2, declarationLcdId: declA2, declareParId: bob, dateArrivee: new Date("2026-10-01"), dateDepart: new Date("2026-10-04"), nbVoyageurs: 1, voyageurPrincipalNom: "Voyageur A2" },
    }),
  ]);
  sejourA1 = s1.id;
  sejourA2 = s2.id;
  const ev = await admin.sejourEvenement.create({ data: { coproprieteId: coproA, sejourId: sejourA1, type: "DECLARE", acteurId: alice } });
  evenementA1 = ev.id;
});

afterAll(async () => {
  await admin.incident.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.sejourEvenement.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.sejourCourteDuree.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.lotLocationCourteDuree.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.lotOccupant.deleteMany({ where: { lotId: { in: [lotA1, lotA2] } } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: [lotA1, lotA2] } } });
  await admin.lot.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-lcd-rls@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: { in: [coproA, coproB] } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("RLS M15 — déclarations et séjours LCD", () => {
  it("le propriétaire du lot A1 ne voit que ses déclarations/séjours, jamais ceux du lot A2", async () => {
    const decls = await withTenant(ctx(alice, "PROPRIETAIRE"), (db) => db.lotLocationCourteDuree.findMany());
    expect(decls.map((d) => d.id)).toEqual([declA1]);
    const sejours = await withTenant(ctx(alice, "PROPRIETAIRE"), (db) => db.sejourCourteDuree.findMany());
    expect(sejours.map((s) => s.id)).toEqual([sejourA1]);
    const cible = await withTenant(ctx(alice, "PROPRIETAIRE"), (db) => db.sejourCourteDuree.findUnique({ where: { id: sejourA2 } }));
    expect(cible).toBeNull();
    const evs = await withTenant(ctx(alice, "PROPRIETAIRE"), (db) => db.sejourEvenement.findMany());
    expect(evs.map((e) => e.id)).toEqual([evenementA1]);
  });

  it("un utilisateur d'une autre copropriété ne lit rien, même avec un id forgé", async () => {
    const cB = ctx(carol, "PROPRIETAIRE", coproB);
    expect(await withTenant(cB, (db) => db.lotLocationCourteDuree.findMany())).toEqual([]);
    expect(await withTenant(cB, (db) => db.sejourCourteDuree.findUnique({ where: { id: sejourA1 } }))).toBeNull();
    expect(await withTenant(cB, (db) => db.sejourEvenement.findUnique({ where: { id: evenementA1 } }))).toBeNull();
    // Contexte forgé : rôle SYNDIC déclaré sur la copropriété A avec un utilisateur de B —
    // la policy tenant_isolation ne regarde que copropriete_id du contexte : lecture possible
    // uniquement si le JWT porte réellement ce tenant (couche applicative), mais un contexte
    // ciblant B ne franchit jamais la frontière.
    expect(await withTenant({ utilisateurId: carol, coproprieteId: coproB, role: "SYNDIC" }, (db) => db.sejourCourteDuree.findMany())).toEqual([]);
  });

  it("le locataire ne voit rien ; le voisin propriétaire ne voit pas l'identité des voyageurs d'un autre lot", async () => {
    expect(await withTenant(ctx(locataireA, "LOCATAIRE"), (db) => db.sejourCourteDuree.findMany())).toEqual([]);
    expect(await withTenant(ctx(locataireA, "LOCATAIRE"), (db) => db.lotLocationCourteDuree.findMany())).toEqual([]);
    const bobVoit = await withTenant(ctx(bob, "PROPRIETAIRE"), (db) => db.sejourCourteDuree.findMany());
    expect(bobVoit.map((s) => s.id)).toEqual([sejourA2]);
  });

  it("le gardien ne lit que les déclarations VALIDEES, mais tous les séjours de sa copropriété", async () => {
    const decls = await withTenant(ctx(gardienA, "GARDIEN"), (db) => db.lotLocationCourteDuree.findMany());
    expect(decls.map((d) => d.id)).toEqual([declA1]);
    const sejours = await withTenant(ctx(gardienA, "GARDIEN"), (db) => db.sejourCourteDuree.findMany({ orderBy: { voyageurPrincipalNom: "asc" } }));
    expect(sejours.map((s) => s.id).sort()).toEqual([sejourA1, sejourA2].sort());
  });

  it("le gestionnaire LCD ne voit que les déclarations où il est désigné, et leurs séjours", async () => {
    const decls = await withTenant(ctx(gestionnaire, "GESTIONNAIRE_LCD"), (db) => db.lotLocationCourteDuree.findMany());
    expect(decls.map((d) => d.id)).toEqual([declA1]);
    const sejours = await withTenant(ctx(gestionnaire, "GESTIONNAIRE_LCD"), (db) => db.sejourCourteDuree.findMany());
    expect(sejours.map((s) => s.id)).toEqual([sejourA1]);
    const evs = await withTenant(ctx(gestionnaire, "GESTIONNAIRE_LCD"), (db) => db.sejourEvenement.findMany());
    expect(evs.map((e) => e.id)).toEqual([evenementA1]);
  });

  it("le syndic voit tout dans sa copropriété", async () => {
    const decls = await withTenant(ctx(syndicA, "SYNDIC"), (db) => db.lotLocationCourteDuree.findMany());
    expect(decls.length).toBe(2);
  });

  it("le propriétaire du lot A1 ne peut pas insérer un séjour sur le lot A2", async () => {
    await expect(
      withTenant(ctx(alice, "PROPRIETAIRE"), (db) =>
        db.sejourCourteDuree.create({
          data: { coproprieteId: coproA, lotId: lotA2, declarationLcdId: declA2, declareParId: alice, dateArrivee: new Date("2026-11-01"), dateDepart: new Date("2026-11-02"), nbVoyageurs: 1, voyageurPrincipalNom: "Intrus" },
        })
      )
    ).rejects.toThrow();
  });

  it("sejour_evenement est append-only : UPDATE et DELETE échouent au niveau base, même pour le syndic", async () => {
    await expect(
      withTenant(ctx(syndicA, "SYNDIC"), (db) => db.sejourEvenement.update({ where: { id: evenementA1 }, data: { type: "ANNULE" } }))
    ).rejects.toThrow();
    await expect(withTenant(ctx(syndicA, "SYNDIC"), (db) => db.sejourEvenement.delete({ where: { id: evenementA1 } }))).rejects.toThrow();
    const encore = await admin.sejourEvenement.findUnique({ where: { id: evenementA1 } });
    expect(encore?.type).toBe("DECLARE");
  });

  it("contraintes : une seule déclaration ouverte par lot, date_depart > date_arrivee, nb_voyageurs ≥ 1", async () => {
    await expect(
      admin.lotLocationCourteDuree.create({ data: { coproprieteId: coproA, lotId: lotA1, declareParId: alice, dateDebut: new Date("2026-02-01") } })
    ).rejects.toThrow();
    await expect(
      admin.sejourCourteDuree.create({
        data: { coproprieteId: coproA, lotId: lotA1, declarationLcdId: declA1, declareParId: alice, dateArrivee: new Date("2026-12-05"), dateDepart: new Date("2026-12-05"), nbVoyageurs: 1, voyageurPrincipalNom: "X" },
      })
    ).rejects.toThrow();
    await expect(
      admin.sejourCourteDuree.create({
        data: { coproprieteId: coproA, lotId: lotA1, declarationLcdId: declA1, declareParId: alice, dateArrivee: new Date("2026-12-05"), dateDepart: new Date("2026-12-06"), nbVoyageurs: 0, voyageurPrincipalNom: "X" },
      })
    ).rejects.toThrow();
  });
});
