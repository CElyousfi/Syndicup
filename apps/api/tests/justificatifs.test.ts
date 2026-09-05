/**
 * Tests M17 — Justificatifs de paiement (Doc A §3.3/§3.4) : déclaration résident (lot propre / lot
 * d'autrui refusé, preuve obligatoire), validation = paiement + quittance atomiques (ciblé et FIFO
 * sur solde, avance refusée), rejet sans effet sur le lot, annulation, espèces gardien →
 * EN_ATTENTE → confirmation syndic ; solde avec justificatifs en attente ; escalade impayés
 * suspendue tant qu'un justificatif couvre le dû ; job de relance idempotent ; comptes bancaires
 * (RIB masqué / lecture auditée) ; RLS (résident du lot A ≠ lot B, gardien = ses saisies).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("../lib/storage/supabase-storage", () => ({
  ensureBucketDocuments: async () => undefined,
  creerUrlSignee: async (chemin: string) => `http://127.0.0.1:54321/storage/v1/object/sign/documents/${chemin}`,
  creerUrlUploadSignee: async (chemin: string) => ({ url: `http://127.0.0.1:54321/storage/v1/object/upload/sign/documents/${chemin}`, token: "test" }),
  supprimerObjet: async () => undefined,
  televerserDocument: async () => undefined,
}));
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { withTenant, disconnectTenantDb } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { declarerJustificatif, validerJustificatif, rejeterJustificatif, annulerJustificatif, listerJustificatifs, obtenirJustificatif, saisirEspeces, confirmerEspeces, executerRelanceJustificatifs, JustificatifError, PermissionRefuseeError } from "../lib/justificatifs/justificatifs";
import { listerComptesBancaires, remplacerComptesBancaires, lireRibCompte, PermissionRefuseeError as CbPermission } from "../lib/justificatifs/comptes-bancaires";
import { obtenirSoldeLot, ContrainteMetierError } from "../lib/finances/finances";
import { executerEscaladeImpayes } from "../lib/finances/escalade";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, amina: string, bob: string, loc: string, gardien: string, lotA1: string, lotA2: string;
let appelId: string, ligneA1Jan: string, ligneA1Fev: string, ligneA2: string;
const ctx = (u: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId: u, coproprieteId: copro, role });
const S = () => ctx(syndic, "SYNDIC");
const preuve = (nom: string) => ({ storage_path: `${copro}/justificatifs/${randomUUID()}-${nom}`, nom });
const pagination = { page: 1, limit: 50, skip: 0, take: 50 };

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence Justif", adresse: "5 rue J", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 3 } });
  copro = c.id;
  const users = await Promise.all(["syndic", "amina", "bob", "loc", "gardien"].map((n) => admin.utilisateur.create({ data: { email: `${n}-justif@test.local`, statutCompte: "ACTIF" } })));
  [syndic, amina, bob, loc, gardien] = users.map((u) => u.id) as [string, string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" },
    { utilisateurId: bob, coproprieteId: copro, role: "PROPRIETAIRE" }, { utilisateurId: loc, coproprieteId: copro, role: "LOCATAIRE" }, { utilisateurId: gardien, coproprieteId: copro, role: "GARDIEN" },
  ] });
  const [l1, l2] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A1", tantiemes: "100.00" } }),
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A2", tantiemes: "100.00" } }),
  ]);
  lotA1 = l1.id; lotA2 = l2.id;
  await admin.lotProprietaire.createMany({ data: [
    { lotId: lotA1, utilisateurId: amina, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    { lotId: lotA2, utilisateurId: bob, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  ] });
  await admin.lotOccupant.create({ data: { lotId: lotA1, utilisateurId: loc, typeOccupation: "LOCATAIRE", dateDebut: new Date("2025-01-01") } });
  // Deux appels échus pour A1 (janvier 400, février 600) et un pour A2 (500) — dus depuis longtemps.
  const jan = await admin.appelDeFonds.create({ data: { coproprieteId: copro, periode: "2031-01", type: "CHARGES_COURANTES", montantTotal: "900.00", dateEcheance: new Date("2031-01-10"), statut: "EMIS", lignes: { create: [{ lotId: lotA1, montantDu: "400.00" }, { lotId: lotA2, montantDu: "500.00" }] } }, include: { lignes: true } });
  const fev = await admin.appelDeFonds.create({ data: { coproprieteId: copro, periode: "2031-02", type: "CHARGES_COURANTES", montantTotal: "600.00", dateEcheance: new Date("2031-02-10"), statut: "EMIS", lignes: { create: [{ lotId: lotA1, montantDu: "600.00" }] } }, include: { lignes: true } });
  appelId = jan.id;
  ligneA1Jan = jan.lignes.find((l) => l.lotId === lotA1)!.id; ligneA2 = jan.lignes.find((l) => l.lotId === lotA2)!.id; ligneA1Fev = fev.lignes[0]!.id;
  // Échéances dans le passé pour l'escalade : on antidate.
  await admin.appelDeFonds.updateMany({ where: { coproprieteId: copro }, data: { dateEcheance: new Date(Date.now() - 20 * 86400000) } });
});

afterAll(async () => {
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.paiement.deleteMany({ where: { lot: { coproprieteId: copro } } });
  await admin.quittance.deleteMany({ where: { appelDeFondsLot: { appelDeFonds: { coproprieteId: copro } } } });
  await admin.justificatifPaiement.deleteMany({ where: { coproprieteId: copro } });
  await admin.document.deleteMany({ where: { coproprieteId: copro } });
  await admin.appelDeFondsLot.deleteMany({ where: { appelDeFonds: { coproprieteId: copro } } });
  await admin.appelDeFonds.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.lotOccupant.deleteMany({ where: { lotId: { in: [lotA1, lotA2] } } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: [lotA1, lotA2] } } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-justif@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect(); await disconnectTenantDb();
});

describe("M17 — déclaration", () => {
  it("un propriétaire déclare pour SON lot (preuve obligatoire), pas pour celui d'un autre ; le syndic est notifié", async () => {
    await expect(declarerJustificatif(ctx(amina, "PROPRIETAIRE"), { lot_id: lotA1, montant: "400.00", methode: "VIREMENT", date_paiement: "2031-01-05", beneficiaire: "Compte courant" })).rejects.toMatchObject({ code: "JUSTIFICATIF_PREUVE_REQUISE" });
    await expect(declarerJustificatif(ctx(amina, "PROPRIETAIRE"), { lot_id: lotA2, montant: "1.00", methode: "VIREMENT", date_paiement: "2031-01-05", beneficiaire: "x", preuve: preuve("p.pdf") })).rejects.toBeInstanceOf(PermissionRefuseeError);
    const j = await declarerJustificatif(ctx(amina, "PROPRIETAIRE"), { lot_id: lotA1, appel_de_fonds_lot_id: ligneA1Jan, montant: "400.00", methode: "VIREMENT", date_paiement: "2031-01-05", banque_emettrice: "CIH", beneficiaire: "Compte courant", reference: "VIR-1", preuve: preuve("recu.pdf") });
    expect(j.statut).toBe("EN_ATTENTE");
    expect(j.documentId).toBeTruthy();
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "JUSTIFICATIF_DECLARE" } })).toBe(1);
    // Le locataire du lot peut aussi déclarer (règle payeur) ; la ligne apparaît dans le solde en attente.
    const jl = await declarerJustificatif(ctx(loc, "LOCATAIRE"), { lot_id: lotA1, montant: "100.00", methode: "CHEQUE", date_paiement: "2031-02-01", beneficiaire: "Compte courant", reference: "CHQ-9", preuve: preuve("chq.jpg") });
    const solde = await obtenirSoldeLot(ctx(amina, "PROPRIETAIRE"), lotA1);
    expect(solde.solde_du).toBe("1000.00");
    expect(solde.justificatifs_en_attente).toBe("500.00");
    expect(solde.nb_justificatifs_en_attente).toBe(2);
    await annulerJustificatif(ctx(loc, "LOCATAIRE"), jl.id);
    expect((await admin.justificatifPaiement.findUniqueOrThrow({ where: { id: jl.id } })).statut).toBe("ANNULE");
    await expect(annulerJustificatif(ctx(bob, "PROPRIETAIRE"), j.id)).rejects.toBeInstanceOf(Error); // pas son lot (RLS → introuvable)
  });

  it("escalade impayés suspendue tant qu'un justificatif couvre le dû de la ligne", async () => {
    const r1 = await executerEscaladeImpayes(copro);
    // A1 janvier (400) couvert par le justificatif de 400 → non escaladée ; A1 février et A2 escaladées.
    const ids = r1.escalades.map((e) => e.appelDeFondsLotId);
    expect(ids).not.toContain(ligneA1Jan);
    expect(ids).toContain(ligneA1Fev);
    expect(ids).toContain(ligneA2);
  });

  it("valider (ciblé) : paiement VALIDE lié au justificatif, ligne PAYE, quittance, notification ; idempotent", async () => {
    const j = await admin.justificatifPaiement.findFirstOrThrow({ where: { coproprieteId: copro, statut: "EN_ATTENTE", appelDeFondsLotId: ligneA1Jan } });
    await expect(validerJustificatif(ctx(bob, "PROPRIETAIRE"), j.id)).rejects.toBeInstanceOf(Error);
    const cle = randomUUID();
    const v = await validerJustificatif(S(), j.id, { date_valeur: "2031-01-06" }, cle);
    expect(v.statut).toBe("VALIDE");
    expect(v.quittance_id).toBeTruthy();
    const p = await admin.paiement.findFirstOrThrow({ where: { justificatifId: j.id } });
    expect(p.methode).toBe("VIREMENT"); expect(p.statut).toBe("VALIDE"); expect(p.enregistreParId).toBe(syndic); expect(p.payeurUtilisateurId).toBe(amina); expect(p.dateValeur?.toISOString().slice(0, 10)).toBe("2031-01-06"); expect(p.documentId).toBe(j.documentId);
    const ligne = await admin.appelDeFondsLot.findUniqueOrThrow({ where: { id: ligneA1Jan } });
    expect(ligne.statut).toBe("PAYE"); expect(ligne.montantPaye.toString()).toBe("400");
    await validerJustificatif(S(), j.id, { date_valeur: "2031-01-06" }, cle); // rejeu
    expect(await admin.paiement.count({ where: { justificatifId: j.id } })).toBe(1);
    await expect(validerJustificatif(S(), j.id, {})).rejects.toMatchObject({ code: "JUSTIFICATIF_STATUT_INVALIDE" });
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: amina, templateCode: "PAIEMENT_VALIDE" } })).toBe(1);
    const detail = await obtenirJustificatif(ctx(amina, "PROPRIETAIRE"), j.id);
    expect(detail.preuve?.url).toContain("/sign/documents/");
    expect(detail.paiements).toHaveLength(1);
  });

  it("valider (sur solde, FIFO) : réparti sur les plus anciennes ; avance > dû refusée et rien n'est écrit", async () => {
    // A1 : février 600 restant. Bob déclare 700 sur solde pour A2 (dû 500) → 422, rien créé.
    const trop = await declarerJustificatif(ctx(bob, "PROPRIETAIRE"), { lot_id: lotA2, montant: "700.00", methode: "VIREMENT", date_paiement: "2031-03-01", beneficiaire: "cc", preuve: preuve("t.pdf") });
    await expect(validerJustificatif(S(), trop.id)).rejects.toBeInstanceOf(ContrainteMetierError);
    expect((await admin.justificatifPaiement.findUniqueOrThrow({ where: { id: trop.id } })).statut).toBe("EN_ATTENTE");
    expect(await admin.paiement.count({ where: { lotId: lotA2 } })).toBe(0);
    const rej = await rejeterJustificatif(S(), trop.id, { motif: "Montant supérieur au dû : merci de re-déclarer 500." });
    expect(rej.statut).toBe("REJETE");
    expect((await admin.appelDeFondsLot.findUniqueOrThrow({ where: { id: ligneA2 } })).montantPaye.toString()).toBe("0");
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: bob, templateCode: "JUSTIFICATIF_REJETE" } })).toBe(1);
    // Paiement sur solde valide : A1 doit 600 (février) → 250 imputés FIFO, ligne PARTIEL.
    const ok = await declarerJustificatif(ctx(amina, "PROPRIETAIRE"), { lot_id: lotA1, montant: "250.00", methode: "VIREMENT", date_paiement: "2031-03-02", beneficiaire: "cc", reference: "VIR-2", preuve: preuve("r2.pdf") });
    const v = await validerJustificatif(S(), ok.id);
    expect(v.affectations).toEqual([{ appel_de_fonds_lot_id: ligneA1Fev, montant: "250.00", statut: "PARTIEL" }]);
    expect(v.paiementId).toBeTruthy();
  });

  it("espèces : gardien → justificatif EN_ATTENTE (syndic notifié) ; syndic confirme → paiement ; syndic saisit → paiement direct", async () => {
    const g = await saisirEspeces(ctx(gardien, "GARDIEN"), { lot_id: lotA1, montant: "50.00" }, randomUUID());
    expect(g.type).toBe("JUSTIFICATIF");
    if (g.type !== "JUSTIFICATIF") throw new Error();
    expect(g.justificatif.methode).toBe("ESPECES"); expect(g.justificatif.statut).toBe("EN_ATTENTE"); expect(g.justificatif.documentId).toBeNull();
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "PAIEMENT_ESPECES_SAISI" } })).toBe(1);
    // Le gardien voit sa saisie, pas les autres justificatifs ; Bob ne voit pas ceux d'A1.
    const vuGardien = await listerJustificatifs(ctx(gardien, "GARDIEN"), {}, pagination);
    expect(vuGardien.rows.map((r) => r.id)).toEqual([g.justificatif.id]);
    const vuBob = await listerJustificatifs(ctx(bob, "PROPRIETAIRE"), {}, pagination);
    expect(vuBob.rows.every((r) => r.lotId === lotA2)).toBe(true);
    await expect(confirmerEspeces(ctx(gardien, "GARDIEN"), g.justificatif.id)).rejects.toBeInstanceOf(PermissionRefuseeError);
    const c = await confirmerEspeces(S(), g.justificatif.id);
    expect(c.statut).toBe("VALIDE");
    expect((await admin.paiement.findFirstOrThrow({ where: { justificatifId: g.justificatif.id } })).methode).toBe("ESPECES");
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "PAIEMENT_ESPECES_CONFIRME" } })).toBe(1);
    const s = await saisirEspeces(S(), { lot_id: lotA1, appel_de_fonds_lot_id: ligneA1Fev, montant: "100.00", preuve: preuve("bordereau.jpg") }, randomUUID());
    expect(s.type).toBe("PAIEMENT");
    const ligne = await admin.appelDeFondsLot.findUniqueOrThrow({ where: { id: ligneA1Fev } });
    expect(ligne.montantPaye.toString()).toBe("400"); // 250 + 50 + 100
  });

  it("job de relance : uniquement au-delà du délai configuré, une seule fois ; copropriété non configurée ignorée", async () => {
    const j = await declarerJustificatif(ctx(bob, "PROPRIETAIRE"), { lot_id: lotA2, montant: "500.00", methode: "VIREMENT", date_paiement: "2031-03-03", beneficiaire: "cc", preuve: preuve("x.pdf") });
    const now = new Date(Date.now() + 10 * 86400000);
    const ignore = await withTenant(S(), (db) => executerRelanceJustificatifs(db, copro, now));
    expect(ignore).toEqual({ rappels: 0, ignore: true });
    await admin.copropriete.update({ where: { id: copro }, data: { delaiValidationJustificatifJours: 3 } });
    expect((await withTenant(S(), (db) => executerRelanceJustificatifs(db, copro, new Date()))).rappels).toBe(0); // trop récent
    expect((await withTenant(S(), (db) => executerRelanceJustificatifs(db, copro, now))).rappels).toBe(1);
    expect((await withTenant(S(), (db) => executerRelanceJustificatifs(db, copro, now))).rappels).toBe(0);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "JUSTIFICATIF_A_VALIDER_RELANCE" } })).toBe(1);
    await validerJustificatif(S(), j.id);
  });

  it("comptes bancaires : RIB masqué pour tous, complet pour le syndic seul et audité", async () => {
    await expect(remplacerComptesBancaires(ctx(amina, "PROPRIETAIRE"), copro, { comptes: [] })).rejects.toBeInstanceOf(CbPermission);
    const cs = await remplacerComptesBancaires(S(), copro, { comptes: [{ libelle: "Compte courant", banque: "AWB", rib: "007780000112233445566778" }] });
    expect(cs[0]!.rib_masque).toBe("•••• 6778");
    const vuLoc = await listerComptesBancaires(ctx(loc, "LOCATAIRE"), copro);
    expect(JSON.stringify(vuLoc)).not.toContain("007780000112233445566778");
    await expect(lireRibCompte(ctx(loc, "LOCATAIRE"), copro, 0)).rejects.toBeInstanceOf(CbPermission);
    expect((await lireRibCompte(S(), copro, 0)).rib).toBe("007780000112233445566778");
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "RIB_CONSULTE" } })).toBe(1);
    const audit = await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "COMPTES_BANCAIRES_MODIFIES" } });
    expect(JSON.stringify(audit!.apresJson)).not.toContain("007780000112233445566778");
  });
});
