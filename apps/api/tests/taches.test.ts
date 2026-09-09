/**
 * M22 — Tâches : hooks idempotents (résolution ADOPTEE à exécuter, échéances de contrat, incident
 * RESOLU avec dépense, rapport à soumettre), transitions + récurrence, checklist, RLS (l'assigné
 * ne voit que les siennes, le conseil ce qui lui est visible), job de rappels rejouable, suivi
 * d'exécution lisible par un copropriétaire.
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
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { assignerTache, changerStatutTache, commenterTache, creerTache, executionResolution, listerTaches, mesTaches, mettreAJourChecklist, modifierTache, prochaineEcheance, synchroniserTachesEcheances, tacheExecutionResolution, tacheIncidentResolu, tacheRapportASoumettre, tachesEnRetard, terminerTachesLiees, PermissionRefuseeError, TacheError } from "../lib/taches/taches";
import { executerRappelsTaches } from "../lib/taches/jobs";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, conseil: string, amina: string, rachid: string, agId: string, resolutionId: string, contratId: string, incidentId: string, rapportId: string;
const ctx = (u: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId: u, coproprieteId: copro, role });
const S = () => ctx(syndic, "SYNDIC");
const C = () => ctx(conseil, "CONSEIL_SYNDICAL");
const A = () => ctx(amina, "PROPRIETAIRE");
const G = () => ctx(rachid, "GARDIEN");
const SYS = (): TenantContext => ({ utilisateurId: "00000000-0000-0000-0000-000000000000", coproprieteId: copro, role: "SUPER_ADMIN" });
const PAGE = { page: 1, limit: 50, skip: 0, take: 50 };
const TRI = { champ: "date_echeance" as const, sens: "asc" as const };
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Horloge de référence du fichier (un lundi) — injectée dans les jobs, jamais l'horloge réelle. */
const NOW = new Date("2026-09-07T08:00:00Z");
const dans = (jours: number) => new Date(NOW.getTime() + jours * 86_400_000);
let coproRappels: string | null = null;

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence Tâches", adresse: "4 rue Tâches", ville: "Marrakech", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2, delaiExecutionResolutionJours: 30 } });
  copro = c.id;
  const users = await Promise.all(["syndic", "conseil", "amina", "rachid"].map((n) => admin.utilisateur.create({ data: { email: `${n}-taches@test.local`, nom: n.toUpperCase(), prenom: "T", statutCompte: "ACTIF" } })));
  [syndic, conseil, amina, rachid] = users.map((u) => u.id) as [string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: conseil, coproprieteId: copro, role: "CONSEIL_SYNDICAL" },
    { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" }, { utilisateurId: rachid, coproprieteId: copro, role: "GARDIEN" },
  ] });
  const ag = await admin.assembleeGenerale.create({ data: { coproprieteId: copro, type: "ORDINAIRE", dateAg: new Date("2026-06-15T18:00:00Z"), statut: "CLOTUREE" } });
  agId = ag.id;
  const r = await admin.agResolution.create({ data: { agId, ordre: 1, texte: "Remplacer la pompe de relevage", typeMajorite: "SIMPLE", resultat: "ADOPTEE", necessiteExecution: true } });
  resolutionId = r.id;
  const contrat = await admin.contrat.create({ data: { coproprieteId: copro, type: "ASCENSEUR", libelle: "Maintenance ascenseur", dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-12-31"), tacite: false, preavisJours: 60, periodicite: "MENSUELLE", montantPeriode: "500.00", statut: "ACTIF", creeParId: syndic } });
  contratId = contrat.id;
  await admin.contratEcheance.createMany({ data: [
    { contratId, type: "RENOUVELLEMENT", dateEcheance: new Date("2026-11-01"), statut: "A_VENIR" },
    { contratId, type: "VISITE_TECHNIQUE", dateEcheance: new Date("2026-10-01"), statut: "A_VENIR" },
    { contratId, type: "PAIEMENT", dateEcheance: new Date("2026-10-01"), montant: "500.00", statut: "A_VENIR" },
  ] });
  const inc = await admin.incident.create({ data: { coproprieteId: copro, categorie: "PLOMBERIE", sousCategorie: "Fuite", description: "Fuite au sous-sol", partie: "COMMUNE", urgence: "URGENTE", statut: "RESOLU", creePar: amina } });
  incidentId = inc.id;
  await admin.budgetAg.create({ data: { coproprieteId: copro, exercice: "2026", montantTotal: "0.00", statut: "ACTIF" } });
  await admin.depense.create({ data: { coproprieteId: copro, libelle: "Réparation fuite", categorie: "REPARATIONS", montantHt: "1000.00", tva: "0.00", montantTtc: "1000.00", statut: "A_APPROUVER", incidentId, creeParId: syndic, dateDepense: new Date() } });
  const rap = await admin.rapportGestion.create({ data: { coproprieteId: copro, exercice: "2025", statut: "GENERE", donneesJson: {}, genereParId: syndic, genereLe: new Date() } });
  rapportId = rap.id;
});

afterAll(async () => {
  if (coproRappels) {
    await admin.notification.deleteMany({ where: { coproprieteId: coproRappels } });
    await admin.tacheLog.deleteMany({ where: { coproprieteId: coproRappels } });
    await admin.tache.deleteMany({ where: { coproprieteId: coproRappels } });
    await admin.auditLog.deleteMany({ where: { coproprieteId: coproRappels } });
    await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproRappels } });
    await admin.copropriete.deleteMany({ where: { id: coproRappels } });
  }
  await admin.exportLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  await admin.tacheLog.deleteMany({ where: { coproprieteId: copro } });
  const taches = await admin.tache.findMany({ where: { coproprieteId: copro }, select: { id: true } });
  await admin.tacheCommentaire.deleteMany({ where: { tacheId: { in: taches.map((t) => t.id) } } });
  await admin.contratEcheance.updateMany({ where: { contratId }, data: { tacheId: null } });
  await admin.document.deleteMany({ where: { coproprieteId: copro } });
  await admin.tache.deleteMany({ where: { coproprieteId: copro } });
  await admin.contratEcheance.deleteMany({ where: { contratId } });
  await admin.contratLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.contrat.deleteMany({ where: { coproprieteId: copro } });
  await admin.rapportGestion.deleteMany({ where: { coproprieteId: copro } });
  await admin.depenseLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.depense.deleteMany({ where: { coproprieteId: copro } });
  await admin.incidentLog.deleteMany({ where: { incident: { coproprieteId: copro } } });
  await admin.incident.deleteMany({ where: { coproprieteId: copro } });
  await admin.budgetAg.deleteMany({ where: { coproprieteId: copro } });
  await admin.agResolution.deleteMany({ where: { agId } });
  await admin.assembleeGenerale.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-taches@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect(); await disconnectTenantDb();
});

