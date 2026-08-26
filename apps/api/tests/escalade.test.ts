/**
 * Tests M5 — escalade des impayés N0→N6 (Doc A §3.3, Master Spec Partie 6.3).
 * Prérequis : Supabase local démarré.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import {
  DELAIS_ESCALADE_DEFAUT,
  delaisEffectifs,
  niveauCible,
  executerEscaladeImpayes,
} from "../lib/finances/escalade";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let alice: string;
let lotAlice: string;

const IL_Y_A_JOURS = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function creerLigneImpayee(params: {
  periode: string;
  joursRetard: number;
  conteste?: boolean;
}) {
  const appel = await admin.appelDeFonds.create({
    data: {
      coproprieteId: coproA,
      periode: params.periode,
      type: "CHARGES_COURANTES",
      montantTotal: "1000.00",
      dateEcheance: IL_Y_A_JOURS(params.joursRetard),
      statut: "EMIS",
    },
  });
  const ligne = await admin.appelDeFondsLot.create({
    data: {
      appelDeFondsId: appel.id,
      lotId: lotAlice,
      montantDu: "1000.00",
      statut: "IMPAYE",
      conteste: params.conteste ?? false,
    },
  });
  return ligne;
}

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Escalade",
      adresse: "1 rue des Impayés",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 1,
    },
  });
  coproA = copro.id;

  const [us, ua] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-esc@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-esc@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
    ],
  });

  const lot = await admin.lot.create({
    data: { coproprieteId: coproA, typeLot: "APPARTEMENT", numero: "ESC1", tantiemes: "100.00" },
  });
  lotAlice = lot.id;
  await admin.lotProprietaire.create({
    data: { lotId: lotAlice, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  });
});

afterAll(async () => {
  await admin.notification.deleteMany({ where: { coproprieteId: coproA } });
  await admin.appelDeFondsLot.deleteMany({ where: { lotId: lotAlice } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: coproA } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: lotAlice } });
  await admin.lot.deleteMany({ where: { id: lotAlice } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice] } } });
  await admin.copropriete.deleteMany({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Calculs purs (Doc A §3.3)", () => {
  it("niveauCible retourne le plus haut palier atteint", () => {
    expect(niveauCible(0, DELAIS_ESCALADE_DEFAUT)).toBe("N0");
    expect(niveauCible(3, DELAIS_ESCALADE_DEFAUT)).toBe("N1");
    expect(niveauCible(14, DELAIS_ESCALADE_DEFAUT)).toBe("N1");
    expect(niveauCible(20, DELAIS_ESCALADE_DEFAUT)).toBe("N2");
    expect(niveauCible(45, DELAIS_ESCALADE_DEFAUT)).toBe("N4");
    expect(niveauCible(365, DELAIS_ESCALADE_DEFAUT)).toBe("N6");
  });

  it("delaisEffectifs applique la surcharge politique_recouvrement_json et ignore les valeurs malformées", () => {
    const delais = delaisEffectifs({ N1: 10, N3: "abc", N6: -5 });
    expect(delais.N1).toBe(10);
    expect(delais.N3).toBe(DELAIS_ESCALADE_DEFAUT.N3);
    expect(delais.N6).toBe(DELAIS_ESCALADE_DEFAUT.N6);
  });
});

describe("Passe d'escalade (job système)", () => {
  it("escalade une ligne à J+20 vers N2 et notifie le copropriétaire ; réexécution idempotente", async () => {
    const ligne = await creerLigneImpayee({ periode: "2026-01", joursRetard: 20 });

    const resultat = await executerEscaladeImpayes(coproA);
    const escalade = resultat.escalades.find((e) => e.appelDeFondsLotId === ligne.id);
    expect(escalade?.de).toBe("N0");
    expect(escalade?.vers).toBe("N2");

    const majee = await admin.appelDeFondsLot.findUnique({ where: { id: ligne.id } });
    expect(majee?.niveauEscalade).toBe("N2");
    expect(majee?.derniereEscaladeLe).not.toBeNull();

    const notifs = await admin.notification.findMany({
      where: { utilisateurId: alice, templateCode: "IMPAYE_N2", contenuJson: { path: ["appel_de_fonds_lot_id"], equals: ligne.id } },
    });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]!.canal).toBe("EMAIL");

    // Idempotence : rejouer la passe le même jour ne renotifie pas le même palier.
    const rejeu = await executerEscaladeImpayes(coproA);
    expect(rejeu.escalades.find((e) => e.appelDeFondsLotId === ligne.id)).toBeUndefined();
    const notifsApresRejeu = await admin.notification.findMany({
      where: { utilisateurId: alice, templateCode: "IMPAYE_N2", contenuJson: { path: ["appel_de_fonds_lot_id"], equals: ligne.id } },
    });
    expect(notifsApresRejeu).toHaveLength(1);
  });

  it("à partir de N4 le syndic est alerté en plus du copropriétaire (Doc A §3.3 'Action manuelle syndic')", async () => {
    const ligne = await creerLigneImpayee({ periode: "2026-02", joursRetard: 50 });
    await executerEscaladeImpayes(coproA);

    const majee = await admin.appelDeFondsLot.findUnique({ where: { id: ligne.id } });
    expect(majee?.niveauEscalade).toBe("N4");

    const notifSyndic = await admin.notification.findFirst({
      where: { utilisateurId: syndicA, templateCode: "IMPAYE_N4_SYNDIC", contenuJson: { path: ["appel_de_fonds_lot_id"], equals: ligne.id } },
    });
    expect(notifSyndic?.statutEnvoi).toBe("ENVOYE");
  });

  it("une ligne contestée n'est pas escaladée (Doc A §3.3 Cas Particuliers — contestation en cours)", async () => {
    const ligne = await creerLigneImpayee({ periode: "2026-03", joursRetard: 40, conteste: true });
    await executerEscaladeImpayes(coproA);
    const inchangee = await admin.appelDeFondsLot.findUnique({ where: { id: ligne.id } });
    expect(inchangee?.niveauEscalade).toBe("N0");
  });

  it("l'audit_log trace chaque escalade avec acteur système (null)", async () => {
    const ligne = await creerLigneImpayee({ periode: "2026-04", joursRetard: 5 });
    await executerEscaladeImpayes(coproA);
    const log = await admin.auditLog.findFirst({
      where: { coproprieteId: coproA, action: "IMPAYE_ESCALADE", entiteId: ligne.id },
    });
    expect(log).not.toBeNull();
    expect(log?.acteurId).toBeNull();
    expect(log?.apresJson).toMatchObject({ niveau_escalade: "N1" });
  });

  it("la surcharge politique_recouvrement_json retarde l'escalade", async () => {
    await admin.copropriete.update({
      where: { id: coproA },
      data: { politiqueRecouvrementJson: { N1: 10 } },
    });
    const ligne = await creerLigneImpayee({ periode: "2026-05", joursRetard: 5 });
    await executerEscaladeImpayes(coproA);
    const inchangee = await admin.appelDeFondsLot.findUnique({ where: { id: ligne.id } });
    // 5 jours de retard < N1 surchargé à 10 jours → reste N0 (défaut Doc A aurait donné N1 à J+3).
    expect(inchangee?.niveauEscalade).toBe("N0");
    await admin.copropriete.update({
      where: { id: coproA },
      data: { politiqueRecouvrementJson: undefined },
    });
  });
});
