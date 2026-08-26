/**
 * Tests M5 (ROADMAP_BACKLOG.md) : génération batch d'appel de fonds (Master Spec Partie 6.2),
 * solde de lot, paiement manuel (partiel/complet/trop-perçu, Doc A §3.4), génération automatique
 * de quittance, webhook CMI (idempotence, Partie 6.4), contestation de charge (Doc A §3.3).
 *
 * Prérequis : Supabase local démarré + migration `20260819100000_m5_moteur_financier` appliquée.
 */
process.env.CMI_HMAC_SECRET ??= "test-secret-cmi";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  genererAppelDeFonds,
  obtenirSoldeLot,
  enregistrerPaiementManuel,
  initierPaiementCmi,
  traiterWebhookCmi,
  creerContestation,
  PermissionRefuseeError,
  ContrainteMetierError,
  ConflitIdempotenceError,
} from "../lib/finances/finances";
import {
  appelDeFondsGenererSchema,
  paiementManuelCreateSchema,
} from "../lib/finances/schemas";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let alice: string; // PROPRIETAIRE du lotA1
let lotA1: string;
let lotA2: string;

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

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Finances",
      adresse: "6 rue Charges",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 2,
    },
  });
  coproA = copro.id;

  const [us, ua] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-fin@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-fin@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
    ],
  });

  const [l1, l2] = await Promise.all([
    admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "F1", tantiemes: "60.00" },
    }),
    admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "F2", tantiemes: "40.00" },
    }),
  ]);
  lotA1 = l1.id;
  lotA2 = l2.id;

  await admin.lotProprietaire.create({
    data: {
      lotId: lotA1,
      utilisateurId: alice,
      quotePart: "100.00",
      typePropriete: "PLEIN",
      dateDebut: new Date("2024-01-01"),
    },
  });
});