describe("M22 — hooks (une tâche par objet source, idempotents)", () => {
  it("résolution ADOPTEE « nécessite exécution » → une tâche HAUTE assignée au syndic, échéance = date AG + délai paramétré ; rejeu = même tâche ; REJETEE / non marquée = rien", async () => {
    const r = await admin.agResolution.findUniqueOrThrow({ where: { id: resolutionId } });
    const t1 = await withTenant(S(), (db) => tacheExecutionResolution(db, S(), r, "ADOPTEE"));
    const t2 = await withTenant(S(), (db) => tacheExecutionResolution(db, S(), r, "ADOPTEE"));
    expect(t1?.creee).toBe(true); expect(t2?.creee).toBe(false); expect(t2?.id).toBe(t1?.id);
    const t = await admin.tache.findUniqueOrThrow({ where: { id: t1!.id } });
    expect(t).toMatchObject({ origine: "RESOLUTION_AG", priorite: "HAUTE", assigneeId: syndic, statut: "A_FAIRE" });
    expect(iso(t.dateEcheance!)).toBe("2026-07-15");
    expect(await withTenant(S(), (db) => tacheExecutionResolution(db, S(), r, "REJETEE"))).toBeNull();
    expect(await withTenant(S(), (db) => tacheExecutionResolution(db, S(), { ...r, necessiteExecution: false, id: r.id }, "ADOPTEE"))).toBeNull();
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "TACHE_ASSIGNEE", utilisateurId: syndic } })).toBe(1);
  });
  it("échéances de contrat : une tâche par échéance non financière (jamais pour un PAIEMENT), liée par contrat_echeance.tache_id ; échéance annulée → tâche annulée ; rejeu = 0", async () => {
    const r1 = await withTenant(S(), (db) => synchroniserTachesEcheances(db, S(), contratId));
    expect(r1).toEqual({ creees: 2, annulees: 0 });
    const r2 = await withTenant(S(), (db) => synchroniserTachesEcheances(db, S(), contratId));
    expect(r2).toEqual({ creees: 0, annulees: 0 });
    const echeances = await admin.contratEcheance.findMany({ where: { contratId } });
    expect(echeances.filter((e) => e.type === "PAIEMENT").every((e) => e.tacheId === null)).toBe(true);
    const renouv = echeances.find((e) => e.type === "RENOUVELLEMENT")!;
    expect((await admin.tache.findUniqueOrThrow({ where: { id: renouv.tacheId! } })).priorite).toBe("HAUTE");
    const visite = echeances.find((e) => e.type === "VISITE_TECHNIQUE")!;
    await admin.contratEcheance.update({ where: { id: visite.id }, data: { statut: "ANNULEE" } });
    expect(await withTenant(S(), (db) => synchroniserTachesEcheances(db, S(), contratId))).toEqual({ creees: 0, annulees: 1 });
    expect((await admin.tache.findUniqueOrThrow({ where: { id: visite.tacheId! } })).statut).toBe("ANNULEE");
  });
  it("incident RESOLU avec dépense à approuver → tâche INCIDENT (une fois) ; rapport GENERE → tâche RAPPORT, terminée à la soumission", async () => {
    const i1 = await withTenant(S(), (db) => tacheIncidentResolu(db, S(), incidentId));
    const i2 = await withTenant(S(), (db) => tacheIncidentResolu(db, S(), incidentId));
    expect(i1?.creee).toBe(true); expect(i2?.creee).toBe(false);
    const r1 = await withTenant(S(), (db) => tacheRapportASoumettre(db, S(), { id: rapportId, exercice: "2025" }));
    const r2 = await withTenant(S(), (db) => tacheRapportASoumettre(db, S(), { id: rapportId, exercice: "2025" }));
    expect(r1.creee).toBe(true); expect(r2.creee).toBe(false);
    expect(await withTenant(S(), (db) => terminerTachesLiees(db, S(), { rapportGestionId: rapportId }, "rapport_soumis"))).toBe(1);
    expect((await admin.tache.findUniqueOrThrow({ where: { id: r1.id } })).statut).toBe("TERMINEE");
  });
});

