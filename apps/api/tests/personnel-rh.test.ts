/**
 * Tests M20 — Personnel RH (Doc A §9) : calcul de paie pur contre une table de paramètres
 * PROVISOIRES (fixture) et refus sans paramètres ; fiche RH (masquage salaire / CNSS pour le conseil,
 * lecture auditée du n° CNSS) ; validation de fiche = dépense PERSONNEL créée et soumise dans la
 * même transaction (atomicité : rien n'est écrit si les paramètres manquent), paiement → fiche PAYEE ;
 * congés (jours ouvrables, chevauchement, solde, présences posées, refus motivé) ; pointage
 * idempotent de l'employé ; RLS : un employé ne lit ni la paie ni les congés d'un collègue ;
 * évaluations invisibles de l'employé ; jobs (paie du 25 idempotente, rappel congé, fin de CDD) ;
 * personnel_log append-only (aucun UPDATE possible via le rôle applicatif).
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
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { calculerPaie, joursOuvrables, type ParametresPaie } from "../lib/personnel/paie";
import { annulerConge, creerFichePaie, deciderConge, definirParametresPaie, demanderConge, evaluer, lireCnss, listerConges, listerEvaluations, listerFichesPaie, listerFichesPaieCopropriete, listerPresences, modifierPersonnelRh, obtenirPersonnel, pdfFichePaie, planning, pointer, saisirPresences, validerFichePaie, PermissionRefuseeError, RhError } from "../lib/personnel/rh";
import { listerPersonnel } from "../lib/personnel/personnel";
import { exporterConges, exporterPersonnel } from "../lib/personnel/rh";
import { executerPaieMensuelle, executerRappelConges } from "../lib/personnel/jobs";
import { payerDepense } from "../lib/depenses/depenses";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, conseil: string, amina: string, rachid: string, karim: string, ficheRachid: string, ficheKarim: string;
const ctx = (u: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId: u, coproprieteId: copro, role });
const S = () => ctx(syndic, "SYNDIC");
const C = () => ctx(conseil, "CONSEIL_SYNDICAL");
const R = () => ctx(rachid, "GARDIEN");
const K = () => ctx(karim, "GARDIEN");
const A = () => ctx(amina, "PROPRIETAIRE");

/** Paramètres PROVISOIRES de démonstration (brief §11) — jamais une vérité légale. */
export const PARAMS_FIXTURE: ParametresPaie = {
  smig_mensuel: "3200.00",
  taux_cnss_salarial: "4.48", plafond_cnss: "6000.00", taux_amo_salarial: "2.26",
  taux_cnss_patronal: "8.98", taux_allocations_familiales: "6.40", taux_amo_patronal: "4.11", taux_formation_pro: "1.60",
  taux_frais_professionnels: "25", plafond_frais_professionnels_mensuel: "2500.00",
  tranches_ir: [
    { jusqua: "40000.00", taux: "0", deduction: "0.00" },
    { jusqua: "60000.00", taux: "10", deduction: "4000.00" },
    { jusqua: "80000.00", taux: "20", deduction: "10000.00" },
    { jusqua: "100000.00", taux: "30", deduction: "18000.00" },
    { jusqua: "180000.00", taux: "34", deduction: "22000.00" },
    { jusqua: null, taux: "37", deduction: "27400.00" },
  ],
  jours_conge_annuels: "18",
  jours_ouvres_mois: 26,
  retenue_absence_injustifiee: true,
  source: "Fixture de test — valeurs indicatives",
};

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence RH", adresse: "2 rue RH", ville: "Fès", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2, seuilApprobationConseil: "50000.00" } });
  copro = c.id;
  const users = await Promise.all(["syndic", "conseil", "amina", "rachid", "karim"].map((n) => admin.utilisateur.create({ data: { email: `${n}-rh@test.local`, nom: n.toUpperCase(), prenom: "T", statutCompte: "ACTIF" } })));
  [syndic, conseil, amina, rachid, karim] = users.map((u) => u.id) as [string, string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: conseil, coproprieteId: copro, role: "CONSEIL_SYNDICAL" }, { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" },
    { utilisateurId: rachid, coproprieteId: copro, role: "GARDIEN" }, { utilisateurId: karim, coproprieteId: copro, role: "GARDIEN" },
  ] });
  await admin.budgetAg.create({ data: { coproprieteId: copro, exercice: String(new Date().getUTCFullYear()), montantTotal: "0.00", statut: "ACTIF" } });
  const [f1, f2] = await Promise.all([
    admin.personnel.create({ data: { coproprieteId: copro, utilisateurId: rachid, statut: "PRESENT", poste: "GARDIEN", typeContrat: "CDI", dateEmbauche: new Date("2024-01-01"), salaireBrutMensuel: "4500.00", numeroCnss: "123456789" } }),
    admin.personnel.create({ data: { coproprieteId: copro, utilisateurId: karim, statut: "PRESENT", poste: "AGENT_ENTRETIEN", typeContrat: "CDD", dateEmbauche: new Date("2026-01-01"), dateFinContrat: new Date(Date.now() + 20 * 86_400_000), salaireBrutMensuel: "3300.00" } }),
  ]);
  ficheRachid = f1.id; ficheKarim = f2.id;
});

