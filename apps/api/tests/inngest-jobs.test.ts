/**
 * Tests M12 — logique des jobs Inngest (le runtime Inngest n'est pas testé ici, seulement les
 * fonctions lib qu'il appelle) :
 *   - fan-out appel de fonds (matrice 7.1 "Propriétaires", idempotent sur rejeu) ;
 *   - rappels AG (CONVOQUEE dans l'horizon, idempotent).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import { notifierAppelDeFonds } from "../lib/finances/notifications-appels";
import { executerRappelsAg } from "../lib/ag/rappels";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproId: string;
let proprioId: string;
let lotId: string;
let appelId: string;
let agId: string;

beforeAll(async () => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true); // silencer les logs noop
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Jobs",
      adresse: "4 rue Cron",
      ville: "Tanger",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 1,
    },
  });
  coproId = copro.id;
  const proprio = await admin.utilisateur.create({
    data: { email: "proprio-jobs@test.local", statutCompte: "ACTIF" },
  });
  proprioId = proprio.id;
  await admin.roleUtilisateur.create({
    data: { utilisateurId: proprioId, coproprieteId: coproId, role: "PROPRIETAIRE" },
  });
  const lot = await admin.lot.create({
    data: { coproprieteId: coproId, typeLot: "APPARTEMENT", numero: "J1", tantiemes: "100.00" },
  });
  lotId = lot.id;
  await admin.lotProprietaire.create({
    data: {
      lotId,
      utilisateurId: proprioId,
      quotePart: "100.00",
      typePropriete: "PLEIN",
      dateDebut: new Date("2024-01-01"),
    },
  });
  const appel = await admin.appelDeFonds.create({
    data: {
      coproprieteId: coproId,
      periode: "2026-12",
      type: "CHARGES_COURANTES",
      montantTotal: "500.00",
      dateEcheance: new Date("2026-12-05"),
      statut: "EMIS",
      lignes: { create: [{ lotId, montantDu: "500.00" }] },
    },
  });
  appelId = appel.id;
  const ag = await admin.assembleeGenerale.create({
    data: {
      coproprieteId: coproId,
      type: "ORDINAIRE",
      dateAg: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // dans 2 jours (< horizon 3j)
      statut: "CONVOQUEE",
    },
  });
  agId = ag.id;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await admin.notification.deleteMany({ where: { coproprieteId: coproId } });
  await admin.assembleeGenerale.deleteMany({ where: { id: agId } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFondsId: appelId } });
  await admin.appelDeFonds.deleteMany({ where: { id: appelId } });
  await admin.lotProprietaire.deleteMany({ where: { lotId } });
  await admin.lot.deleteMany({ where: { id: lotId } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproId } });
  await admin.utilisateur.deleteMany({ where: { id: proprioId } });
  await admin.copropriete.deleteMany({ where: { id: coproId } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Fan-out appel de fonds (étape 5 Partie 6.2)", () => {
  it("notifie chaque propriétaire (EMAIL + PUSH) avec montant et échéance", async () => {
    const resultat = await notifierAppelDeFonds(coproId, appelId);
    expect(resultat).toEqual({ notifies: 1, saute: false });

    const notifs = await admin.notification.findMany({
      where: { coproprieteId: coproId, templateCode: "APPEL_DE_FONDS_EMIS" },
    });
    expect(notifs).toHaveLength(2); // EMAIL + PUSH
    expect(notifs.every((n) => n.utilisateurId === proprioId)).toBe(true);
    const contenu = notifs[0]!.contenuJson as Record<string, unknown>;
    expect(contenu.montant).toBe("500.00");
    expect(contenu.date_echeance).toBe("2026-12-05");
  });

  it("est idempotent : un rejeu ne renvoie rien (saute=true)", async () => {
    const rejeu = await notifierAppelDeFonds(coproId, appelId);
    expect(rejeu.saute).toBe(true);
    const notifs = await admin.notification.count({
      where: { coproprieteId: coproId, templateCode: "APPEL_DE_FONDS_EMIS" },
    });
    expect(notifs).toBe(2);
  });
});

describe("Rappels AG (job quotidien)", () => {
  it("rappelle une AG CONVOQUEE dans l'horizon, une seule fois", async () => {
    const resultats = await executerRappelsAg();
    const pourNotreAg = resultats.find((r) => r.agId === agId);
    expect(pourNotreAg).toBeDefined();
    expect(pourNotreAg!.notifies).toBe(1);

    // Idempotent : second passage → 0 nouveau rappel.
    const seconde = await executerRappelsAg();
    const rejeu = seconde.find((r) => r.agId === agId);
    expect(rejeu?.notifies ?? 0).toBe(0);

    const notifs = await admin.notification.count({
      where: { coproprieteId: coproId, templateCode: "AG_RAPPEL" },
    });
    expect(notifs).toBe(1);
  });
});