describe("M22 — cycle de vie, checklist, récurrence, RLS", () => {
  let idGardien: string, idConseilCachee: string;
  it("création manuelle assignée au gardien ; assignation refusée pour un propriétaire ; RLS : le gardien ne voit que ses tâches, le conseil pas celles cachées", async () => {
    const t = await creerTache(S(), { titre: "Nettoyer les cuves", description: "Trimestriel", assignee_id: rachid, priorite: "NORMALE", date_echeance: iso(dans(30)), checklist: [{ libelle: "Vider", fait: false }, { libelle: "Désinfecter", fait: false }], recurrence: { frequence: "TRIMESTRIELLE" }, visible_conseil: true, pieces_jointes: [] });
    idGardien = t.id;
    expect(t.checklist?.length).toBe(2);
    await expect(creerTache(S(), { titre: "x", assignee_id: amina, priorite: "BASSE", visible_conseil: true, pieces_jointes: [] })).rejects.toMatchObject({ code: "TACHE_ASSIGNEE_INVALIDE" });
    await expect(creerTache(C(), { titre: "x", priorite: "BASSE", visible_conseil: true, pieces_jointes: [] })).rejects.toThrow(PermissionRefuseeError);
    const cachee = await creerTache(S(), { titre: "Dossier RH confidentiel", priorite: "BASSE", visible_conseil: false, pieces_jointes: [] });
    idConseilCachee = cachee.id;
    const vuesGardien = await mesTaches(G());
    expect(vuesGardien.map((x) => x.id)).toEqual([idGardien]);
    expect((await listerTaches(G(), {}, PAGE, TRI)).rows.map((x) => x.id)).toEqual([idGardien]);
    const vuesConseil = (await listerTaches(C(), {}, PAGE, TRI)).rows.map((x) => x.id);
    expect(vuesConseil).toContain(idGardien);
    expect(vuesConseil).not.toContain(idConseilCachee);
    await expect(listerTaches(A(), {}, PAGE, TRI)).rejects.toThrow(PermissionRefuseeError);
    expect(await withTenant(G(), (db) => db.tache.count({ where: { coproprieteId: copro } }))).toBe(1);
  });
  it("le gardien coche sa checklist et termine avec un commentaire ; l'occurrence suivante est créée une seule fois ; il ne peut ni annuler ni toucher une tâche d'un autre", async () => {
    const t = await withTenant(S(), (db) => db.tache.findUniqueOrThrow({ where: { id: idGardien } }));
    const c1 = (t.checklistJson as { id: string }[])[0]!.id;
    const maj = await mettreAJourChecklist(G(), idGardien, { item_id: c1, fait: true });
    expect(maj.checklistFaits).toBe(1);
    await expect(mettreAJourChecklist(G(), idConseilCachee, { item_id: "c1", fait: true })).rejects.toThrow();
    await expect(changerStatutTache(G(), idGardien, { statut: "ANNULEE" })).rejects.toThrow(PermissionRefuseeError);
    const enCours = await changerStatutTache(G(), idGardien, { statut: "EN_COURS", commentaire: "Je commence." });
    expect(enCours.statut).toBe("EN_COURS");
    expect(enCours.commentaires.length).toBe(1);
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "TACHE_STATUT", utilisateurId: syndic } })).toBe(1);
    const fini = await changerStatutTache(G(), idGardien, { statut: "TERMINEE" });
    expect(fini.statut).toBe("TERMINEE");
    expect(fini.termineeLe).not.toBeNull();
    expect(fini.suivante_id).not.toBeNull();
    const suivante = await admin.tache.findUniqueOrThrow({ where: { id: fini.suivante_id! } });
    expect(suivante).toMatchObject({ origine: "SYSTEME", recurrenceParenteId: idGardien, assigneeId: rachid, statut: "A_FAIRE" });
    expect(iso(suivante.dateEcheance!)).toBe(iso(prochaineEcheance(t.dateEcheance!, "TRIMESTRIELLE")));
    expect((suivante.checklistJson as { fait: boolean }[]).every((c) => !c.fait)).toBe(true);
    // Rejeu à l'identique (mobile hors-ligne) : même statut → deja, aucune seconde occurrence.
    const rejeu = await changerStatutTache(G(), idGardien, { statut: "TERMINEE" });
    expect(rejeu.deja).toBe(true);
    expect(await admin.tache.count({ where: { recurrenceParenteId: idGardien } })).toBe(1);
    await expect(changerStatutTache(S(), idGardien, { statut: "EN_COURS" })).rejects.toMatchObject({ code: "TACHE_STATUT_INVALIDE" });
    await expect(modifierTache(S(), idGardien, { titre: "x" })).rejects.toMatchObject({ code: "TACHE_STATUT_INVALIDE" });
    expect(await admin.tacheLog.count({ where: { tacheId: idGardien, type: { in: ["CHECKLIST", "STATUT_CHANGE", "RECURRENCE"] } } })).toBeGreaterThanOrEqual(4);
    await expect(withTenant(G(), (db) => db.tacheLog.deleteMany({ where: { tacheId: idGardien } }))).rejects.toThrow();
  });
  it("réassignation (syndic) + commentaire du conseil ; la tâche cachée reste invisible du conseil même par id", async () => {
    const t = await assignerTache(S(), idConseilCachee, { assignee_id: conseil });
    expect(t.assignee?.id).toBe(conseil);
    // Visible désormais (assigné) même si visible_conseil = false.
    expect((await mesTaches(C())).map((x) => x.id)).toContain(idConseilCachee);
    const com = await commenterTache(C(), idConseilCachee, { contenu: "Vu, je m'en occupe." });
    expect(com.mien).toBe(true);
    await assignerTache(S(), idConseilCachee, { assignee_id: null });
    await expect(commenterTache(C(), idConseilCachee, { contenu: "encore" })).rejects.toThrow();
  });
  it("suivi d'exécution d'une résolution lisible par un copropriétaire (jamais l'assigné) ; retard visible à date injectée", async () => {
    const ex = await executionResolution(A(), agId, resolutionId);
    expect(ex.taches.length).toBe(1);
    expect(ex.taches[0]).toMatchObject({ statut: "A_FAIRE", date_echeance: "2026-07-15", en_retard: true });
    expect(JSON.stringify(ex)).not.toContain(syndic);
    const retard = await tachesEnRetard(S(), NOW);
    expect(retard.map((t) => t.id)).toContain(ex.taches[0]!.tache_id);
  });
  it("job de rappels J-3 / J-0 / retard + synthèse hebdo du lundi : déterministe à horloge injectée, rejeu = 0, copropriété dédiée", async () => {
    // Copropriété propre au test (aucune tâche créée par les autres tests, aucune dépendance d'ordre).
    const c = await admin.copropriete.create({ data: { nom: "Résidence Rappels Tâches", adresse: "5 rue Rappels", ville: "Fès", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 1 } });
    coproRappels = c.id;
    await admin.roleUtilisateur.createMany({ data: [
      { utilisateurId: syndic, coproprieteId: c.id, role: "SYNDIC" }, { utilisateurId: conseil, coproprieteId: c.id, role: "CONSEIL_SYNDICAL" }, { utilisateurId: rachid, coproprieteId: c.id, role: "GARDIEN" },
    ] });
    const SR = (): TenantContext => ({ utilisateurId: syndic, coproprieteId: c.id, role: "SYNDIC" });
    const SYSR = (): TenantContext => ({ utilisateurId: "00000000-0000-0000-0000-000000000000", coproprieteId: c.id, role: "SUPER_ADMIN" });
    const j3 = await creerTache(SR(), { titre: "Échéance J-3", assignee_id: rachid, priorite: "NORMALE", date_echeance: iso(dans(3)), visible_conseil: true, pieces_jointes: [] });
    const j0 = await creerTache(SR(), { titre: "Échéance J-0", assignee_id: rachid, priorite: "NORMALE", date_echeance: iso(NOW), visible_conseil: true, pieces_jointes: [] });
    const retard = await creerTache(SR(), { titre: "En retard", priorite: "HAUTE", date_echeance: iso(dans(-7)), visible_conseil: true, pieces_jointes: [] });
    const horsFenetre = await creerTache(SR(), { titre: "Hors fenêtre (J+5)", assignee_id: rachid, priorite: "BASSE", date_echeance: iso(dans(5)), visible_conseil: true, pieces_jointes: [] });
    await creerTache(SR(), { titre: "Sans échéance", priorite: "BASSE", visible_conseil: true, pieces_jointes: [] });

    const r1 = await withTenant(SYSR(), (db) => executerRappelsTaches(db, c.id, NOW));
    expect(r1).toEqual({ j3: 1, j0: 1, retard: 1, hebdo: 2 });
    // Rejeu à la même date : rien (marqueurs rappel_*_le posés avec l'horloge injectée, hebdo clé sur la semaine ISO).
    const r2 = await withTenant(SYSR(), (db) => executerRappelsTaches(db, c.id, NOW));
    expect(r2).toEqual({ j3: 0, j0: 0, retard: 0, hebdo: 0 });
    // Le lendemain (mardi 08/09) : la J-3 reste marquée, la J-0 passe en retard une seule fois, J+5 (12/09)
    // toujours hors fenêtre (09/09 → 11/09), pas de synthèse hebdo un mardi.
    const r3 = await withTenant(SYSR(), (db) => executerRappelsTaches(db, c.id, dans(1)));
    expect(r3).toEqual({ j3: 0, j0: 0, retard: 1, hebdo: 0 });
    // Lundi suivant (14/09) : J-3 (10/09) et J+5 (12/09) sont désormais en retard (une fois chacune), la J-0
    // déjà rappelée ne l'est pas deux fois ; nouvelle synthèse hebdo (nouvelle semaine ISO).
    const r4 = await withTenant(SYSR(), (db) => executerRappelsTaches(db, c.id, dans(7)));
    expect(r4).toEqual({ j3: 0, j0: 0, retard: 2, hebdo: 2 });

    const marques = await admin.tache.findMany({ where: { id: { in: [j3.id, j0.id, retard.id, horsFenetre.id] } }, select: { id: true, rappelJ3Le: true, rappelJ0Le: true, rappelRetardLe: true } });
    expect(marques.find((t) => t.id === j3.id)!.rappelJ3Le?.toISOString()).toBe(NOW.toISOString());
    expect(marques.find((t) => t.id === j0.id)!.rappelJ0Le?.toISOString()).toBe(NOW.toISOString());
    expect(marques.find((t) => t.id === j0.id)!.rappelRetardLe?.toISOString()).toBe(dans(1).toISOString());
    expect(marques.find((t) => t.id === retard.id)!.rappelRetardLe?.toISOString()).toBe(NOW.toISOString());
    expect(marques.find((t) => t.id === j3.id)!.rappelRetardLe?.toISOString()).toBe(dans(7).toISOString());
    expect(marques.find((t) => t.id === horsFenetre.id)!.rappelRetardLe?.toISOString()).toBe(dans(7).toISOString());
    // Destinataires : l'assigné (rachid) — J-3, J-0, retard J-0 (mardi), retards J-3 et J+5 (lundi suivant) = 5 ;
    // les syndics pour la tâche non assignée en retard (1).
    expect(await admin.notification.count({ where: { coproprieteId: c.id, templateCode: "TACHE_ECHEANCE", utilisateurId: rachid } })).toBe(5);
    expect(await admin.notification.count({ where: { coproprieteId: c.id, templateCode: "TACHE_ECHEANCE", utilisateurId: syndic } })).toBe(1);
    expect(await admin.notification.count({ where: { coproprieteId: c.id, templateCode: "TACHES_EN_RETARD_HEBDO" } })).toBe(4);
    expect(await admin.notification.count({ where: { coproprieteId: c.id, templateCode: "TACHES_EN_RETARD_HEBDO", contenuJson: { path: ["semaine"], equals: iso(NOW) } } })).toBe(2);
  });
});