afterAll(async () => {
  await admin.exportLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.personnelLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.presencePersonnel.deleteMany({ where: { coproprieteId: copro } });
  await admin.evaluationPersonnel.deleteMany({ where: { coproprieteId: copro } });
  await admin.conge.deleteMany({ where: { coproprieteId: copro } });
  await admin.fichePaie.deleteMany({ where: { coproprieteId: copro } });
  await admin.depenseLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.depense.deleteMany({ where: { coproprieteId: copro } });
  await admin.document.deleteMany({ where: { coproprieteId: copro } });
  await admin.personnel.deleteMany({ where: { coproprieteId: copro } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-rh@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect(); await disconnectTenantDb();
});

describe("M20 — moteur de paie (pur)", () => {
  it("table de cas : brut 4 500 sans absence, brut 3 000 sous SMIG, brut 12 000 au-dessus du plafond, absences retenues", () => {
    const a = calculerPaie(PARAMS_FIXTURE, { brut: "4500.00" });
    // CNSS 4.48 % de 4500 = 201.60 ; AMO 2.26 % = 101.70 ; frais pro 25 % = 1125 → net imposable 3071.70 → annuel 36 860.40 → tranche 0 %.
    expect(a.cotisations_salariales).toEqual({ cnss: "201.60", amo: "101.70", ir: "0.00", total: "303.30" });
    expect(a.net).toBe("4196.70");
    expect(a.cotisations_patronales.total).toBe("949.05"); // 404.10 + 288.00 + 184.95 + 72.00
    expect(a.cout_total_employeur).toBe("5449.05");
    expect(a.sous_smig).toBe(false);
    const b = calculerPaie(PARAMS_FIXTURE, { brut: "3000.00" });
    expect(b.sous_smig).toBe(true);
    // Plafond CNSS : brut 12 000 → CNSS salariale sur 6 000 = 268.80 ; frais pro plafonnés 2 500 ; IR tranche 30 %.
    const c = calculerPaie(PARAMS_FIXTURE, { brut: "12000.00" });
    expect(c.cotisations_salariales.cnss).toBe("268.80");
    expect(c.frais_professionnels).toBe("2500.00");
    expect(c.tranche_ir.taux).toBe("34"); // net imposable 8 960 × 12 = 107 520 → tranche 100 001–180 000
    expect(Number(c.cotisations_salariales.ir)).toBeGreaterThan(0);
    expect(Number(c.net)).toBeLessThan(12000);
    // Absences : 2 jours sur 26 → retenue 346.15 ; primes ajoutées ; retenues soustraites du net.
    const d = calculerPaie(PARAMS_FIXTURE, { brut: "4500.00", primes: "500.00", retenues: "100.00", jours_absence_injustifiee: 2 });
    expect(d.retenue_absences).toBe("346.15");
    expect(d.base_cotisations).toBe("4653.85");
    expect(Number(d.net)).toBeLessThan(Number(a.net) + 500);
    expect(joursOuvrables(new Date("2026-09-07T00:00:00Z"), new Date("2026-09-13T00:00:00Z"))).toBe(6); // lundi → dimanche = 6 ouvrables
  });
});

describe("M20 — fiche RH, masquage, CNSS", () => {
  it("conseil / résident : ni salaire ni CNSS ; syndic : salaire + CNSS masqué ; CNSS complet audité ; modification RH (PARTI libère la loge)", async () => {
    const pourConseil = await listerPersonnel(C());
    const rc = pourConseil.find((p) => p.id === ficheRachid)!;
    expect(rc.salaireBrutMensuel).toBeNull(); expect(rc.numeroCnssMasque).toBeNull(); expect(rc.typeContrat).toBeNull();
    const pourSyndic = (await listerPersonnel(S())).find((p) => p.id === ficheRachid)!;
    expect(pourSyndic.salaireBrutMensuel).toBe("4500.00"); expect(pourSyndic.numeroCnssMasque).toBe("•••••6789");
    expect(JSON.stringify(pourSyndic)).not.toContain("123456789");
    const propre = await obtenirPersonnel(R(), ficheRachid);
    expect(propre.salaireBrutMensuel).toBe("4500.00");
    expect(propre.solde_conges?.parametres_non_configures).toBe(true);
    const detailConseil = await obtenirPersonnel(C(), ficheRachid);
    expect(detailConseil.salaireBrutMensuel).toBeNull(); expect(detailConseil.solde_conges).toBeNull();
    await expect(lireCnss(C(), ficheRachid)).rejects.toBeInstanceOf(PermissionRefuseeError);
    const cnss = await lireCnss(S(), ficheRachid);
    expect(cnss.numero_cnss).toBe("123456789");
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "CNSS_CONSULTE", entiteId: ficheRachid } })).toBe(1);
    const maj = await modifierPersonnelRh(S(), ficheRachid, { contact_urgence: "+212600000000", horaires: { lun: [{ debut: "08:00", fin: "12:00" }, { debut: "14:00", fin: "18:00" }] }, notes: "Gardien logé." });
    expect(maj.contactUrgence).toBe("+212600000000");
    await expect(modifierPersonnelRh(C(), ficheRachid, { notes: "x" })).rejects.toBeInstanceOf(PermissionRefuseeError);
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: "PERSONNEL_RH_MODIFIE" } })).toBe(1);
    const audit = await admin.auditLog.findFirst({ where: { coproprieteId: copro, action: "PERSONNEL_RH_MODIFIE" } });
    expect(JSON.stringify(audit)).not.toContain("4500");
  });
});

