/**
 * Tests M12 — idempotence générique (Master Spec Partie 3.1, principe 1.7.3) :
 *   - rejeu même clé + même payload → réponse identique, AUCUNE seconde écriture métier
 *     ni seconde ligne d'audit ;
 *   - même clé + payload différent → 409 (IdempotencyConflitError) ;
 *   - header absent/invalide → IdempotencyKeyManquanteError (unit) ;
 *   - appel service sans clé (interne/tests) → passe sans protection.
 *
 * Prérequis : Supabase local démarré + migration `20260826120000_m12_idempotency_key` appliquée.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { genererAppelDeFonds } from "../lib/finances/finances";
import {
  readIdempotencyKey,
  IdempotencyKeyManquanteError,
  IdempotencyConflitError,
} from "../lib/http/idempotency";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproId: string;
let syndicId: string;
let lotId: string;

const ctxSyndic = (): TenantContext => ({
  utilisateurId: syndicId,
  coproprieteId: coproId,
  role: "SYNDIC",
});

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Idem",
      adresse: "1 rue Rejeu",
      ville: "Rabat",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 1,
    },
  });
  coproId = copro.id;
  const syndic = await admin.utilisateur.create({
    data: { email: "syndic-idem@test.local", statutCompte: "ACTIF" },
  });
  syndicId = syndic.id;
  await admin.roleUtilisateur.create({
    data: { utilisateurId: syndicId, coproprieteId: coproId, role: "SYNDIC" },
  });
  const lot = await admin.lot.create({
    data: { coproprieteId: coproId, typeLot: "APPARTEMENT", numero: "I1", tantiemes: "100.00" },
  });
  lotId = lot.id;
  await admin.budgetAg.create({
    data: { coproprieteId: coproId, exercice: "2026", montantTotal: "12000.00", statut: "ACTIF" },
  });
});

afterAll(async () => {
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: coproId } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFonds: { coproprieteId: coproId } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: coproId } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: coproId } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproId } });
  await admin.lot.deleteMany({ where: { id: lotId } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproId } });
  await admin.utilisateur.deleteMany({ where: { id: syndicId } });
  await admin.copropriete.deleteMany({ where: { id: coproId } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("readIdempotencyKey", () => {
  it("rejette un header absent ou non-UUID", () => {
    expect(() => readIdempotencyKey(new Request("http://x/y"))).toThrow(
      IdempotencyKeyManquanteError
    );
    expect(() =>
      readIdempotencyKey(new Request("http://x/y", { headers: { "idempotency-key": "abc" } }))
    ).toThrow(IdempotencyKeyManquanteError);
  });

  it("accepte un UUID et le normalise en minuscules", () => {
    const cle = randomUUID().toUpperCase();
    const req = new Request("http://x/y", { headers: { "idempotency-key": cle } });
    expect(readIdempotencyKey(req)).toBe(cle.toLowerCase());
  });
});

describe("withIdempotency via genererAppelDeFonds", () => {
  const payload = {
    periode: "2026-03",
    type: "CHARGES_COURANTES" as const,
    montant_total: "1000.00",
    date_echeance: "2026-03-10",
  };

  it("rejeu même clé + même payload → réponse identique, une seule écriture métier et d'audit", async () => {
    const cle = randomUUID();
    const premier = await genererAppelDeFonds(ctxSyndic(), payload, cle);
    const rejeu = await genererAppelDeFonds(ctxSyndic(), payload, cle);

    // Même contenu après sérialisation JSON (le rejeu renvoie la réponse stockée).
    expect(JSON.parse(JSON.stringify(rejeu))).toEqual(JSON.parse(JSON.stringify(premier)));

    const appels = await admin.appelDeFonds.count({
      where: { coproprieteId: coproId, periode: "2026-03" },
    });
    expect(appels).toBe(1);
    const audits = await admin.auditLog.count({
      where: { coproprieteId: coproId, action: "APPEL_DE_FONDS_EMIS" },
    });
    expect(audits).toBe(1);
  });

  it("même clé + payload différent → 409 IdempotencyConflitError", async () => {
    const cle = randomUUID();
    await genererAppelDeFonds(ctxSyndic(), { ...payload, periode: "2026-04" }, cle);
    await expect(
      genererAppelDeFonds(ctxSyndic(), { ...payload, periode: "2026-05" }, cle)
    ).rejects.toBeInstanceOf(IdempotencyConflitError);
  });

  it("échec métier → la clé est libérée avec la transaction (rollback), retry possible", async () => {
    const cle = randomUUID();
    // Période déjà émise → ConflitIdempotenceError métier → rollback du claim.
    await expect(genererAppelDeFonds(ctxSyndic(), payload, cle)).rejects.toThrow();
    const rows = await admin.idempotencyKey.count({ where: { cle } });
    expect(rows).toBe(0);
  });

  it("sans clé (appel interne) → exécute sans protection", async () => {
    const resultat = await genererAppelDeFonds(ctxSyndic(), { ...payload, periode: "2026-06" });
    expect(resultat.periode).toBe("2026-06");
  });
});
