/**
 * Tests M3 (ROADMAP_BACKLOG.md) : isolation tenant/RLS sur `lot`, contrainte "somme des
 * quote_part actives = 100%" (Doc A §2.4) et contrainte "somme des tantièmes ≤ total du
 * règlement" (Master Spec Partie 2.4), + validation Zod des payloads.
 *
 * Prérequis : Supabase local démarré + migration `20260817170000_m3_lots_propriete_occupation`
 * appliquée + rôle app_local créé (npm run setup:local-role --workspace=@copropriete-maroc/database).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { lotCreateSchema, lotProprietaireCreateSchema } from "../lib/lots/schemas";
import { creerLot, ajouterProprietaire, ContrainteMetierError } from "../lib/lots/lots";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let coproB: string;
let syndicA: string;
let alice: string; // PROPRIETAIRE dans A
let bob: string; // PROPRIETAIRE dans B (autre copro)
let lucie: string; // LOCATAIRE dans A

let lotA1: string;
let lotA2: string;
let lotB1: string;

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
const ctxLucie = (): TenantContext => ({
  utilisateurId: lucie,
  coproprieteId: coproA,
  role: "LOCATAIRE",
});

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.copropriete.create({
      data: {
        nom: "Résidence Lots A",
        adresse: "1 rue Lots",
        ville: "Casablanca",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 5,
      },
    }),
    admin.copropriete.create({
      data: {
        nom: "Résidence Lots B",
        adresse: "2 rue Lots",
        ville: "Rabat",
        typeResidence: "RESIDENCE_FERMEE",
        nbLots: 5,
      },
    }),
  ]);
  coproA = a.id;
  coproB = b.id;

  const [us, ua, ub, ul] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-lots-a@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-lots@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-lots@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "lucie-lots@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  bob = ub.id;
  lucie = ul.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproB, role: "PROPRIETAIRE" },
      { utilisateurId: lucie, coproprieteId: coproA, role: "LOCATAIRE" },
    ],
  });

  const [l1, l2, lb] = await Promise.all([
    admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "100.00" },
    }),
    admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "A2", tantiemes: "100.00" },
    }),
    admin.lot.create({
      data: { coproprieteId: coproB, typeLot: "APPARTEMENT", numero: "B1", tantiemes: "100.00" },
    }),
  ]);
  lotA1 = l1.id;
  lotA2 = l2.id;
  lotB1 = lb.id;

  await admin.lotProprietaire.create({
    data: {
      lotId: lotA1,
      utilisateurId: alice,
      quotePart: "100.00",
      typePropriete: "PLEIN",
      dateDebut: new Date("2024-01-01"),
    },
  });
  await admin.lotOccupant.create({
    data: {
      lotId: lotA2,
      utilisateurId: lucie,
      typeOccupation: "LOCATAIRE",
      dateDebut: new Date("2024-01-01"),
    },
  });
});

afterAll(async () => {
  await admin.lotOccupant.deleteMany({ where: { lotId: { in: [lotA1, lotA2, lotB1] } } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: [lotA1, lotA2, lotB1] } } });
  await admin.lot.deleteMany({ where: { id: { in: [lotA1, lotA2, lotB1] } } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice, bob, lucie] } } });
  await admin.copropriete.deleteMany({ where: { id: { in: [coproA, coproB] } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Isolation tenant/RLS sur `lot` (M3)", () => {
  it("le SYNDIC de A voit tous les lots de A mais aucun de B", async () => {
    const rows = await withTenant(ctxSyndicA(), (db) =>
      db.lot.findMany({ where: { id: { in: [lotA1, lotA2, lotB1] } } })
    );
    expect(rows.map((r) => r.id).sort()).toEqual([lotA1, lotA2].sort());
  });

  it("un PROPRIETAIRE ne voit que son propre lot, pas les autres lots de sa copropriété", async () => {
    const rows = await withTenant(ctxAlice(), (db) =>
      db.lot.findMany({ where: { id: { in: [lotA1, lotA2, lotB1] } } })
    );
    expect(rows.map((r) => r.id)).toEqual([lotA1]);
  });

  it("un LOCATAIRE voit le lot qu'il occupe, pas celui d'un autre", async () => {
    const rows = await withTenant(ctxLucie(), (db) =>
      db.lot.findMany({ where: { id: { in: [lotA1, lotA2, lotB1] } } })
    );
    expect(rows.map((r) => r.id)).toEqual([lotA2]);
  });

  it("un PROPRIETAIRE ne voit aucune ligne lot_proprietaire d'un lot qui n'est pas le sien", async () => {
    const rows = await withTenant(ctxAlice(), (db) =>
      db.lotProprietaire.findMany({ where: { lotId: lotA2 } })
    );
    expect(rows).toHaveLength(0);
  });
});

describe("Contrainte quote_part = 100% (Doc A §2.4)", () => {
  it("un plein propriétaire unique à 100% est accepté", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "PARKING", numero: "P1", tantiemes: "10.00" },
    });
    await withTenant(ctxSyndicA(), (db) =>
      db.lotProprietaire.create({
        data: {
          lotId: lot.id,
          utilisateurId: alice,
          quotePart: "100.00",
          typePropriete: "PLEIN",
          dateDebut: new Date("2024-01-01"),
        },
      })
    );
    const rows = await admin.lotProprietaire.findMany({ where: { lotId: lot.id } });
    expect(rows).toHaveLength(1);
    await admin.lotProprietaire.deleteMany({ where: { lotId: lot.id } });
    await admin.lot.delete({ where: { id: lot.id } });
  });

  it("un seul indivisaire à 50% (sans complément) est rejeté au commit", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "PARKING", numero: "P2", tantiemes: "10.00" },
    });
    await expect(
      withTenant(ctxSyndicA(), (db) =>
        db.lotProprietaire.create({
          data: {
            lotId: lot.id,
            utilisateurId: alice,
            quotePart: "50.00",
            typePropriete: "INDIVISION",
            dateDebut: new Date("2024-01-01"),
          },
        })
      )
    ).rejects.toThrow();
    await admin.lot.delete({ where: { id: lot.id } });
  });

  it("deux indivisaires à 50%+50% dans la même transaction sont acceptés", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "PARKING", numero: "P3", tantiemes: "10.00" },
    });
    await withTenant(ctxSyndicA(), async (db) => {
      await db.lotProprietaire.create({
        data: {
          lotId: lot.id,
          utilisateurId: alice,
          quotePart: "50.00",
          typePropriete: "INDIVISION",
          dateDebut: new Date("2024-01-01"),
        },
      });
      await db.lotProprietaire.create({
        data: {
          lotId: lot.id,
          utilisateurId: bob,
          quotePart: "50.00",
          typePropriete: "INDIVISION",
          dateDebut: new Date("2024-01-01"),
        },
      });
    });
    const rows = await admin.lotProprietaire.findMany({ where: { lotId: lot.id } });
    expect(rows).toHaveLength(2);
    await admin.lotProprietaire.deleteMany({ where: { lotId: lot.id } });
    await admin.lot.delete({ where: { id: lot.id } });
  });
});

describe("Contrainte somme des tantièmes ≤ total du règlement (Master Spec Partie 2.4)", () => {
  it("sans total_tantiemes configuré, aucun blocage même si la somme est élevée", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "CAVE", numero: "C1", tantiemes: "999999.00" },
    });
    expect(lot.tantiemes.toString()).toBe("999999");
    await admin.lot.delete({ where: { id: lot.id } });
  });

  it("avec total_tantiemes configuré, dépasser le total est bloqué", async () => {
    const copro = await admin.copropriete.create({
      data: {
        nom: "Résidence Tantièmes",
        adresse: "3 rue T",
        ville: "Fès",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 2,
        totalTantiemes: "100.00",
      },
    });
    await admin.lot.create({
      data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "T1", tantiemes: "60.00" },
    });
    await expect(
      admin.lot.create({
        data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "T2", tantiemes: "50.00" },
      })
    ).rejects.toThrow();

    // Un ajout qui ne dépasse pas le total reste accepté.
    const lot2 = await admin.lot.create({
      data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "T3", tantiemes: "40.00" },
    });
    expect(lot2.id).toBeTruthy();

    await admin.lot.deleteMany({ where: { coproprieteId: copro.id } });
    await admin.copropriete.delete({ where: { id: copro.id } });
  });
});

describe("Mapping des erreurs métier via le service (apps/api/lib/lots/lots.ts)", () => {
  it("creerLot rejette proprement (ContrainteMetierError) si le total des tantièmes serait dépassé", async () => {
    const copro = await admin.copropriete.create({
      data: {
        nom: "Résidence Service Tantièmes",
        adresse: "4 rue T",
        ville: "Fès",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 1,
        totalTantiemes: "50.00",
      },
    });
    const ctx: TenantContext = { utilisateurId: syndicA, coproprieteId: copro.id, role: "SYNDIC" };
    await expect(
      creerLot(ctx, { type_lot: "APPARTEMENT", numero: "S1", tantiemes: "60.00" })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
    await admin.copropriete.delete({ where: { id: copro.id } });
  });

  it("ajouterProprietaire rejette proprement (ContrainteMetierError) une quote_part seule à 40%", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "PARKING", numero: "P4", tantiemes: "10.00" },
    });
    await expect(
      ajouterProprietaire(ctxSyndicA(), lot.id, {
        utilisateur_id: alice,
        quote_part: "40.00",
        type_propriete: "INDIVISION",
        est_representant_indivision: false,
        date_debut: "2024-01-01",
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
    await admin.lot.delete({ where: { id: lot.id } });
  });
});

describe("Validation Zod des payloads lots (CLAUDE.md §1.5)", () => {
  it("rejette un montant tantiemes non décimal", () => {
    const result = lotCreateSchema.safeParse({
      type_lot: "APPARTEMENT",
      numero: "A1",
      tantiemes: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("accepte un lot minimal valide", () => {
    const result = lotCreateSchema.safeParse({
      type_lot: "APPARTEMENT",
      numero: "A1",
      tantiemes: "125.50",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une quote_part hors format", () => {
    const result = lotProprietaireCreateSchema.safeParse({
      utilisateur_id: "00000000-0000-0000-0000-000000000000",
      quote_part: "1000.00",
      type_propriete: "PLEIN",
      date_debut: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });
});