describe("M20 — paie : brouillon, validation atomique, dépense, paiement, PDF, RLS", () => {
  let ficheId: string;
  const periode = "2026-08";

  it("sans paramètres : brouillon « brut seul » créé, validation refusée et RIEN n'est écrit (aucune dépense)", async () => {
    const f = await creerFichePaie(S(), ficheRachid, { periode });
    ficheId = f.id;
    expect(f.statut).toBe("BROUILLON");
    expect(f.net).toBe("4500.00");
    expect((f.detailsJson as { parametres_non_configures?: boolean }).parametres_non_configures).toBe(true);
    await expect(validerFichePaie(S(), ficheRachid, ficheId, randomUUID())).rejects.toMatchObject({ code: "PAIE_PARAMETRES_NON_CONFIGURES" });
    expect(await admin.depense.count({ where: { coproprieteId: copro } })).toBe(0);
    expect((await admin.fichePaie.findUniqueOrThrow({ where: { id: ficheId } })).statut).toBe("BROUILLON");
    await expect(creerFichePaie(C(), ficheRachid, { periode })).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("paramètres configurés (syndic, audité) → recalcul → validation : dépense PERSONNEL soumise (même transaction), idempotente ; PDF FR + AR ; paiement → PAYEE", async () => {
    await expect(definirParametresPaie(C(), copro, PARAMS_FIXTURE)).rejects.toBeInstanceOf(PermissionRefuseeError);
    await definirParametresPaie(S(), copro, PARAMS_FIXTURE);
    // Deux absences injustifiées pointées par le syndic sur la période → retenue automatique.
    await saisirPresences(S(), ficheRachid, { presences: [{ date: `${periode}-03`, statut: "ABSENT" }, { date: `${periode}-04`, statut: "ABSENT" }, { date: `${periode}-05`, statut: "PRESENT" }] });
    const recalc = await creerFichePaie(S(), ficheRachid, { periode });
    expect(recalc.regeneree).toBe(true);
    expect((recalc.detailsJson as { jours_absence_injustifiee: number }).jours_absence_injustifiee).toBe(2);
    expect(recalc.cotisationsSalarialesJson).toMatchObject({ cnss: expect.any(String), ir: expect.any(String) });
    const cle = randomUUID();
    const v = await validerFichePaie(S(), ficheRachid, ficheId, cle);
    expect(v.statut).toBe("VALIDEE");
    expect(v.depenseId).toBeTruthy();
    const dep = await admin.depense.findUniqueOrThrow({ where: { id: v.depenseId! } });
    expect(dep.categorie).toBe("PERSONNEL"); expect(dep.personnelId).toBe(ficheRachid); expect(dep.periodePaie).toBe(periode);
    expect(dep.statut).toBe("APPROUVEE"); // sous le seuil configuré → approbation directe M16
    expect(dep.montantTtc.toString()).toBe(v.coutTotalEmployeur.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"));
    await validerFichePaie(S(), ficheRachid, ficheId, cle); // rejeu
    expect(await admin.depense.count({ where: { personnelId: ficheRachid } })).toBe(1);
    await expect(validerFichePaie(S(), ficheRachid, ficheId, randomUUID())).rejects.toMatchObject({ code: "PAIE_STATUT_INVALIDE" });
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: rachid, templateCode: "PAIE_VALIDEE" } })).toBe(1);
    const fr = await pdfFichePaie(R(), ficheRachid, ficheId, "fr");
    const ar = await pdfFichePaie(S(), ficheRachid, ficheId, "ar");
    expect(fr.buffer.subarray(0, 5).toString()).toBe("%PDF-"); expect(ar.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // Paiement : délégué au moteur M16 → fiche PAYEE dans la même transaction.
    await payerDepense(S(), v.depenseId!, { methode: "VIREMENT", reference: "VIR-PAIE-08", date_paiement: `${periode}-30` }, randomUUID());
    expect((await admin.fichePaie.findUniqueOrThrow({ where: { id: ficheId } })).statut).toBe("PAYEE");
    expect(await admin.personnelLog.count({ where: { personnelId: ficheRachid, type: "PAIE_PAYEE" } })).toBe(1);
    const vue = await listerFichesPaieCopropriete(S(), periode);
    expect(vue.fiches).toHaveLength(1); expect(vue.sans_fiche.map((x) => x.id)).toContain(ficheKarim);
    expect(vue.totaux.cout_total_employeur).toBe(v.coutTotalEmployeur);
  });

  it("RLS : un employé lit ses fiches, jamais celles d'un collègue ; le conseil ne lit pas la paie", async () => {
    expect((await listerFichesPaie(R(), ficheRachid, {})).length).toBe(1);
    await expect(listerFichesPaie(K(), ficheRachid, {})).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(listerFichesPaie(C(), ficheRachid, {})).rejects.toBeInstanceOf(PermissionRefuseeError);
    const vues = await withTenant(K(), (db) => db.fichePaie.findMany({ where: { coproprieteId: copro } }));
    expect(vues).toHaveLength(0);
    const propres = await withTenant(R(), (db) => db.fichePaie.findMany({ where: { coproprieteId: copro } }));
    expect(propres).toHaveLength(1);
    await expect(listerFichesPaie(A(), ficheRachid, {})).rejects.toBeInstanceOf(PermissionRefuseeError);
  });
});

