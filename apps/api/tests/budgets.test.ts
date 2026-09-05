/**
 * Tests M12 — CRUD budgets AG (Master Spec Partie 2.2, Doc A §3.2) :
 * création PROPOSE, modification figée hors PROPOSE, activation, budget rectificatif
 * (ACTIF → REMPLACE), chaîne complète budget → activer → genererAppelDeFonds (déblocage
 * fonctionnel : Partie 6.2 étape 1).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerBudget,
  modifierBudget,
  activerBudget,
  listerBudgets,
  obtenirBudget,
} from "../lib/finances/budgets";
import { genererAppelDeFonds } from "../lib/finances/finances";
import {
  PermissionRefuseeError,
  ContrainteMetierError,
} from "../lib/finances/finances";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproId: string;
let syndicId: string;
let proprioId: string;
let lotId: string;

const ctxSyndic = (): TenantContext => ({
  utilisateurId: syndicId,
  coproprieteId: coproId,
  role: "SYNDIC",
});
const ctxProprio = (): TenantContext => ({
  utilisateurId: proprioId,
  coproprieteId: coproId,
  role: "PROPRIETAIRE",
});

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Budgets",
      adresse: "3 rue Exercice",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 1,
    },
  });
  coproId = copro.id;
  const [s, p] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-bdg@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "proprio-bdg@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicId = s.id;
  proprioId = p.id;
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicId, coproprieteId: coproId, role: "SYNDIC" },
      { utilisateurId: proprioId, coproprieteId: coproId, role: "PROPRIETAIRE" },
    ],
  });
  const lot = await admin.lot.create({
    data: { coproprieteId: coproId, typeLot: "APPARTEMENT", numero: "B1", tantiemes: "100.00" },
  });
  lotId = lot.id;
});

afterAll(async () => {
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: coproId } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFonds: { coproprieteId: coproId } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: coproId } });
  await admin.budgetPoste.deleteMany({ where: { budgetAg: { coproprieteId: coproId } } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: coproId } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproId } });
  await admin.lot.deleteMany({ where: { id: lotId } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproId } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicId, proprioId] } } });
  await admin.copropriete.deleteMany({ where: { id: coproId } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("CRUD budgets AG (M12)", () => {
  it("le syndic crée un budget PROPOSE, un propriétaire ne peut pas", async () => {
    const budget = await creerBudget(ctxSyndic(), { exercice: "2027", montant_total: "24000.00" });
    expect(budget.statut).toBe("PROPOSE");
    await expect(
      creerBudget(ctxProprio(), { exercice: "2027", montant_total: "1.00" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
    const audit = await admin.auditLog.findFirst({
      where: { coproprieteId: coproId, action: "BUDGET_CREE", entiteId: budget.id },
    });
    expect(audit).not.toBeNull();
  });

  it("un propriétaire peut lire les budgets (transparence budgétaire)", async () => {
    const { rows } = await listerBudgets(ctxProprio(), 1, 20);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("PATCH : modifiable en PROPOSE, figé après activation", async () => {
    const budget = await creerBudget(ctxSyndic(), { exercice: "2028", montant_total: "10000.00" });
    const maj = await modifierBudget(ctxSyndic(), budget.id, { montant_total: "11000.00" });
    expect(maj.montantTotal.toString()).toBe("11000");
    await activerBudget(ctxSyndic(), budget.id);
    await expect(
      modifierBudget(ctxSyndic(), budget.id, { montant_total: "12000.00" })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("budget rectificatif : activer un second budget passe l'ancien ACTIF en REMPLACE", async () => {
    const premier = await creerBudget(ctxSyndic(), { exercice: "2029", montant_total: "20000.00" });
    await activerBudget(ctxSyndic(), premier.id);
    const rectificatif = await creerBudget(ctxSyndic(), {
      exercice: "2029",
      montant_total: "26000.00",
    });
    const actif = await activerBudget(ctxSyndic(), rectificatif.id);
    expect(actif.statut).toBe("ACTIF");

    const ancien = await obtenirBudget(ctxSyndic(), premier.id);
    expect(ancien.statut).toBe("REMPLACE");
    await expect(activerBudget(ctxSyndic(), premier.id)).rejects.toBeInstanceOf(
      ContrainteMetierError
    );
    const auditRemplace = await admin.auditLog.findFirst({
      where: { coproprieteId: coproId, action: "BUDGET_REMPLACE", entiteId: premier.id },
    });
    expect(auditRemplace).not.toBeNull();
  });

  it("chaîne complète : budget créé + activé → genererAppelDeFonds passe (Partie 6.2 étape 1)", async () => {
    await expect(
      genererAppelDeFonds(ctxSyndic(), {
        periode: "2030-01",
        type: "CHARGES_COURANTES",
        montant_total: "1500.00",
        date_echeance: "2030-01-10",
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError); // pas encore de budget 2030

    const budget = await creerBudget(ctxSyndic(), { exercice: "2030", montant_total: "18000.00" });
    await activerBudget(ctxSyndic(), budget.id);

    const appel = await genererAppelDeFonds(ctxSyndic(), {
      periode: "2030-01",
      type: "CHARGES_COURANTES",
      montant_total: "1500.00",
      date_echeance: "2030-01-10",
    });
    expect(appel.statut).toBe("EMIS");
    expect(appel.lignes).toHaveLength(1);
  });
});
