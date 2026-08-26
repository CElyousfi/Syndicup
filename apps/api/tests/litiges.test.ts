/**
 * Tests M11 (ROADMAP_BACKLOG.md) : litiges — Master Spec Partie 2.2, Doc A §12.1.
 * Prérequis : Supabase local démarré + migration `20260824123000_m11_litiges`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerLitige,
  listerLitiges,
  escaladerLitige,
  resoudreLitige,
  PermissionRefuseeError,
  ContrainteMetierError,
} from "../lib/litiges/litiges";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let alice: string;
let bob: string;

const ctxSyndicA = (): TenantContext => ({ utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" });
const ctxAlice = (): TenantContext => ({ utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" });
const ctxBob = (): TenantContext => ({ utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" });

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Litiges",
      adresse: "1 rue du Tribunal",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 2,
    },
  });
  coproA = copro.id;

  const [us, ua, ub] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-lit@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-lit@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-lit@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  bob = ub.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" },
    ],
  });
});

afterAll(async () => {
  await admin.notification.deleteMany({ where: { coproprieteId: coproA } });
  await admin.conflitLitige.deleteMany({ where: { coproprieteId: coproA } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: coproA } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice, bob] } } });
  await admin.copropriete.deleteMany({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Déclaration & confidentialité (Doc A §12.1/§12.3)", () => {
  it("un résident déclare un litige (statut OUVERT, niveau 0)", async () => {
    const litige = await creerLitige(ctxAlice(), {
      type: "CONTESTATION_CHARGES",
      description: "Le montant du T1 me semble erroné.",
    });
    expect(litige.statut).toBe("OUVERT");
    expect(litige.escaladeNiveau).toBe(0);
    expect(litige.creePar).toBe(alice);
  });

  it("un résident ne voit que SES litiges, le syndic voit tout (RLS + scoped)", async () => {
    const litigeBob = await creerLitige(ctxBob(), {
      type: "NUISANCES",
      description: "Bruit nocturne récurrent.",
    });
    const vueAlice = await listerLitiges(ctxAlice());
    expect(vueAlice.map((l) => l.id)).not.toContain(litigeBob.id);
    const vueSyndic = await listerLitiges(ctxSyndicA());
    expect(vueSyndic.map((l) => l.id)).toContain(litigeBob.id);
  });
});

describe("Escalade (Doc A §12.1 : syndic → médiation AG → tribunal)", () => {
  it("un résident ne peut pas escalader lui-même", async () => {
    const litige = await creerLitige(ctxAlice(), { type: "FACADE", description: "Climatiseur non autorisé." });
    await expect(
      escaladerLitige(ctxAlice(), litige.id, { motif: "Je veux aller au tribunal." })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("le syndic escalade 0→1 (médiation AG) puis 1→2 (tribunal), puis plus rien ; le porteur est notifié", async () => {
    const litige = await creerLitige(ctxAlice(), { type: "TANTIEMES", description: "Tantièmes mal calculés." });

    const niveau1 = await escaladerLitige(ctxSyndicA(), litige.id, { motif: "Réponse insuffisante — médiation AG." });
    expect(niveau1.escaladeNiveau).toBe(1);
    const niveau2 = await escaladerLitige(ctxSyndicA(), litige.id, { motif: "Médiation échouée — tribunal." });
    expect(niveau2.escaladeNiveau).toBe(2);
    await expect(
      escaladerLitige(ctxSyndicA(), litige.id, { motif: "Encore plus haut ?" })
    ).rejects.toBeInstanceOf(ContrainteMetierError);

    const notifs = await admin.notification.findMany({
      where: { utilisateurId: alice, templateCode: "LITIGE_ESCALADE", contenuJson: { path: ["litige_id"], equals: litige.id } },
    });
    expect(notifs).toHaveLength(2);

    const logs = await admin.auditLog.findMany({
      where: { action: "LITIGE_ESCALADE", entiteId: litige.id },
    });
    expect(logs).toHaveLength(2);
  });
});

describe("Clôture (ajout nécessaire — Doc A §12.1 'Explication syndic suffit souvent')", () => {
  it("le syndic résout un litige avec motif ; escalade/re-clôture impossibles ensuite", async () => {
    const litige = await creerLitige(ctxAlice(), { type: "OCCUPATION_PARTIE_COMMUNE", description: "Débarras dans le couloir." });
    const resolu = await resoudreLitige(ctxSyndicA(), litige.id, {
      statut: "RESOLU",
      motif: "Enlèvement effectué par le résident.",
    });
    expect(resolu.statut).toBe("RESOLU");

    await expect(
      escaladerLitige(ctxSyndicA(), litige.id, { motif: "Trop tard." })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
    await expect(
      resoudreLitige(ctxSyndicA(), litige.id, { statut: "CLOS", motif: "Déjà résolu." })
    ).rejects.toBeInstanceOf(ContrainteMetierError);
  });

  it("un résident ne peut pas clôturer un litige", async () => {
    const litige = await creerLitige(ctxAlice(), { type: "AUTRE", description: "Divers." });
    await expect(
      resoudreLitige(ctxAlice(), litige.id, { statut: "RESOLU", motif: "Je retire ma plainte." })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});
