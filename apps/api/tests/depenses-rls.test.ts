/**
 * Tests de sécurité M16 (dépenses) — couche RLS + triggers seuls, indépendamment des services :
 *  - syndic / conseil syndical lisent toutes les dépenses, factures, postes et journaux ;
 *  - un PROPRIETAIRE / LOCATAIRE ne lit que les dépenses PAYEE (jamais un brouillon ni une dépense
 *    en approbation), aucune facture, aucun journal ; il ne peut ni créer ni modifier une dépense ;
 *  - gardien et prestataire ne voient rien ; une autre copropriété ne voit rien, même avec un id forgé ;
 *  - depense_log est append-only : UPDATE / DELETE échouent au niveau base, même pour le syndic ;
 *  - trigger budget_ag.montant_total = Σ budget_poste.montant_prevu ;
 *  - trigger fonds_reserve : solde jamais négatif, signe des mouvements contrôlé.
 *
 * Prérequis : Supabase local + migration `..._m16_depenses` + rôle app_local.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproA: string;
let coproB: string;
let syndicA: string;
let conseilA: string;
let alice: string; // PROPRIETAIRE lot A1
let locataireA: string; // LOCATAIRE lot A1
let gardienA: string;
let carol: string; // PROPRIETAIRE dans B
let lotA1: string;
let budgetA: string;
let posteA: string;
let depBrouillon: string;
let depAApprouver: string;
let depPayee: string;
let factureId: string;
let docId: string;
let logId: string;
let fondsA: string;

const ctx = (utilisateurId: string, role: TenantContext["role"], coproprieteId = coproA): TenantContext => ({
  utilisateurId,
  coproprieteId,
  role,
});

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.copropriete.create({
      data: { nom: "Résidence Dépenses A", adresse: "1 rue Dép", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 4 },
    }),
    admin.copropriete.create({
      data: { nom: "Résidence Dépenses B", adresse: "2 rue Dép", ville: "Rabat", typeResidence: "RESIDENCE_FERMEE", nbLots: 4 },
    }),
  ]);
  coproA = a.id;
  coproB = b.id;
  const users = await Promise.all(
    ["syndic", "conseil", "alice", "loc", "gardien", "carol"].map((n) =>
      admin.utilisateur.create({ data: { email: `${n}-dep-rls@test.local`, statutCompte: "ACTIF" } })
    )
  );
  [syndicA, conseilA, alice, locataireA, gardienA, carol] = users.map((u) => u.id) as [string, string, string, string, string, string];
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: conseilA, coproprieteId: coproA, role: "CONSEIL_SYNDICAL" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: locataireA, coproprieteId: coproA, role: "LOCATAIRE" },
      { utilisateurId: gardienA, coproprieteId: coproA, role: "GARDIEN" },
      { utilisateurId: carol, coproprieteId: coproB, role: "PROPRIETAIRE" },
    ],
  });
  const l1 = await admin.lot.create({ data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "100.00" } });
  lotA1 = l1.id;
  await admin.lotProprietaire.create({
    data: { lotId: lotA1, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  });
  await admin.lotOccupant.create({
    data: { lotId: lotA1, utilisateurId: locataireA, typeOccupation: "LOCATAIRE", dateDebut: new Date("2025-01-01") },
  });
  const budget = await admin.budgetAg.create({ data: { coproprieteId: coproA, exercice: "2031", montantTotal: "0.00", statut: "ACTIF" } });
  budgetA = budget.id;
  const poste = await admin.budgetPoste.create({
    data: { budgetAgId: budgetA, categorie: "ENTRETIEN_COURANT", libelle: "Nettoyage", montantPrevu: "1200.00", ordre: 1 },
  });
  posteA = poste.id;
  const base = { coproprieteId: coproA, budgetAgId: budgetA, budgetPosteId: posteA, creeParId: syndicA, dateDepense: new Date("2031-01-15") } as const;
  const [d1, d2, d3] = await Promise.all([
    admin.depense.create({ data: { ...base, categorie: "ENTRETIEN_COURANT", libelle: "Brouillon", montantTtc: "100.00", statut: "BROUILLON" } }),
    admin.depense.create({ data: { ...base, categorie: "ENTRETIEN_COURANT", libelle: "À approuver", montantTtc: "200.00", statut: "A_APPROUVER" } }),
    admin.depense.create({
      data: { ...base, categorie: "ENTRETIEN_COURANT", libelle: "Payée", montantTtc: "300.00", statut: "PAYEE", payeLe: new Date("2031-01-20"), methodePaiement: "VIREMENT" },
    }),
  ]);
  depBrouillon = d1.id;
  depAApprouver = d2.id;
  depPayee = d3.id;
  const doc = await admin.document.create({
    data: { coproprieteId: coproA, type: "FACTURE", nom: "facture.pdf", visibilite: "CONSEIL_SYNDICAL", storagePath: `${coproA}/depenses/facture.pdf`, creePar: syndicA },
  });
  docId = doc.id;
  const f = await admin.facture.create({
    data: { depenseId: depPayee, numero: "F-1", dateFacture: new Date("2031-01-10"), montantTtc: "300.00", statut: "REGLEE", documentId: docId },
  });
  factureId = f.id;
  const log = await admin.depenseLog.create({ data: { coproprieteId: coproA, depenseId: depPayee, type: "PAYEE", acteurId: syndicA } });
  logId = log.id;
  const fonds = await admin.fondsReserve.create({ data: { coproprieteId: coproA } });
  fondsA = fonds.id;
  await admin.fondsReserveMouvement.create({ data: { fondsReserveId: fondsA, type: "COTISATION", montant: "500.00" } });
});

afterAll(async () => {
  await admin.fondsReserveMouvement.deleteMany({ where: { fondsReserveId: fondsA } });
  await admin.fondsReserve.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.depenseLog.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.facture.deleteMany({ where: { depense: { coproprieteId: { in: [coproA, coproB] } } } });
  await admin.depense.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.document.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.budgetPoste.deleteMany({ where: { budgetAg: { coproprieteId: { in: [coproA, coproB] } } } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.lotOccupant.deleteMany({ where: { lotId: lotA1 } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: lotA1 } });
  await admin.lot.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-dep-rls@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: { in: [coproA, coproB] } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("RLS M16 — dépenses, factures, postes, journal", () => {
  it("syndic et conseil syndical lisent toutes les dépenses, la facture et le journal", async () => {
    for (const role of ["SYNDIC", "CONSEIL_SYNDICAL"] as const) {
      const u = role === "SYNDIC" ? syndicA : conseilA;
      const deps = await withTenant(ctx(u, role), (db) => db.depense.findMany({ where: { coproprieteId: coproA } }));
      expect(deps.map((d) => d.id).sort()).toEqual([depBrouillon, depAApprouver, depPayee].sort());
      const factures = await withTenant(ctx(u, role), (db) => db.facture.findMany());
      expect(factures.map((f) => f.id)).toEqual([factureId]);
      const logs = await withTenant(ctx(u, role), (db) => db.depenseLog.findMany());
      expect(logs.map((l) => l.id)).toEqual([logId]);
    }
  });

  it("un propriétaire et un locataire ne lisent que les dépenses PAYEE — jamais brouillon ni en approbation", async () => {
    for (const [u, role] of [[alice, "PROPRIETAIRE"], [locataireA, "LOCATAIRE"]] as const) {
      const deps = await withTenant(ctx(u, role), (db) => db.depense.findMany());
      expect(deps.map((d) => d.id)).toEqual([depPayee]);
      const brouillon = await withTenant(ctx(u, role), (db) => db.depense.findUnique({ where: { id: depBrouillon } }));
      expect(brouillon).toBeNull();
      const enApprobation = await withTenant(ctx(u, role), (db) => db.depense.findUnique({ where: { id: depAApprouver } }));
      expect(enApprobation).toBeNull();
      // Factures et journal : rien pour un résident (visibilité résident des factures = paramètre M18).
      expect(await withTenant(ctx(u, role), (db) => db.facture.findMany())).toEqual([]);
      expect(await withTenant(ctx(u, role), (db) => db.depenseLog.findMany())).toEqual([]);
    }
  });

  it("les postes budgétaires sont visibles de tout membre du tenant (transparence), pas d'une autre copropriété", async () => {
    const postes = await withTenant(ctx(alice, "PROPRIETAIRE"), (db) => db.budgetPoste.findMany());
    expect(postes.map((p) => p.id)).toEqual([posteA]);
    const autre = await withTenant(ctx(carol, "PROPRIETAIRE", coproB), (db) => db.budgetPoste.findUnique({ where: { id: posteA } }));
    expect(autre).toBeNull();
  });

  it("gardien, prestataire et autre copropriété ne voient aucune dépense, même avec un id forgé", async () => {
    expect(await withTenant(ctx(gardienA, "GARDIEN"), (db) => db.depense.findMany())).toEqual([]);
    expect(await withTenant(ctx(gardienA, "PRESTATAIRE"), (db) => db.depense.findMany())).toEqual([]);
    const forge = await withTenant(ctx(carol, "PROPRIETAIRE", coproB), (db) => db.depense.findUnique({ where: { id: depPayee } }));
    expect(forge).toBeNull();
    // Le syndic de B, même en forgeant l'id, ne lit pas une dépense de A.
    const syndicB = await withTenant(ctx(carol, "SYNDIC", coproB), (db) => db.depense.findUnique({ where: { id: depPayee } }));
    expect(syndicB).toBeNull();
  });

  it("un propriétaire ne peut ni créer ni modifier une dépense (WITH CHECK)", async () => {
    await expect(
      withTenant(ctx(alice, "PROPRIETAIRE"), (db) =>
        db.depense.create({
          data: { coproprieteId: coproA, categorie: "AUTRE", libelle: "Forgée", montantTtc: "10.00", dateDepense: new Date("2031-02-01"), creeParId: alice },
        })
      )
    ).rejects.toThrow();
    // UPDATE d'une ligne visible (PAYEE) : le WITH CHECK réservé syndic/conseil rejette la nouvelle ligne.
    await expect(
      withTenant(ctx(alice, "PROPRIETAIRE"), (db) =>
        db.depense.updateMany({ where: { id: depPayee }, data: { libelle: "Modifiée par un résident" } })
      )
    ).rejects.toThrow(/row-level security/);
  });

  it("depense_log est append-only : UPDATE et DELETE échouent au niveau base, même pour le syndic", async () => {
    await expect(
      withTenant(ctx(syndicA, "SYNDIC"), (db) => db.$executeRaw`UPDATE "depense_log" SET "type" = 'ANNULEE' WHERE id = ${logId}::uuid`)
    ).rejects.toThrow(/permission denied|denied/i);
    await expect(
      withTenant(ctx(syndicA, "SYNDIC"), (db) => db.$executeRaw`DELETE FROM "depense_log" WHERE id = ${logId}::uuid`)
    ).rejects.toThrow(/permission denied|denied/i);
    // Le syndic peut toujours AJOUTER une ligne (INSERT sans RETURNING — même précaution que sejour_evenement).
    const n = await withTenant(ctx(syndicA, "SYNDIC"), (db) =>
      db.depenseLog.createMany({ data: [{ coproprieteId: coproA, depenseId: depPayee, type: "MODIFIEE", acteurId: syndicA }] })
    );
    expect(n.count).toBe(1);
  });

  it("trigger : budget_ag.montant_total suit Σ budget_poste.montant_prevu à l'insertion, la modification et la suppression", async () => {
    const avant = await admin.budgetAg.findUniqueOrThrow({ where: { id: budgetA } });
    expect(avant.montantTotal.toString()).toBe("1200");
    const p2 = await withTenant(ctx(syndicA, "SYNDIC"), (db) =>
      db.budgetPoste.create({ data: { budgetAgId: budgetA, categorie: "ASSURANCE", libelle: "Assurance", montantPrevu: "800.50", ordre: 2 } })
    );
    expect((await admin.budgetAg.findUniqueOrThrow({ where: { id: budgetA } })).montantTotal.toString()).toBe("2000.5");
    await withTenant(ctx(syndicA, "SYNDIC"), (db) => db.budgetPoste.update({ where: { id: p2.id }, data: { montantPrevu: "300.00" } }));
    expect((await admin.budgetAg.findUniqueOrThrow({ where: { id: budgetA } })).montantTotal.toString()).toBe("1500");
    await withTenant(ctx(syndicA, "SYNDIC"), (db) => db.budgetPoste.delete({ where: { id: p2.id } }));
    expect((await admin.budgetAg.findUniqueOrThrow({ where: { id: budgetA } })).montantTotal.toString()).toBe("1200");
  });

  it("trigger fonds de réserve : le solde ne peut jamais devenir négatif et le signe suit le type", async () => {
    // Solde 500 : un décaissement de 600 est refusé au niveau base (même sans passer par le service).
    await expect(
      withTenant(ctx(syndicA, "SYNDIC"), (db) =>
        db.fondsReserveMouvement.createMany({ data: [{ fondsReserveId: fondsA, type: "DEPENSE", montant: "-600.00", description: "Trop" }] })
      )
    ).rejects.toThrow(/FONDS_RESERVE_INSUFFISANT/);
    // Une DEPENSE positive ou une COTISATION négative violent la contrainte de signe.
    await expect(
      withTenant(ctx(syndicA, "SYNDIC"), (db) =>
        db.fondsReserveMouvement.createMany({ data: [{ fondsReserveId: fondsA, type: "DEPENSE", montant: "100.00" }] })
      )
    ).rejects.toThrow();
    // Un décaissement couvert passe, et le solde est bien recalculé.
    await withTenant(ctx(syndicA, "SYNDIC"), (db) =>
      db.fondsReserveMouvement.createMany({ data: [{ fondsReserveId: fondsA, type: "DEPENSE", montant: "-200.00", depenseId: depPayee }] })
    );
    const solde = await admin.fondsReserveMouvement.aggregate({ where: { fondsReserveId: fondsA }, _sum: { montant: true } });
    expect(solde._sum.montant?.toString()).toBe("300");
    // Le conseil syndical lit le grand livre de la réserve ; un propriétaire non (policy M5 inchangée).
    expect((await withTenant(ctx(conseilA, "CONSEIL_SYNDICAL"), (db) => db.fondsReserveMouvement.findMany())).length).toBe(2);
    expect(await withTenant(ctx(alice, "PROPRIETAIRE"), (db) => db.fondsReserveMouvement.findMany())).toEqual([]);
  });
});