describe("M20 — congés, présences, évaluations, planning, jobs", () => {
  it("congé : jours ouvrables, chevauchement, refus motivé, approbation (présences posées, solde), annulation ; l'employé ne voit que les siens", async () => {
    const d = await demanderConge(R(), { type: "ANNUEL", date_debut: "2026-10-05", date_fin: "2026-10-10", motif: "Famille" }, randomUUID());
    expect(d.statut).toBe("DEMANDE"); expect(d.nbJours).toBe("6");
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "CONGE_DEMANDE" } })).toBe(1);
    await expect(demanderConge(R(), { type: "ANNUEL", date_debut: "2026-10-09", date_fin: "2026-10-12" }, randomUUID())).rejects.toMatchObject({ code: "CONGE_STATUT_INVALIDE" });
    // Karim ne peut pas demander pour Rachid.
    await expect(demanderConge(K(), { personnel_id: ficheRachid, type: "ANNUEL", date_debut: "2026-11-02", date_fin: "2026-11-03" }, randomUUID())).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(deciderConge(C(), d.id, "APPROUVE", {}, randomUUID())).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(deciderConge(S(), d.id, "REFUSE", {}, randomUUID())).rejects.toBeInstanceOf(RhError);
    const ok = await deciderConge(S(), d.id, "APPROUVE", { remplacant_personnel_id: ficheKarim }, randomUUID());
    expect(ok.statut).toBe("APPROUVE");
    expect(await admin.presencePersonnel.count({ where: { personnelId: ficheRachid, statut: "CONGE" } })).toBe(6);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: rachid, templateCode: "CONGE_APPROUVE" } })).toBe(1);
    const fiche = await obtenirPersonnel(R(), ficheRachid);
    expect(fiche.solde_conges).toMatchObject({ acquis: "18", pris: "6", solde: "12" });
    // Solde insuffisant : 13 jours demandés alors qu'il en reste 12.
    const trop = await demanderConge(S(), { personnel_id: ficheRachid, type: "ANNUEL", date_debut: "2026-12-01", date_fin: "2026-12-15" }, randomUUID());
    await expect(deciderConge(S(), trop.id, "APPROUVE", {}, randomUUID())).rejects.toMatchObject({ code: "CONGE_SOLDE_INSUFFISANT" });
    const refus = await deciderConge(S(), trop.id, "REFUSE", { motif_refus: "Solde insuffisant" }, randomUUID());
    expect(refus.statut).toBe("REFUSE");
    // Karim : maladie, annulée par lui-même.
    const maladie = await demanderConge(K(), { type: "MALADIE", date_debut: "2026-09-20", date_fin: "2026-09-21" }, randomUUID());
    await expect(annulerConge(R(), maladie.id)).rejects.toThrow(); // RLS : la demande d'un collègue est introuvable
    expect((await annulerConge(K(), maladie.id)).statut).toBe("ANNULE");
    expect((await listerConges(K(), null, {})).every((c) => c.personnelId === ficheKarim)).toBe(true);
    expect((await listerConges(C(), null, {})).length).toBeGreaterThanOrEqual(3);
    await expect(listerConges(A(), null, {})).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("pointage de l'employé idempotent ; saisie du syndic ; présences d'un collègue interdites ; évaluations invisibles de l'employé ; planning", async () => {
    const cle = randomUUID();
    const p1 = await pointer(R(), { statut: "PRESENT" }, cle);
    const p2 = await pointer(R(), { statut: "PRESENT" }, cle);
    expect(p1.id).toBe(p2.id);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    expect((await listerPresences(R(), ficheRachid, aujourdhui, aujourdhui)).length).toBe(1);
    await expect(listerPresences(K(), ficheRachid, aujourdhui, aujourdhui)).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(saisirPresences(K(), ficheRachid, { presences: [{ date: aujourdhui, statut: "ABSENT" }] })).rejects.toBeInstanceOf(PermissionRefuseeError);
    await expect(pointer(A(), { statut: "PRESENT" }, randomUUID())).rejects.toBeInstanceOf(PermissionRefuseeError);
    const ev = await evaluer(C(), ficheRachid, { periode: "2026-S2", note: 4, commentaire: "Sérieux et ponctuel." });
    expect(ev.note).toBe(4);
    await evaluer(S(), ficheRachid, { periode: "2026-S2", note: 5 });
    expect((await listerEvaluations(S(), ficheRachid)).moyenne).toBe(4.5);
    await expect(listerEvaluations(R(), ficheRachid)).rejects.toBeInstanceOf(PermissionRefuseeError);
    expect(await withTenant(R(), (db) => db.evaluationPersonnel.count({ where: { coproprieteId: copro } }))).toBe(0);
    const pl = await planning(S(), "2026-10-07");
    expect(pl.semaine).toBe("2026-10-05");
    const rachidPl = pl.personnels.find((x) => x.id === ficheRachid)!;
    expect(rachidPl.jours[0]!.plages).toHaveLength(2);
    expect(rachidPl.jours[0]!.conge?.remplacant).toContain("KARIM");
    const plK = await planning(K(), "2026-10-07");
    expect(plK.personnels.map((x) => x.id)).toEqual([ficheKarim]);
    await expect(planning(A())).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("jobs : paie du 25 (brouillons idempotents + PAIE_A_VALIDER), fin de CDD notifiée une fois, rappel congé > 3 jours une fois ; personnel_log append-only", async () => {
    const now = new Date();
    const r1 = await withTenant(S(), (db) => executerPaieMensuelle(db, copro, now, true));
    expect(r1.fiches).toBe(2);
    expect(r1.fins_contrat).toBe(1);
    const r2 = await withTenant(S(), (db) => executerPaieMensuelle(db, copro, now, true));
    expect(r2).toEqual({ fiches: 0, fins_contrat: 0 });
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "PAIE_A_VALIDER" } })).toBe(1);
    expect(await admin.notification.count({ where: { coproprieteId: copro, utilisateurId: syndic, templateCode: "CONTRAT_TRAVAIL_FIN_PROCHE" } })).toBe(1);
    const vieille = await demanderConge(K(), { type: "SANS_SOLDE", date_debut: "2027-01-04", date_fin: "2027-01-05" }, randomUUID());
    await admin.conge.update({ where: { id: vieille.id }, data: { creeLe: new Date(now.getTime() - 5 * 86_400_000) } });
    expect((await withTenant(S(), (db) => executerRappelConges(db, copro, now))).rappels).toBe(1);
    expect((await withTenant(S(), (db) => executerRappelConges(db, copro, now))).rappels).toBe(0);
    // Append-only : le rôle applicatif n'a pas d'UPDATE sur personnel_log.
    const log = await admin.personnelLog.findFirstOrThrow({ where: { coproprieteId: copro } });
    await expect(withTenant(S(), (db) => db.personnelLog.update({ where: { id: log.id }, data: { type: "FICHE_MODIFIEE" } }))).rejects.toThrow();
  });

  it("exports csv : registre (syndic, sans n° CNSS, journalisé) ; congés (employé : les siens seulement) ; conseil refusé sur le registre", async () => {
    const reg = await exporterPersonnel(S(), "csv");
    expect(reg.entetes).not.toContain("numero_cnss");
    expect(reg.nbLignes).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(reg.lignes)).not.toContain("123456789");
    await expect(exporterPersonnel(C(), "csv")).rejects.toThrow(PermissionRefuseeError);
    const tous = await exporterConges(S(), {}, "csv");
    const miens = await exporterConges(K(), {}, "csv");
    expect(tous.nbLignes).toBeGreaterThanOrEqual(miens.nbLignes);
    expect(miens.lignes.every((l) => l[0] === miens.lignes[0]?.[0])).toBe(true);
    expect(await admin.exportLog.count({ where: { coproprieteId: copro, type: { in: ["PERSONNEL", "CONGES"] } } })).toBe(3);
  });
});
