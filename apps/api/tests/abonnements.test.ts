/**
 * M29 — Abonnements : console opérateur contre la base (RLS réelle, rôle applicatif sans BYPASSRLS).
 * Ouverture avec essai 30 j et prix de la grille ; une seule couverture active par résidence ;
 * facture numérotée sans trou ; paiement partiel puis solde → ACTIF, période avancée ; montant
 * supérieur au reste dû refusé ; rejeu idempotent ; suspension → 402 sur une route tenant, routes
 * libres joignables ; réactivation ; le syndic lit l'état de SA résidence (pas les factures, pas
 * celles des autres) ; seul le SUPER_ADMIN utilise la console ; vue d'ensemble.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  actionAbonnement,
  AbonnementError,
  annulerFacture,
  creerAbonnement,
  emettreFacture,
  enregistrerPaiement,
  listerAbonnements,
  listerCoproprietesAdmin,
  obtenirAbonnement,
  PermissionRefuseeError,
  vueEnsemble,
} from "../lib/abonnements/abonnements";
import { AbonnementBloqueError, etatPourLaResidence, invaliderCacheAcces, verifierAccesAbonnement } from "../lib/abonnements/acces";
import { ajouterJours, jourCasablanca } from "../lib/abonnements/etat";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let coproA: string, coproB: string, superAdmin: string, syndicA: string, syndicB: string;
const ctx = (u: string, role: TenantContext["role"], c: string): TenantContext => ({ utilisateurId: u, coproprieteId: c, role });
const op = () => ctx(superAdmin, "SUPER_ADMIN", coproA);
const req = (path: string) => new Request(`http://api.local${path}`);
const aujourdHui = jourCasablanca();

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.copropriete.create({ data: { nom: "Résidence Abo A", adresse: "1 rue A", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 3 } }),
    admin.copropriete.create({ data: { nom: "Résidence Abo B", adresse: "2 rue B", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2 } }),
  ]);
  coproA = a.id;
  coproB = b.id;
  const users = await Promise.all(["sa", "syndica", "syndicb"].map((n) => admin.utilisateur.create({ data: { email: `${n}-abo@test.local`, nom: n.toUpperCase(), prenom: "A", statutCompte: "ACTIF" } })));
  [superAdmin, syndicA, syndicB] = users.map((u) => u.id) as [string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: superAdmin, coproprieteId: coproA, role: "SUPER_ADMIN" },
    { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
    { utilisateurId: syndicB, coproprieteId: coproB, role: "SYNDIC" },
  ] });
  for (const n of ["A1", "A2", "A3", "A4"]) await admin.lot.create({ data: { coproprieteId: coproA, numero: n, typeLot: "APPARTEMENT", tantiemes: "250.00" } });
});

afterAll(async () => {
  const abos = (await admin.abonnementCopropriete.findMany({ where: { coproprieteId: { in: [coproA, coproB] } }, select: { abonnementId: true } })).map((x) => x.abonnementId);
  const factures = (await admin.factureAbonnement.findMany({ where: { abonnementId: { in: abos } }, select: { id: true } })).map((f) => f.id);
  await admin.paiementAbonnement.deleteMany({ where: { factureId: { in: factures } } });
  await admin.factureAbonnement.deleteMany({ where: { id: { in: factures } } });
  await admin.abonnementEvenement.deleteMany({ where: { abonnementId: { in: abos } } });
  await admin.abonnementCopropriete.deleteMany({ where: { abonnementId: { in: abos } } });
  const clients = (await admin.abonnement.findMany({ where: { id: { in: abos } }, select: { clientId: true } })).map((a) => a.clientId);
  await admin.abonnement.deleteMany({ where: { id: { in: abos } } });
  await admin.clientFacturation.deleteMany({ where: { id: { in: clients } } });
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: { in: [coproA, coproB] } } });
  for (const c of [coproA, coproB]) {
    await admin.lot.deleteMany({ where: { coproprieteId: c } });
    await admin.auditLog.deleteMany({ where: { coproprieteId: c } });
    await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: c } });
  }
  await admin.copropriete.deleteMany({ where: { id: { in: [coproA, coproB] } } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-abo@test.local" } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("M29 — abonnements", () => {
  let aboId: string;

  it("seul le SUPER_ADMIN ouvre un abonnement", async () => {
    await expect(
      creerAbonnement(ctx(syndicA, "SYNDIC", coproA), { nouveau_client: { type: "SYNDICAT", nom: "x" }, copropriete_ids: [coproA], formule: "STANDARD", periodicite: "ANNUELLE", lots_contractes: 3, tarif_fondateur: false, date_debut: aujourdHui, essai: true })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("ouverture : essai de 30 jours, prix de la grille figé, fondateur garanti 24 mois", async () => {
    const a = await creerAbonnement(op(), {
      nouveau_client: { type: "SYNDICAT", nom: "Syndicat Abo A", contact_email: "syndic-abo@test.local" },
      copropriete_ids: [coproA],
      formule: "STANDARD",
      periodicite: "ANNUELLE",
      lots_contractes: 3,
      tarif_fondateur: true,
      date_debut: aujourdHui,
      essai: true,
    });
    aboId = a.id;
    expect(a.statut).toBe("ESSAI");
    expect(a.fin_essai).toBe(ajouterJours(aujourdHui, 29));
    expect(a.prix_lot).toBe("8.40");
    expect(a.base_prix).toBe("TTC");
    expect(a.prix_garanti_jusqu_au).not.toBeNull();
    expect(a.lots_reels).toBe(4);
    expect(a.depassement_lots).toBe(true); // 4 lots créés > 3 contractés + 5 %
    expect(a.etat).toMatchObject({ etat: "EN_ESSAI", niveau: "OK" });
  });

  it("une résidence n'a qu'un abonnement actif", async () => {
    await expect(
      creerAbonnement(op(), { nouveau_client: { type: "SYNDICAT", nom: "Doublon" }, copropriete_ids: [coproA], formule: "ESSENTIEL", periodicite: "ANNUELLE", lots_contractes: 3, tarif_fondateur: false, date_debut: aujourdHui, essai: true })
    ).rejects.toMatchObject({ code: "ABONNEMENT_EXISTANT" });
  });

  it("le syndic lit l'état de SA résidence ; celui d'une autre résidence n'a pas d'abonnement visible", async () => {
    invaliderCacheAcces();
    const a = await etatPourLaResidence(ctx(syndicA, "SYNDIC", coproA));
    expect(a).toMatchObject({ niveau: "OK", etat: "EN_ESSAI", gestionnaire: true });
    expect(a.abonnement?.statut).toBe("ESSAI");
    const b = await etatPourLaResidence(ctx(syndicB, "SYNDIC", coproB));
    expect(b.etat).toBe("SANS_ABONNEMENT");
    // RLS : aucune facture ni client lisible par un syndic.
    const vus = await withTenant(ctx(syndicA, "SYNDIC", coproA), async (db) => ({ f: await db.factureAbonnement.count(), c: await db.clientFacturation.count(), e: await db.abonnementEvenement.count() }));
    expect(vus).toEqual({ f: 0, c: 0, e: 0 });
  });

  it("facture : période suivant l'essai, lots = max(contractés, créés), numéro SU-AAAA-NNNN sans trou", async () => {
    const f1 = await emettreFacture(op(), aboId, { echeance_jours: 15 });
    expect(f1.numero).toMatch(/^SU-\d{4}-\d{4}$/);
    expect(f1.periode_debut).toBe(ajouterJours(aujourdHui, 30));
    expect(f1.lots).toBe(4);
    // 4 lots × 8,40 = 33,60 < minimum 149 → 149 × 12 = 1 788 TTC
    expect(f1.montant_ttc).toBe("1788.00");
    expect(f1.montant_ht).toBe("1490.00");
    await expect(emettreFacture(op(), aboId, { echeance_jours: 15 })).rejects.toMatchObject({ code: "FACTURE_STATUT_INVALIDE" });
    const annulee = await annulerFacture(op(), f1.id, "Test numérotation");
    expect(annulee.statut).toBe("ANNULEE");
    const f2 = await emettreFacture(op(), aboId, { echeance_jours: 15 });
    const n = (s: string) => Number(s.slice(-4));
    expect(n(f2.numero)).toBe(n(f1.numero) + 1);
  });

  it("paiement partiel, rejeu idempotent, dépassement refusé, solde → ACTIF et période avancée", async () => {
    const fiche = await obtenirAbonnement(op(), aboId);
    const facture = fiche.factures.find((f) => f.statut === "EMISE")!;
    const cle = randomUUID();
    const p1 = await enregistrerPaiement(op(), facture.id, { montant: "1000.00", mode: "VIREMENT", reference: "VIR-1", recu_le: aujourdHui }, cle);
    expect(p1).toMatchObject({ facture_soldee: false, reste_du: "788.00" });
    const rejeu = await enregistrerPaiement(op(), facture.id, { montant: "1000.00", mode: "VIREMENT", reference: "VIR-1", recu_le: aujourdHui }, cle);
    expect(rejeu.reste_du).toBe("788.00");
    await expect(enregistrerPaiement(op(), facture.id, { montant: "800.00", mode: "CHEQUE", recu_le: aujourdHui }, randomUUID())).rejects.toBeInstanceOf(AbonnementError);
    const p2 = await enregistrerPaiement(op(), facture.id, { montant: "788.00", mode: "CHEQUE", reference: "CHQ-2", recu_le: aujourdHui }, randomUUID());
    expect(p2.facture_soldee).toBe(true);
    const apres = await obtenirAbonnement(op(), aboId);
    expect(apres.statut).toBe("ACTIF");
    expect(apres.fin_periode).toBe(facture.periode_fin);
    expect(apres.evenements.map((e) => e.type)).toEqual(expect.arrayContaining(["CREE", "FACTURE_EMISE", "FACTURE_ANNULEE", "PAIEMENT_ENREGISTRE", "ACTIVE", "LOTS_DEPASSES"]));
  });

  it("paiements append-only : aucune modification possible par le rôle applicatif", async () => {
    await expect(withTenant(op(), (db) => db.paiementAbonnement.updateMany({ data: { montant: "1.00" } }))).rejects.toThrow();
  });

  it("suspension : 402 sur les routes de la résidence, routes libres joignables, opérateur jamais bloqué ; réactivation", async () => {
    await actionAbonnement(op(), aboId, { action: "SUSPENDRE", motif: "Test" });
    const syndic = ctx(syndicA, "SYNDIC", coproA);
    await expect(verifierAccesAbonnement(syndic, req("/v1/lots"))).rejects.toBeInstanceOf(AbonnementBloqueError);
    await expect(verifierAccesAbonnement(syndic, req("/v1/abonnement"))).resolves.toBeUndefined();
    await expect(verifierAccesAbonnement(syndic, req("/v1/users/me"))).resolves.toBeUndefined();
    await expect(verifierAccesAbonnement(op(), req("/v1/lots"))).resolves.toBeUndefined();
    expect((await etatPourLaResidence(ctx(syndicA, "PROPRIETAIRE", coproA))).niveau).toBe("BLOQUE");
    await actionAbonnement(op(), aboId, { action: "REACTIVER" });
    await expect(verifierAccesAbonnement(syndic, req("/v1/lots"))).resolves.toBeUndefined();
  });

  it("délai accordé (vote en AG) et filtres de la console", async () => {
    const a = await actionAbonnement(op(), aboId, { action: "ACCORDER_DELAI", jusqu_au: ajouterJours(aujourdHui, 60), motif: "AG le 15/12" });
    expect(a.acces_prolonge_jusqu_au).toBe(ajouterJours(aujourdHui, 60));
    const actifs = await listerAbonnements(op(), { etat: "A_JOUR" });
    expect(actifs.map((x) => x.id)).toContain(aboId);
    const copros = await listerCoproprietesAdmin(op(), "Abo");
    expect(copros.find((c) => c.id === coproA)?.abonnement?.id).toBe(aboId);
    expect(copros.find((c) => c.id === coproB)?.abonnement).toBeNull();
  });

  it("vue d'ensemble : revenu récurrent, résidences sans abonnement", async () => {
    const v = await vueEnsemble(op());
    expect(Number(v.mrr_ht)).toBeGreaterThan(0);
    expect(v.coproprietes.sans_abonnement.map((c) => c.id)).toContain(coproB);
    expect(v.coproprietes.sans_abonnement.map((c) => c.id)).not.toContain(coproA);
    await expect(vueEnsemble(ctx(syndicA, "SYNDIC", coproA))).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});