afterAll(async () => {
  await admin.contestationCharge.deleteMany({ where: { appelDeFondsLot: { appelDeFonds: { coproprieteId: coproA } } } });
  await admin.quittance.deleteMany({ where: { appelDeFondsLot: { appelDeFonds: { coproprieteId: coproA } } } });
  await admin.paiement.deleteMany({ where: { lot: { coproprieteId: coproA } } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFonds: { coproprieteId: coproA } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: coproA } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: coproA } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: [lotA1, lotA2] } } });
  await admin.lot.deleteMany({ where: { id: { in: [lotA1, lotA2] } } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice] } } });
  await admin.copropriete.delete({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Génération batch d'appel de fonds (Master Spec Partie 6.2)", () => {
  it("est rejetée (422) sans budget_ag ACTIF pour l'exercice", async () => {
    await expect(
      genererAppelDeFonds(ctxSyndicA(), {
        periode: "2026-01",
        type: "CHARGES_COURANTES",
        montant_total: "1000.00",
        date_echeance: "2026-01-05",
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("un rôle non autorisé (PROPRIETAIRE) ne peut pas générer un appel de fonds", async () => {
    await admin.budgetAg.create({
      data: { coproprieteId: coproA, exercice: "2026", montantTotal: "12000.00", statut: "ACTIF" },
    });
    await expect(
      genererAppelDeFonds(ctxAlice(), {
        periode: "2026-02",
        type: "CHARGES_COURANTES",
        montant_total: "1000.00",
        date_echeance: "2026-02-05",
      })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("répartit au prorata des tantièmes, somme des lignes == montant_total à la centime près", async () => {
    const appel = await genererAppelDeFonds(ctxSyndicA(), {
      periode: "2026-03",
      type: "CHARGES_COURANTES",
      montant_total: "1000.01",
      date_echeance: "2026-03-05",
    });
    expect(appel.statut).toBe("EMIS");
    expect(appel.lignes).toHaveLength(2);
    const somme = appel.lignes.reduce((acc, l) => acc + Number(l.montantDu), 0);
    expect(somme.toFixed(2)).toBe("1000.01");

    const ligneA1 = appel.lignes.find((l) => l.lotId === lotA1)!;
    expect(ligneA1.montantDu.toString()).toBe("600.01"); // 60% + écart d'arrondi absorbé ici
  });

  it("rejette (409/ConflitIdempotenceError) une même (période, type) déjà générée", async () => {
    await expect(
      genererAppelDeFonds(ctxSyndicA(), {
        periode: "2026-03",
        type: "CHARGES_COURANTES",
        montant_total: "500.00",
        date_echeance: "2026-03-05",
      })
    ).rejects.toBeInstanceOf(ConflitIdempotenceError);
  });
});

describe("Solde de lot et paiements (Doc A §3.4)", () => {
  it("le solde initial du lot == montant_du de la ligne générée", async () => {
    const solde = await obtenirSoldeLot(ctxSyndicA(), lotA1);
    expect(solde.solde_du).toBe("600.01");
    expect(solde.lignes).toHaveLength(1);
  });

  it("un paiement partiel met à jour montant_paye/statut sans générer de quittance", async () => {
    const solde = await obtenirSoldeLot(ctxSyndicA(), lotA1);
    const ligneId = solde.lignes[0]!.appel_de_fonds_lot_id;

    const resultat = await enregistrerPaiementManuel(ctxSyndicA(), {
      appel_de_fonds_lot_id: ligneId,
      montant: "300.00",
      methode: "VIREMENT",
      accepter_trop_percu: false,
    });
    expect(resultat.statut).toBe("PARTIEL");
    expect(resultat.quittance).toBeNull();
  });

  it("un paiement qui dépasserait montant_du est rejeté sans accepter_trop_percu (ContrainteMetierError)", async () => {
    const solde = await obtenirSoldeLot(ctxSyndicA(), lotA1);
    const ligneId = solde.lignes[0]!.appel_de_fonds_lot_id;
    await expect(
      enregistrerPaiementManuel(ctxSyndicA(), {
        appel_de_fonds_lot_id: ligneId,
        montant: "1000.00",
        methode: "VIREMENT",
        accepter_trop_percu: false,
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("le paiement du solde restant complète la ligne (PAYE) et génère une quittance", async () => {
    const solde = await obtenirSoldeLot(ctxSyndicA(), lotA1);
    const ligne = solde.lignes[0]!;
    const restant = ligne.montant_du; // montant_du stocke le total, pas le restant — on paie le reste
    const resultat = await enregistrerPaiementManuel(ctxSyndicA(), {
      appel_de_fonds_lot_id: ligne.appel_de_fonds_lot_id,
      montant: "300.01",
      methode: "ESPECES",
      accepter_trop_percu: false,
    });
    expect(resultat.statut).toBe("PAYE");
    expect(resultat.quittance).not.toBeNull();
    expect(resultat.quittance?.numero).toContain("QT-");
    void restant;
  });

  it("un rôle non autorisé (PROPRIETAIRE) ne peut pas enregistrer un paiement manuel", async () => {
    const solde = await obtenirSoldeLot(ctxSyndicA(), lotA2);
    // lotA2 n'a pas d'appel généré — on utilise lotA1 pour un id de ligne existant à la place.
    const soldeA1 = await obtenirSoldeLot(ctxSyndicA(), lotA1);
    void solde;
    await expect(
      enregistrerPaiementManuel(ctxAlice(), {
        appel_de_fonds_lot_id: soldeA1.lignes[0]!.appel_de_fonds_lot_id,
        montant: "1.00",
        methode: "ESPECES",
        accepter_trop_percu: true,
      })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("Webhook CMI — idempotence (Master Spec Partie 6.4 étape 5)", () => {
  it("initierPaiementCmi retourne un oid signé, et un rejeu exact du webhook ne crée qu'un seul paiement", async () => {
    // Nouvel appel de fonds dédié pour ce test (isolation des soldes).
    const appel = await genererAppelDeFonds(ctxSyndicA(), {
      periode: "2026-04",
      type: "CHARGES_COURANTES",
      montant_total: "200.00",
      date_echeance: "2026-04-05",
    });
    const ligneA1 = appel.lignes.find((l) => l.lotId === lotA1)!;

    const session = await initierPaiementCmi(ctxSyndicA(), {
      appel_de_fonds_lot_id: ligneA1.id,
      montant: ligneA1.montantDu.toString(),
    });
    expect(session.oid).toContain(ligneA1.id);

    const premier = await traiterWebhookCmi({
      oid: session.oid,
      montant: session.montant,
      hash: session.hash,
    });
    expect(premier.statut).toBe("PAYE");

    // Rejeu exact du même callback : idempotence stricte sur reference_cmi (unique).
    await expect(
      traiterWebhookCmi({ oid: session.oid, montant: session.montant, hash: session.hash })
    ).rejects.toBeInstanceOf(ConflitIdempotenceError);

    const paiements = await admin.paiement.findMany({ where: { referenceCmi: session.oid } });
    expect(paiements).toHaveLength(1);
  });

  it("rejette un webhook avec une signature invalide", async () => {
    await expect(
      traiterWebhookCmi({ oid: `${lotA1}.fake`, montant: "10.00", hash: "invalide" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("Contestation de charge (Doc A §3.3)", () => {
  it("un propriétaire peut contester une ligne, ce qui flag conteste=true", async () => {
    const solde = await obtenirSoldeLot(ctxSyndicA(), lotA1);
    const ligneId = solde.lignes[solde.lignes.length - 1]!.appel_de_fonds_lot_id;
    const contestation = await creerContestation(ctxAlice(), {
      appel_de_fonds_lot_id: ligneId,
      motif: "Montant incorrect selon mon décompte.",
    });
    expect(contestation.statut).toBe("OUVERTE");

    const ligne = await admin.appelDeFondsLot.findUnique({ where: { id: ligneId } });
    expect(ligne?.conteste).toBe(true);
  });

  it("le syndic ne peut pas contester (rôle réservé aux résidents concernés)", async () => {
    const solde = await obtenirSoldeLot(ctxSyndicA(), lotA1);
    await expect(
      creerContestation(ctxSyndicA(), {
        appel_de_fonds_lot_id: solde.lignes[0]!.appel_de_fonds_lot_id,
        motif: "Test",
      })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("Validation Zod des payloads finances (CLAUDE.md §1.5)", () => {
  it("rejette une période mal formée", () => {
    const result = appelDeFondsGenererSchema.safeParse({
      periode: "2026-13",
      type: "CHARGES_COURANTES",
      montant_total: "100.00",
      date_echeance: "2026-01-05",
    });
    expect(result.success).toBe(false);
  });

  it("accepte un payload de génération valide", () => {
    const result = appelDeFondsGenererSchema.safeParse({
      periode: "2026-05",
      type: "EXCEPTIONNEL",
      montant_total: "5000.00",
      date_echeance: "2026-05-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un montant de paiement non décimal", () => {
    const result = paiementManuelCreateSchema.safeParse({
      appel_de_fonds_lot_id: "00000000-0000-0000-0000-000000000000",
      montant: "abc",
      methode: "ESPECES",
    });
    expect(result.success).toBe(false);
  });
});
