/**
 * Tests M12 — module copropriétés (Master Spec Partie 3.2) :
 * création super_admin only, listing depuis les claims, PATCH syndic (incl. params légaux
 * nullable — jamais de défaut), isolation cross-tenant, audit avant/après.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  listerCoproprietes,
  obtenirCopropriete,
  obtenirConfig,
  creerCopropriete,
  modifierCopropriete,
  preparerUploadPhoto,
  urlsPhotos,
  PermissionRefuseeError,
  CoproprieteIntrouvableError,
} from "../lib/coproprietes/coproprietes";
import { coproprieteUpdateSchema, photoUploadUrlSchema } from "../lib/coproprietes/schemas";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproA: string;
let coproB: string;
let superAdminId: string;
let syndicAId: string;
let creees: string[] = [];

const ctxSuper = (cible?: string): TenantContext => ({
  utilisateurId: superAdminId,
  coproprieteId: cible ?? coproA,
  role: "SUPER_ADMIN",
});
const ctxSyndicA = (): TenantContext => ({
  utilisateurId: syndicAId,
  coproprieteId: coproA,
  role: "SYNDIC",
});

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.copropriete.create({
      data: {
        nom: "Résidence Copro A",
        adresse: "1 rue A",
        ville: "Casablanca",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 4,
        configJson: { locataire_voit_pv: true },
      },
    }),
    admin.copropriete.create({
      data: {
        nom: "Résidence Copro B",
        adresse: "2 rue B",
        ville: "Rabat",
        typeResidence: "RESIDENCE_FERMEE",
        nbLots: 10,
      },
    }),
  ]);
  coproA = a.id;
  coproB = b.id;
  const [su, sy] = await Promise.all([
    admin.utilisateur.create({ data: { email: "super-cop@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "syndic-cop@test.local", statutCompte: "ACTIF" } }),
  ]);
  superAdminId = su.id;
  syndicAId = sy.id;
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: superAdminId, coproprieteId: coproA, role: "SUPER_ADMIN" },
      { utilisateurId: syndicAId, coproprieteId: coproA, role: "SYNDIC" },
    ],
  });
});

afterAll(async () => {
  const ids = [coproA, coproB, ...creees];
  await admin.auditLog.deleteMany({ where: { coproprieteId: { in: ids } } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: { in: ids } } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [superAdminId, syndicAId] } } });
  await admin.copropriete.deleteMany({ where: { id: { in: ids } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Création (super_admin only)", () => {
  it("le super_admin crée une copropriété avec id uuidv7 app-side + audit", async () => {
    const copro = await creerCopropriete(ctxSuper(), {
      nom: "Résidence Neuve",
      adresse: "9 bd Zerktouni",
      ville: "Casablanca",
      type_residence: "IMMEUBLE_MIXTE",
      nb_lots: 12,
    });
    creees.push(copro!.id);
    expect(copro!.statut).toBe("ACTIVE");
    const audit = await admin.auditLog.findFirst({
      where: { coproprieteId: copro!.id, action: "COPROPRIETE_CREEE" },
    });
    expect(audit).not.toBeNull();
  });

  it("un syndic ne peut pas créer de copropriété", async () => {
    await expect(
      creerCopropriete(ctxSyndicA(), {
        nom: "X",
        adresse: "X",
        ville: "X",
        type_residence: "IMMEUBLE_COLLECTIF",
        nb_lots: 1,
      })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("Lecture (claims JWT)", () => {
  it("un syndic ne liste que sa copropriété (claims), un super_admin les voit toutes", async () => {
    const vuesSyndic = await listerCoproprietes(syndicAId, [
      { copropriete_id: coproA, role: "SYNDIC" },
    ]);
    expect(vuesSyndic.map((c) => c!.id)).toEqual([coproA]);

    const vuesSuper = await listerCoproprietes(superAdminId, [
      { copropriete_id: coproA, role: "SUPER_ADMIN" },
    ]);
    const ids = vuesSuper.map((c) => c!.id);
    expect(ids).toContain(coproA);
    expect(ids).toContain(coproB);
  });

  it("un id hors du contexte tenant est introuvable (anti cross-tenant)", async () => {
    await expect(obtenirCopropriete(ctxSyndicA(), coproB)).rejects.toBeInstanceOf(
      CoproprieteIntrouvableError
    );
  });

  it("expose config_json via obtenirConfig", async () => {
    const config = await obtenirConfig(ctxSyndicA(), coproA);
    expect(config.config_json).toEqual({ locataire_voit_pv: true });
  });
});

describe("Modification (syndic, sa copropriété)", () => {
  it("PATCH syndic : params légaux configurables, audit avant/après", async () => {
    const maj = await modifierCopropriete(ctxSyndicA(), coproA, {
      delai_convocation_jours: 15,
      limite_procurations_mandataire: 3,
      total_tantiemes: "10000",
    });
    expect(maj.delaiConvocationJours).toBe(15);
    expect(maj.limiteProcurationsMandataire).toBe(3);

    const audit = await admin.auditLog.findFirst({
      where: { coproprieteId: coproA, action: "COPROPRIETE_MODIFIEE" },
      orderBy: { horodatage: "desc" },
    });
    expect(audit).not.toBeNull();
    expect((audit!.avantJson as Record<string, unknown>).delai_convocation_jours).toBeNull();
    expect((audit!.apresJson as Record<string, unknown>).delai_convocation_jours).toBe(15);

    // Retour à l'état non configuré (null explicite — le 422 AG redevient actif).
    const remisANull = await modifierCopropriete(ctxSyndicA(), coproA, {
      delai_convocation_jours: null,
      limite_procurations_mandataire: null,
      total_tantiemes: null,
    });
    expect(remisANull.delaiConvocationJours).toBeNull();
  });

  it("Zod : rejette un quorum hors ratio et un payload vide", () => {
    expect(
      coproprieteUpdateSchema.safeParse({ quorum_premiere_convocation: "1.5" }).success
    ).toBe(false);
    expect(coproprieteUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("Photos de la résidence (M20 — personnalisation par le syndic)", () => {
  it("Zod : emplacements connus (fixes + espace:<uuid>) et chemins branding uniquement", () => {
    const uuid = "11111111-2222-4333-8444-555555555555";
    expect(coproprieteUpdateSchema.safeParse({ photos_json: { accueil: `${uuid}/branding/photo-accueil-x.jpg` } }).success).toBe(true);
    expect(coproprieteUpdateSchema.safeParse({ photos_json: { [`espace:${uuid}`]: `${uuid}/branding/p.webp` } }).success).toBe(true);
    expect(coproprieteUpdateSchema.safeParse({ photos_json: { inconnu: `${uuid}/branding/p.jpg` } }).success).toBe(false);
    expect(coproprieteUpdateSchema.safeParse({ photos_json: { accueil: `${uuid}/documents/p.jpg` } }).success).toBe(false);
    expect(coproprieteUpdateSchema.safeParse({ photos_json: { accueil: "https://evil.example/p.jpg" } }).success).toBe(false);
    expect(photoUploadUrlSchema.safeParse({ cle: "salle", nom_fichier: "s.jpg", content_type: "image/jpeg" }).success).toBe(true);
    expect(photoUploadUrlSchema.safeParse({ cle: "salle", nom_fichier: "s.pdf", content_type: "application/pdf" }).success).toBe(false);
  });

  it("PATCH syndic : enregistre la carte, refuse un chemin hors périmètre, null retire tout", async () => {
    const chemin = `${coproA}/branding/photo-accueil-test.jpg`;
    const maj = await modifierCopropriete(ctxSyndicA(), coproA, { photos_json: { accueil: chemin } });
    expect(maj.photosJson).toEqual({ accueil: chemin });

    await expect(
      modifierCopropriete(ctxSyndicA(), coproA, { photos_json: { accueil: `${coproB}/branding/photo-accueil-x.jpg` } })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);

    const vide = await modifierCopropriete(ctxSyndicA(), coproA, { photos_json: null });
    expect(vide.photosJson).toBeNull();
    expect(await urlsPhotos(ctxSyndicA(), coproA)).toEqual({ photos: {} });
  });

  it("upload-url : réservé au syndic de la copropriété, chemin nommé par emplacement", async () => {
    await expect(
      preparerUploadPhoto({ utilisateurId: syndicAId, coproprieteId: coproA, role: "PROPRIETAIRE" }, coproA, { cle: "accueil", nom_fichier: "a.jpg", content_type: "image/jpeg" })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(
      preparerUploadPhoto(ctxSyndicA(), coproB, { cle: "accueil", nom_fichier: "a.jpg", content_type: "image/jpeg" })
    ).rejects.toBeInstanceOf(CoproprieteIntrouvableError);
  });
});
