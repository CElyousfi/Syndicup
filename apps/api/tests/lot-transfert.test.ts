/**
 * Tests M4 (ROADMAP_BACKLOG.md) : mécanique du transfert de propriété (Master Spec Partie 5.4) —
 * fermeture de l'ancienne ligne lot_proprietaire, désactivation du role_utilisateur PROPRIETAIRE,
 * création de l'invitation, écriture audit_log. La vérification du solde de charges est câblée
 * sur le moteur M5 (étape 2 Partie 5.4) — voir apps/api/lib/lots/lots.ts::transfererPropriete.
 *
 * Prérequis : Supabase local démarré + migration `20260818190000_m4_transfert_propriete_audit_log`
 * appliquée + rôle app_local créé.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  transfererPropriete,
  PermissionRefuseeError,
  LotIntrouvableError,
  ContrainteMetierError,
} from "../lib/lots/lots";
import { lotTransfertProprieteSchema } from "../lib/lots/schemas";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let alice: string; // ancienne propriétaire
let bob: string; // co-indivisaire (pour le cas indivision)

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
      nom: "Résidence Transfert",
      adresse: "5 rue Vente",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 3,
    },
  });
  coproA = copro.id;

  const [us, ua, ub] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-transfert@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-transfert@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-transfert@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  bob = ub.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "INDIVISAIRE" },
    ],
  });
});

afterAll(async () => {
  await admin.appelDeFondsLot.deleteMany({ where: { lot: { coproprieteId: coproA } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: coproA } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.invitation.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lot: { coproprieteId: coproA } } });
  await admin.lot.deleteMany({ where: { coproprieteId: coproA } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice, bob] } } });
  await admin.copropriete.delete({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("transfererPropriete — mécanique (M4)", () => {
  it("un rôle non autorisé (PROPRIETAIRE) ne peut pas initier un transfert", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "V1", tantiemes: "100.00" },
    });
    await expect(
      transfererPropriete(ctxAlice(), lot.id, {
        nouveau_proprietaire: { email: "acheteur@test.local", telephone: null },
        dette_reprise_acquereur: false,
      })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
    await admin.lot.delete({ where: { id: lot.id } });
  });

  it("un lot introuvable renvoie LotIntrouvableError", async () => {
    await expect(
      transfererPropriete(ctxSyndicA(), "00000000-0000-0000-0000-000000000000", {
        nouveau_proprietaire: { email: "acheteur@test.local", telephone: null },
        dette_reprise_acquereur: false,
      })
    ).rejects.toBeInstanceOf(LotIntrouvableError);
  });

  it("un lot sans copropriétaire actif est rejeté (ContrainteMetierError)", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "V2", tantiemes: "100.00" },
    });
    await expect(
      transfererPropriete(ctxSyndicA(), lot.id, {
        nouveau_proprietaire: { email: "acheteur@test.local", telephone: null },
        dette_reprise_acquereur: false,
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
    await admin.lot.delete({ where: { id: lot.id } });
  });

  it("un lot en indivision (>1 copropriétaire actif) est rejeté (ContrainteMetierError)", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "V3", tantiemes: "100.00" },
    });
    await admin.lotProprietaire.createMany({
      data: [
        {
          lotId: lot.id,
          utilisateurId: alice,
          quotePart: "50.00",
          typePropriete: "INDIVISION",
          dateDebut: new Date("2024-01-01"),
        },
        {
          lotId: lot.id,
          utilisateurId: bob,
          quotePart: "50.00",
          typePropriete: "INDIVISION",
          dateDebut: new Date("2024-01-01"),
        },
      ],
    });
    await expect(
      transfererPropriete(ctxSyndicA(), lot.id, {
        nouveau_proprietaire: { email: "acheteur@test.local", telephone: null },
        dette_reprise_acquereur: false,
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
    await admin.lotProprietaire.deleteMany({ where: { lotId: lot.id } });
    await admin.lot.delete({ where: { id: lot.id } });
  });

  it("un transfert nominal (plein propriétaire unique) ferme l'ancienne ligne, désactive le rôle, crée l'invitation et l'audit_log", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "V4", tantiemes: "100.00" },
    });
    const ancienneLigne = await admin.lotProprietaire.create({
      data: {
        lotId: lot.id,
        utilisateurId: alice,
        quotePart: "100.00",
        typePropriete: "PLEIN",
        dateDebut: new Date("2024-01-01"),
      },
    });

    const invitation = await transfererPropriete(ctxSyndicA(), lot.id, {
      nouveau_proprietaire: { email: "acheteur-v4@test.local", telephone: null },
      dette_reprise_acquereur: true,
    });

    expect(invitation.roleCible).toBe("PROPRIETAIRE");
    expect(invitation.lotId).toBe(lot.id);
    expect(invitation.canal).toBe("EMAIL");

    const ligneFermee = await admin.lotProprietaire.findUnique({ where: { id: ancienneLigne.id } });
    expect(ligneFermee?.dateFin).not.toBeNull();

    const roleAlice = await admin.roleUtilisateur.findFirst({
      where: { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
    });
    expect(roleAlice?.actif).toBe(false);

    // Le compte GLOBAL d'Alice n'est PAS désactivé (interprétation documentée du service).
    const compteAlice = await admin.utilisateur.findUnique({ where: { id: alice } });
    expect(compteAlice?.statutCompte).toBe("ACTIF");

    const logs = await admin.auditLog.findMany({
      where: { entite: "lot", entiteId: lot.id, action: "LOT_TRANSFERT_PROPRIETE" },
    });
    expect(logs).toHaveLength(1);
    expect((logs[0]!.apresJson as Record<string, unknown>).solde_charges_verifie_automatiquement).toBe(true);
    expect((logs[0]!.apresJson as Record<string, unknown>).solde_du_au_transfert).toBe("0.00");

    await admin.roleUtilisateur.updateMany({
      where: { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      data: { actif: true },
    });
  });

  it("bloque le transfert d'un lot endetté sans attestation de reprise de dette (Partie 5.4 étape 2)", async () => {
    const lot = await admin.lot.create({
      data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "V5", tantiemes: "100.00" },
    });
    await admin.lotProprietaire.create({
      data: { lotId: lot.id, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    });
    const appel = await admin.appelDeFonds.create({
      data: {
        coproprieteId: coproA,
        periode: "2026-06",
        type: "CHARGES_COURANTES",
        montantTotal: "500.00",
        dateEcheance: new Date("2026-01-01"),
        statut: "EMIS",
      },
    });
    await admin.appelDeFondsLot.create({
      data: { appelDeFondsId: appel.id, lotId: lot.id, montantDu: "500.00", statut: "IMPAYE" },
    });

    await expect(
      transfererPropriete(ctxSyndicA(), lot.id, {
        nouveau_proprietaire: { email: "acheteur-v5@test.local", telephone: null },
        dette_reprise_acquereur: false,
      })
    ).rejects.toBeInstanceOf(ContrainteMetierError);

    // Avec attestation explicite de reprise de dette → le transfert passe, solde tracé.
    const invitation = await transfererPropriete(ctxSyndicA(), lot.id, {
      nouveau_proprietaire: { email: "acheteur-v5@test.local", telephone: null },
      dette_reprise_acquereur: true,
    });
    expect(invitation.lotId).toBe(lot.id);
    const log = await admin.auditLog.findFirst({
      where: { entite: "lot", entiteId: lot.id, action: "LOT_TRANSFERT_PROPRIETE" },
    });
    expect((log?.apresJson as Record<string, unknown>).solde_du_au_transfert).toBe("500.00");

    await admin.roleUtilisateur.updateMany({
      where: { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      data: { actif: true },
    });
  });
});

describe("Validation Zod du payload de transfert (CLAUDE.md §1.5)", () => {
  it("rejette un payload sans email ni telephone", () => {
    const result = lotTransfertProprieteSchema.safeParse({
      nouveau_proprietaire: {},
      dette_reprise_acquereur: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejette un payload sans dette_reprise_acquereur (pas de défaut silencieux)", () => {
    const result = lotTransfertProprieteSchema.safeParse({
      nouveau_proprietaire: { email: "x@test.local" },
    });
    expect(result.success).toBe(false);
  });

  it("accepte un payload valide", () => {
    const result = lotTransfertProprieteSchema.safeParse({
      nouveau_proprietaire: { email: "x@test.local" },
      dette_reprise_acquereur: false,
    });
    expect(result.success).toBe(true);
  });
});
