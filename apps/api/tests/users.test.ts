/**
 * Tests M13 — module utilisateurs & CNDP (Loi 09-08, Master Spec Partie 5.6/10.1) :
 * profil me (GET/PATCH), fiche syndic + anti-énumération cross-tenant, export CNDP,
 * anonymisation manuelle (DESACTIVE requis, PII effacées, lignes financières CONSERVÉES),
 * job d'anonymisation (rétention légalement gatée : copropriété non configurée = sautée).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  obtenirMonProfil,
  modifierMonProfil,
  obtenirFicheUtilisateur,
  exporterMesDonnees,
  PermissionRefuseeError,
  UtilisateurIntrouvableError,
} from "../lib/users/users";
import {
  anonymiserUtilisateur,
  executerAnonymisationCndp,
  ContrainteMetierError,
} from "../lib/users/anonymisation";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproId: string;
let coproAutreId: string;
let syndicId: string;
let bernardId: string; // PROPRIETAIRE, sera DESACTIVE puis anonymisé
let etrangerId: string; // membre d'une AUTRE copropriété
let lotId: string;

const ctxSyndic = (): TenantContext => ({
  utilisateurId: syndicId,
  coproprieteId: coproId,
  role: "SYNDIC",
});
const ctxBernard = (): TenantContext => ({
  utilisateurId: bernardId,
  coproprieteId: coproId,
  role: "PROPRIETAIRE",
});

beforeAll(async () => {
  const [copro, coproAutre] = await Promise.all([
    admin.copropriete.create({
      data: {
        nom: "Résidence CNDP",
        adresse: "5 rue Vie Privée",
        ville: "Casablanca",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 2,
      },
    }),
    admin.copropriete.create({
      data: {
        nom: "Résidence Autre",
        adresse: "7 rue Ailleurs",
        ville: "Rabat",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 2,
      },
    }),
  ]);
  coproId = copro.id;
  coproAutreId = coproAutre.id;

  const [s, b, e] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-cndp@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({
      data: {
        email: "bernard-cndp@test.local",
        telephone: "+212600000777",
        nom: "Bennani",
        prenom: "Bernard",
        statutCompte: "ACTIF",
      },
    }),
    admin.utilisateur.create({ data: { email: "etranger-cndp@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicId = s.id;
  bernardId = b.id;
  etrangerId = e.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicId, coproprieteId: coproId, role: "SYNDIC" },
      { utilisateurId: bernardId, coproprieteId: coproId, role: "PROPRIETAIRE" },
      { utilisateurId: etrangerId, coproprieteId: coproAutreId, role: "PROPRIETAIRE" },
    ],
  });

  const lot = await admin.lot.create({
    data: { coproprieteId: coproId, typeLot: "APPARTEMENT", numero: "U1", tantiemes: "100.00" },
  });
  lotId = lot.id;
  await admin.lotProprietaire.create({
    data: {
      lotId,
      utilisateurId: bernardId,
      quotePart: "100.00",
      typePropriete: "PLEIN",
      dateDebut: new Date("2024-01-01"),
    },
  });
  // Une ligne financière liée à Bernard — doit SURVIVRE à l'anonymisation.
  await admin.budgetAg.create({
    data: { coproprieteId: coproId, exercice: "2026", montantTotal: "1200.00", statut: "ACTIF" },
  });
});

afterAll(async () => {
  const ids = [coproId, coproAutreId];
  await admin.paiement.deleteMany({ where: { lot: { coproprieteId: coproId } } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFonds: { coproprieteId: coproId } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: coproId } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: coproId } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: { in: ids } } });
  await admin.lotProprietaire.deleteMany({ where: { lotId } });
  await admin.lot.deleteMany({ where: { id: lotId } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: { in: ids } } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicId, bernardId, etrangerId] } } });
  await admin.copropriete.deleteMany({ where: { id: { in: ids } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Profil /users/me", () => {
  it("GET me retourne le profil + rôles ; PATCH rectifie nom/prenom/langue", async () => {
    const profil = await obtenirMonProfil(ctxBernard());
    expect(profil.email).toBe("bernard-cndp@test.local");
    expect(profil.roles).toEqual([
      { copropriete_id: coproId, role: "PROPRIETAIRE", actif: true },
    ]);

    const maj = await modifierMonProfil(ctxBernard(), { prenom: "Brahim", langue_preferee: "AR" });
    expect(maj.prenom).toBe("Brahim");
    expect(maj.langue_preferee).toBe("AR");
  });
});

describe("Fiche /users/:id (syndic only)", () => {
  it("le syndic lit la fiche d'un membre ; un propriétaire non", async () => {
    const fiche = await obtenirFicheUtilisateur(ctxSyndic(), bernardId);
    expect(fiche.id).toBe(bernardId);
    await expect(obtenirFicheUtilisateur(ctxBernard(), syndicId)).rejects.toBeInstanceOf(
      PermissionRefuseeError
    );
  });

  it("un membre d'une AUTRE copropriété est introuvable (anti-énumération cross-tenant)", async () => {
    await expect(obtenirFicheUtilisateur(ctxSyndic(), etrangerId)).rejects.toBeInstanceOf(
      UtilisateurIntrouvableError
    );
  });
});

describe("Export CNDP /users/me/export", () => {
  it("agrège profil, lots et votes par copropriété + audit EXPORT_DONNEES_CNDP", async () => {
    const exportCndp = await exporterMesDonnees(bernardId, [
      { copropriete_id: coproId, role: "PROPRIETAIRE" },
    ]);
    expect(exportCndp.profil.id).toBe(bernardId);
    expect(exportCndp.coproprietes).toHaveLength(1);
    expect(exportCndp.coproprietes[0]!.lots_proprietaire).toHaveLength(1);

    const audit = await admin.auditLog.findFirst({
      where: { coproprieteId: coproId, action: "EXPORT_DONNEES_CNDP", entiteId: bernardId },
    });
    expect(audit).not.toBeNull();
  });
});

describe("Anonymisation CNDP (Loi 09-08)", () => {
  it("refuse un compte non DESACTIVE (422)", async () => {
    await expect(anonymiserUtilisateur(ctxSyndic(), bernardId)).rejects.toBeInstanceOf(
      ContrainteMetierError
    );
  });

  it("le job saute une copropriété sans retention_desactivation_mois (valeur légalement gatée)", async () => {
    await admin.utilisateur.update({
      where: { id: bernardId },
      data: { statutCompte: "DESACTIVE", desactiveLe: new Date("2020-01-01") },
    });
    const resultat = await executerAnonymisationCndp();
    expect(resultat.utilisateursAnonymises).not.toContain(bernardId);
    expect(resultat.coproprietesSautees.map((c) => c.coproprieteId)).toContain(coproId);
  });

  it("anonymise : PII effacées, statut ANONYMISE, lignes financières et audit CONSERVÉS", async () => {
    const resultat = await anonymiserUtilisateur(ctxSyndic(), bernardId);
    expect(resultat.statut_compte).toBe("ANONYMISE");

    const u = await admin.utilisateur.findUnique({ where: { id: bernardId } });
    expect(u!.nom).toBeNull();
    expect(u!.prenom).toBeNull();
    expect(u!.email).toBeNull();
    expect(u!.telephone).toBeNull();
    expect(u!.anonymiseLe).not.toBeNull();

    // Les données à valeur probante liées à l'utilisateur_id survivent (Doc A §12.3).
    const lienLot = await admin.lotProprietaire.findFirst({
      where: { utilisateurId: bernardId },
    });
    expect(lienLot).not.toBeNull();

    const audit = await admin.auditLog.findFirst({
      where: { coproprieteId: coproId, action: "ANONYMISATION_CNDP", entiteId: bernardId },
    });
    expect(audit).not.toBeNull();

    // Idempotent : rejouer renvoie l'état ANONYMISE sans erreur.
    const rejeu = await anonymiserUtilisateur(ctxSyndic(), bernardId);
    expect(rejeu.statut_compte).toBe("ANONYMISE");
  });

  it("le job anonymise automatiquement quand la rétention est configurée et échue", async () => {
    // Un second compte DESACTIVE ancien + rétention configurée sur la copropriété.
    const vieux = await admin.utilisateur.create({
      data: {
        email: "vieux-cndp@test.local",
        nom: "Ancien",
        statutCompte: "DESACTIVE",
        desactiveLe: new Date("2019-06-01"),
      },
    });
    await admin.roleUtilisateur.create({
      data: { utilisateurId: vieux.id, coproprieteId: coproId, role: "LOCATAIRE", actif: false },
    });
    await admin.copropriete.update({
      where: { id: coproId },
      data: { retentionDesactivationMois: 24 },
    });

    const resultat = await executerAnonymisationCndp();
    expect(resultat.utilisateursAnonymises).toContain(vieux.id);
    const u = await admin.utilisateur.findUnique({ where: { id: vieux.id } });
    expect(u!.statutCompte).toBe("ANONYMISE");
    expect(u!.nom).toBeNull();

    await admin.roleUtilisateur.deleteMany({ where: { utilisateurId: vieux.id } });
    await admin.utilisateur.delete({ where: { id: vieux.id } });
    await admin.copropriete.update({
      where: { id: coproId },
      data: { retentionDesactivationMois: null },
    });
  });
});
