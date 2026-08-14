/**
 * Test de sécurité M1 (ROADMAP_BACKLOG) : un rôle PROPRIETAIRE ne peut lire AUCUNE ligne hors de
 * sa copropriété, même en visant directement un ID d'une autre copropriété. Vérifie la couche
 * RLS (rôle app_local sans BYPASSRLS) — indépendamment de la couche applicative.
 *
 * Prérequis : Supabase local démarré + migration appliquée + rôle app_local créé
 * (npm run setup:local-role --workspace=@copropriete-maroc/database).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";

// Client admin (DIRECT_URL = postgres, BYPASSRLS) — seed et nettoyage uniquement.
const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let coproB: string;
let alice: string; // PROPRIETAIRE dans A
let bob: string; // PROPRIETAIRE dans B
let syndicA: string; // SYNDIC dans A

const ctxAlice = (): TenantContext => ({
  utilisateurId: alice,
  coproprieteId: coproA,
  role: "PROPRIETAIRE",
});

const ctxSyndicA = (): TenantContext => ({
  utilisateurId: syndicA,
  coproprieteId: coproA,
  role: "SYNDIC",
});

beforeAll(async () => {
  const a = await admin.copropriete.create({
    data: {
      nom: "Résidence Test A",
      adresse: "1 rue A",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 10,
    },
  });
  const b = await admin.copropriete.create({
    data: {
      nom: "Résidence Test B",
      adresse: "2 rue B",
      ville: "Rabat",
      typeResidence: "RESIDENCE_FERMEE",
      nbLots: 20,
    },
  });
  coproA = a.id;
  coproB = b.id;

  const [ua, ub, us] = await Promise.all([
    admin.utilisateur.create({
      data: { email: "alice@test.local", nom: "Alice", statutCompte: "ACTIF" },
    }),
    admin.utilisateur.create({
      data: { email: "bob@test.local", nom: "Bob", statutCompte: "ACTIF" },
    }),
    admin.utilisateur.create({
      data: { email: "syndic-a@test.local", nom: "SyndicA", statutCompte: "ACTIF" },
    }),
  ]);
  alice = ua.id;
  bob = ub.id;
  syndicA = us.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproB, role: "PROPRIETAIRE" },
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
    ],
  });
});

afterAll(async () => {
  await admin.roleUtilisateur.deleteMany({
    where: { coproprieteId: { in: [coproA, coproB] } },
  });
  await admin.utilisateur.deleteMany({
    where: { id: { in: [alice, bob, syndicA] } },
  });
  await admin.copropriete.deleteMany({ where: { id: { in: [coproA, coproB] } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Isolation tenant — couche RLS (M1)", () => {
  it("un PROPRIETAIRE de A ne liste que sa copropriété", async () => {
    const rows = await withTenant(ctxAlice(), (db) =>
      db.copropriete.findMany({ where: { id: { in: [coproA, coproB] } } })
    );
    expect(rows.map((r) => r.id)).toEqual([coproA]);
  });

  it("un PROPRIETAIRE de A ne peut pas lire la copropriété B même en visant son ID exact", async () => {
    const row = await withTenant(ctxAlice(), (db) =>
      db.copropriete.findUnique({ where: { id: coproB } })
    );
    expect(row).toBeNull();
  });

  it("un PROPRIETAIRE de A ne voit aucun rôle de la copropriété B", async () => {
    const rows = await withTenant(ctxAlice(), (db) =>
      db.roleUtilisateur.findMany({ where: { coproprieteId: coproB } })
    );
    expect(rows).toHaveLength(0);
  });

  it("un PROPRIETAIRE ne voit pas le profil d'un utilisateur d'une autre copropriété", async () => {
    const row = await withTenant(ctxAlice(), (db) =>
      db.utilisateur.findUnique({ where: { id: bob } })
    );
    expect(row).toBeNull();
  });

  it("un PROPRIETAIRE voit son propre profil", async () => {
    const row = await withTenant(ctxAlice(), (db) =>
      db.utilisateur.findUnique({ where: { id: alice } })
    );
    expect(row?.id).toBe(alice);
  });

  it("le SYNDIC de A voit les membres de A mais pas ceux de B", async () => {
    const inA = await withTenant(ctxSyndicA(), (db) =>
      db.utilisateur.findUnique({ where: { id: alice } })
    );
    const inB = await withTenant(ctxSyndicA(), (db) =>
      db.utilisateur.findUnique({ where: { id: bob } })
    );
    expect(inA?.id).toBe(alice);
    expect(inB).toBeNull();
  });

  it("sans contexte tenant injecté, la connexion applicative ne voit AUCUNE ligne (policy fermée par défaut)", async () => {
    const rawApp = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    try {
      const rows = await rawApp.copropriete.findMany({
        where: { id: { in: [coproA, coproB] } },
      });
      expect(rows).toHaveLength(0);
    } finally {
      await rawApp.$disconnect();
    }
  });

  it("un contexte tenant malformé est rejeté avant toute requête", async () => {
    await expect(
      withTenant(
        { utilisateurId: "'; DROP TABLE copropriete; --", coproprieteId: coproA, role: "PROPRIETAIRE" },
        (db) => db.copropriete.findMany()
      )
    ).rejects.toThrow(/TenantContext invalide/);
  });
});
