/**
 * Dari — intégration (Postgres de CI / Supabase local) :
 *  - repli des rôles en base quand la claim `roles` est ABSENTE du JWT (hook Supabase non activé) ;
 *    une claim présente mais vide reste un 403 ; le client ne choisit jamais sa copropriété ;
 *  - dossier chargé sous RLS : un propriétaire ne voit que ses lots / incidents, jamais ceux d'un
 *    autre, ni le bloc gestion ; le syndic voit le bloc gestion sans aucun nom de résident.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { chargerDossier } from "../lib/assistant/dossier";
import { disconnectTenantDb } from "../lib/tenant/db";
import { ForbiddenTenantError, resolveTenantContext } from "../lib/tenant/jwt";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const SECRET = "ci-only-jwt-secret-with-at-least-32-characters";

let copro: string;
let syndic: string;
let alice: string;
let bob: string;
let lotAlice: string;

async function jeton(sub: string, claims: Record<string, unknown> = {}) {
  return new SignJWT({ sub, ...claims }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(SECRET));
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const c = await admin.copropriete.create({ data: { nom: "Résidence Dari", adresse: "1 rue Dari", ville: "Marrakech", typeResidence: "RESIDENCE_FERMEE", nbLots: 2 } });
  copro = c.id;
  const [s, a, b] = await Promise.all(["syndic", "alice", "bob"].map((n) => admin.utilisateur.create({ data: { email: `${n}-dari@test.local`, prenom: n === "alice" ? "Amina" : null, nom: `Nom-${n}`, statutCompte: "ACTIF" } })));
  syndic = s!.id;
  alice = a!.id;
  bob = b!.id;
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: copro, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: copro, role: "PROPRIETAIRE" },
    ],
  });
  const [la, lb] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "12", batiment: "B", etage: 3, tantiemes: "120.00" } }),
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "7", batiment: "A", etage: 1, tantiemes: "80.00" } }),
  ]);
  lotAlice = la.id;
  await admin.lotProprietaire.createMany({
    data: [
      { lotId: la.id, utilisateurId: alice, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2026-01-01") },
      { lotId: lb.id, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2026-01-01") },
    ],
  });
  await admin.incident.createMany({
    data: [
      { coproprieteId: copro, lotId: la.id, categorie: "PLOMBERIE", sousCategorie: "Fuite salle de bain", partie: "PRIVATIVE", urgence: "URGENTE", statut: "EN_COURS", creePar: alice },
      { coproprieteId: copro, lotId: lb.id, categorie: "ELECTRICITE", sousCategorie: "Prise brûlée", partie: "PRIVATIVE", urgence: "NORMALE", statut: "OUVERT", creePar: bob },
    ],
  });
});

afterAll(async () => {
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotProprietaire.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndic, alice, bob] } } });
  await admin.copropriete.delete({ where: { id: copro } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("rôles du JWT", () => {
  it("claim `roles` absente → rôles lus en base pour le sub vérifié", async () => {
    const ctx = await resolveTenantContext(await jeton(alice));
    expect(ctx).toEqual({ utilisateurId: alice, coproprieteId: copro, role: "PROPRIETAIRE" });
  });

  it("claim `roles` présente mais vide → 403 (compte sans rôle), pas de repli", async () => {
    await expect(resolveTenantContext(await jeton(alice, { roles: [] }))).rejects.toBeInstanceOf(ForbiddenTenantError);
  });

  it("copropriété demandée hors des rôles → refusée, même en repli", async () => {
    const autre = await admin.copropriete.create({ data: { nom: "Autre", adresse: "x", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 1 } });
    try {
      await expect(resolveTenantContext(await jeton(alice), autre.id)).rejects.toBeInstanceOf(ForbiddenTenantError);
    } finally {
      await admin.copropriete.delete({ where: { id: autre.id } });
    }
  });
});

describe("dossier sous RLS", () => {
  it("propriétaire : ses lots, ses incidents seulement, pas de bloc gestion", async () => {
    const d = await chargerDossier({ utilisateurId: alice, coproprieteId: copro, role: "PROPRIETAIRE" });
    expect(d.moi.prenom).toBe("Amina");
    expect(d.moi.lots.map((l) => l.libelle)).toEqual(["B-12 (étage 3)"]);
    expect(d.incidents?.map((i) => i.sous_categorie)).toEqual(["Fuite salle de bain"]);
    expect(d.incidents?.[0]?.statut).toBe("en cours");
    expect(d.gestion).toBeNull();
    expect(d.residence).toBeNull();
    expect(JSON.stringify(d)).not.toContain("Nom-");
  });

  it("syndic : bloc gestion, tous les incidents, aucun nom de résident ni e-mail", async () => {
    const d = await chargerDossier({ utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" });
    expect(d.gestion).not.toBeNull();
    expect(d.residence?.incidents_ouverts).toBe(2);
    expect(d.incidents?.length).toBe(2);
    const json = JSON.stringify(d);
    expect(json).not.toContain("Nom-");
    expect(json).not.toContain("@test.local");
    expect(json).not.toContain(lotAlice);
  });
});
