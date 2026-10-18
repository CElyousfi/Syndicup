/**
 * Filtres serveur de GET /incidents et GET /lots + GET /incidents/compteurs : `total` reflète le
 * filtre, la RLS reste la seule source de visibilité (un résident ne compte que ses
 * signalements), `q` échappe les jokers ILIKE, valeur invalide rejetée par Zod.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { compteursIncidents, creerIncident, listerIncidents } from "../lib/incidents/incidents";
import { incidentsFiltresSchema } from "../lib/incidents/schemas";
import { listerLots } from "../lib/lots/lots";
import { lotsFiltresSchema } from "../lib/lots/schemas";
import { motifContient } from "../lib/http/recherche";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, amina: string, omar: string, lotA: string, lotB: string;
const S = (): TenantContext => ({ utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" });
const A = (): TenantContext => ({ utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" });

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence Filtres", adresse: "5 rue Filtre", ville: "Fès", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 3 } });
  copro = c.id;
  const [us, ua, uo] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-filtres@test.local", nom: "SYNDIC", prenom: "Sam", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "amina-filtres@test.local", nom: "BENNANI", prenom: "Amina", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "omar-filtres@test.local", nom: "ALAOUI", prenom: "Omar", statutCompte: "ACTIF" } }),
  ]);
  [syndic, amina, omar] = [us.id, ua.id, uo.id];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" },
    { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" },
    { utilisateurId: omar, coproprieteId: copro, role: "PROPRIETAIRE" },
  ] });
  const [la, lb] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A-101", tantiemes: "100.00", statut: "OCCUPE" } }),
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "PARKING", numero: "P_7", tantiemes: "10.00", statut: "VACANT" } }),
  ]);
  [lotA, lotB] = [la.id, lb.id];
  await admin.lotProprietaire.createMany({ data: [
    { lotId: lotA, utilisateurId: amina, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    { lotId: lotB, utilisateurId: omar, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  ] });
  // 3 incidents : 2 d'Amina (lot A), 1 du syndic (parties communes).
  await creerIncident(A(), { lot_id: lotA, categorie: "PLOMBERIE", sous_categorie: "Fuite 100% salle de bain", description: "Sous l'évier.", partie: "PRIVATIVE", urgence: "URGENTE" });
  await creerIncident(A(), { lot_id: lotA, categorie: "ELECTRICITE", sous_categorie: "Prise", description: "Grille.", partie: "PRIVATIVE", urgence: "NORMALE" });
  const ascenseur = await creerIncident(S(), { categorie: "ASCENSEUR", sous_categorie: "Bloqué", description: "Entre deux étages.", partie: "COMMUNE", urgence: "URGENCE_MAXIMALE" });
  await admin.incident.update({ where: { id: ascenseur.id }, data: { statut: "EN_COURS", slaDeadline: new Date(Date.now() - 3600_000) } });
});

afterAll(async () => {
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  // Périmètre STRICT : incident_log est append-only — uniquement les incidents de ce tenant de test.
  await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: copro } } });
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: [lotA, lotB] } } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-filtres@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("motifContient — jokers échappés", () => {
  it("échappe %, _ et le caractère d'échappement ; entoure de %", () => {
    expect(motifContient("abc")).toBe("%abc%");
    expect(motifContient("100%")).toBe("%100!%%");
    expect(motifContient("P_7")).toBe("%P!_7%");
    expect(motifContient("a!b")).toBe("%a!!b%");
  });
});

describe("Zod — filtres", () => {
  it("statut multi (virgules), dédoublonné ; valeur inconnue rejetée", () => {
    expect(incidentsFiltresSchema.parse({ statut: "OUVERT,EN_COURS,OUVERT" }).statut).toEqual(["OUVERT", "EN_COURS"]);
    expect(incidentsFiltresSchema.safeParse({ statut: "OUVERT,PERDU" }).success).toBe(false);
    expect(incidentsFiltresSchema.safeParse({ urgence: "CRITIQUE" }).success).toBe(false);
    expect(incidentsFiltresSchema.safeParse({ lot_id: "pas-un-uuid" }).success).toBe(false);
    expect(lotsFiltresSchema.safeParse({ type: "CHATEAU" }).success).toBe(false);
    expect(lotsFiltresSchema.parse({})).toEqual({});
  });
});

describe("GET /incidents — filtres serveur", () => {
  it("statut / urgence / categorie / lot_id restreignent et `total` reflète le filtre", async () => {
    expect((await listerIncidents(S(), 1, 50)).total).toBe(3);
    expect((await listerIncidents(S(), 1, 50, { statut: ["OUVERT"] })).total).toBe(2);
    expect((await listerIncidents(S(), 1, 50, { statut: ["OUVERT", "EN_COURS"] })).total).toBe(3);
    expect((await listerIncidents(S(), 1, 50, { urgence: "URGENCE_MAXIMALE" })).total).toBe(1);
    expect((await listerIncidents(S(), 1, 50, { categorie: "PLOMBERIE" })).total).toBe(1);
    expect((await listerIncidents(S(), 1, 50, { lot_id: lotA })).total).toBe(2);
    // Pagination sur le résultat filtré.
    const p = await listerIncidents(S(), 1, 1, { lot_id: lotA });
    expect(p.total).toBe(2);
    expect(p.rows).toHaveLength(1);
  });
  it("q : contient, insensible à la casse, dans sous-catégorie ou description ; `%` cherché tel quel", async () => {
    expect((await listerIncidents(S(), 1, 50, { q: "fuite" })).total).toBe(1);
    expect((await listerIncidents(S(), 1, 50, { q: "DEUX" })).total).toBe(1); // description, casse ignorée
    expect((await listerIncidents(S(), 1, 50, { q: "100%" })).total).toBe(1);
    expect((await listerIncidents(S(), 1, 50, { q: "%" })).total).toBe(1); // pas « tout »
    expect((await listerIncidents(S(), 1, 50, { q: "introuvable" })).total).toBe(0);
  });
  it("RLS intacte : un résident ne filtre que ses signalements", async () => {
    expect((await listerIncidents(A(), 1, 50)).total).toBe(2);
    expect((await listerIncidents(A(), 1, 50, { q: "Bloqué" })).total).toBe(0);
  });
});

describe("GET /incidents/compteurs", () => {
  it("par statut + SLA dépassés, sur le périmètre RLS de l'appelant", async () => {
    expect(await compteursIncidents(S())).toEqual({ par_statut: { OUVERT: 2, EN_COURS: 1, RESOLU: 0, FERME: 0 }, total: 3, sla_depasses: 1 });
    const r = await compteursIncidents(A());
    expect(r.total).toBe(2);
    expect(r.sla_depasses).toBe(0);
  });
});

describe("GET /lots — filtres serveur", () => {
  it("type / statut / q (numéro ou nom de propriétaire), `total` filtré, `_` cherché tel quel", async () => {
    expect((await listerLots(S(), 1, 50)).total).toBe(2);
    expect((await listerLots(S(), 1, 50, { type: "PARKING" })).total).toBe(1);
    expect((await listerLots(S(), 1, 50, { statut: "OCCUPE" })).rows.map((l) => l.id)).toEqual([lotA]);
    expect((await listerLots(S(), 1, 50, { q: "a-10" })).rows.map((l) => l.id)).toEqual([lotA]);
    expect((await listerLots(S(), 1, 50, { q: "bennani" })).rows.map((l) => l.id)).toEqual([lotA]);
    expect((await listerLots(S(), 1, 50, { q: "Omar Alaoui" })).rows.map((l) => l.id)).toEqual([lotB]);
    expect((await listerLots(S(), 1, 50, { q: "Alaoui Omar" })).rows.map((l) => l.id)).toEqual([lotB]);
    expect((await listerLots(S(), 1, 50, { q: "P_7" })).total).toBe(1);
    expect((await listerLots(S(), 1, 50, { q: "_" })).total).toBe(1); // seul « P_7 » contient « _ »
    expect((await listerLots(S(), 1, 50, { q: "zzz" })).total).toBe(0);
  });
});
