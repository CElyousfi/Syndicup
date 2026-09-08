/**
 * M21 — Communication : audience (un LOCATAIRE ne reçoit jamais une annonce PROPRIETAIRES, RLS +
 * fan-out), accusés de lecture (comptes gestion, jamais la liste pour un résident), commentaires +
 * modération, sondage anonyme (un répondant ne lit jamais la ligne d'un autre, résultats agrégés
 * seulement, pondération tantièmes), 409 double réponse, digest hebdo idempotent, assainissement.
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
import { archiverAnnonce, commenterAnnonce, creerAnnonce, creerContact, lecturesAnnonce, listerAnnonces, marquerLue, masquerCommentaire, obtenirAnnonce, publierAnnonce, definirPreferencesNotification, CommunicationError, PermissionRefuseeError } from "../lib/communication/communication";
import { PREFERENCES_DEFAUT } from "../lib/communication/schemas";
import { cloreSondage, creerSondage, listerSondages, obtenirSondage, ouvrirSondage, repondreSondage, resultatsSondage } from "../lib/communication/sondages";
import { executerDigest, executerProgrammees } from "../lib/communication/jobs";
import { assainirMarkdown, texteBrut } from "../lib/communication/sanitize";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let copro: string, syndic: string, conseil: string, amina: string, omar: string, leila: string, hamid: string;
const ctx = (u: string, role: TenantContext["role"]): TenantContext => ({ utilisateurId: u, coproprieteId: copro, role });
const S = () => ctx(syndic, "SYNDIC");
const C = () => ctx(conseil, "CONSEIL_SYNDICAL");
const A = () => ctx(amina, "PROPRIETAIRE"); // propriétaire bâtiment A (300 tantièmes)
const O = () => ctx(omar, "PROPRIETAIRE"); // propriétaire bâtiment B (200 tantièmes)
const L = () => ctx(leila, "LOCATAIRE"); // locataire bâtiment A
const G = () => ctx(hamid, "GARDIEN");
const SYS = (): TenantContext => ({ utilisateurId: "00000000-0000-0000-0000-000000000000", coproprieteId: copro, role: "SUPER_ADMIN" });
const PAGE = { page: 1, limit: 50, skip: 0, take: 50 };
const TRI = { champ: "publie_le" as const, sens: "desc" as const };

beforeAll(async () => {
  const c = await admin.copropriete.create({ data: { nom: "Résidence Communication", adresse: "3 rue Com", ville: "Rabat", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 3 } });
  copro = c.id;
  const users = await Promise.all(["syndic", "conseil", "amina", "omar", "leila", "hamid"].map((n) => admin.utilisateur.create({ data: { email: `${n}-com@test.local`, nom: n.toUpperCase(), prenom: "T", statutCompte: "ACTIF" } })));
  [syndic, conseil, amina, omar, leila, hamid] = users.map((u) => u.id) as [string, string, string, string, string, string];
  await admin.roleUtilisateur.createMany({ data: [
    { utilisateurId: syndic, coproprieteId: copro, role: "SYNDIC" }, { utilisateurId: conseil, coproprieteId: copro, role: "CONSEIL_SYNDICAL" },
    { utilisateurId: amina, coproprieteId: copro, role: "PROPRIETAIRE" }, { utilisateurId: omar, coproprieteId: copro, role: "PROPRIETAIRE" },
    { utilisateurId: leila, coproprieteId: copro, role: "LOCATAIRE" }, { utilisateurId: hamid, coproprieteId: copro, role: "GARDIEN" },
  ] });
  const [l1, l2] = await Promise.all([
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "A1", batiment: "A", tantiemes: "300.00", statut: "OCCUPE" } }),
    admin.lot.create({ data: { coproprieteId: copro, typeLot: "APPARTEMENT", numero: "B1", batiment: "B", tantiemes: "200.00", statut: "OCCUPE" } }),
  ]);
  await admin.lotProprietaire.createMany({ data: [
    { lotId: l1.id, utilisateurId: amina, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
    { lotId: l2.id, utilisateurId: omar, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
  ] });
  await admin.lotOccupant.createMany({ data: [{ lotId: l1.id, utilisateurId: leila, typeOccupation: "LOCATAIRE", dateDebut: new Date("2025-01-01") }] });
});

afterAll(async () => {
  await admin.exportLog.deleteMany({ where: { coproprieteId: copro } });
  await admin.idempotencyKey.deleteMany({ where: { coproprieteId: copro } });
  await admin.notification.deleteMany({ where: { coproprieteId: copro } });
  const annonces = await admin.annonce.findMany({ where: { coproprieteId: copro }, select: { id: true } });
  const ids = annonces.map((a) => a.id);
  await admin.annonceCommentaire.deleteMany({ where: { annonceId: { in: ids } } });
  await admin.annonceLecture.deleteMany({ where: { annonceId: { in: ids } } });
  await admin.document.deleteMany({ where: { coproprieteId: copro } });
  await admin.annonce.deleteMany({ where: { coproprieteId: copro } });
  const sondages = await admin.sondage.findMany({ where: { coproprieteId: copro }, select: { id: true } });
  await admin.sondageReponse.deleteMany({ where: { sondageId: { in: sondages.map((s) => s.id) } } });
  await admin.sondage.deleteMany({ where: { coproprieteId: copro } });
  await admin.contactUtile.deleteMany({ where: { coproprieteId: copro } });
  await admin.auditLog.deleteMany({ where: { coproprieteId: copro } });
  const lots = await admin.lot.findMany({ where: { coproprieteId: copro }, select: { id: true } });
  await admin.lotOccupant.deleteMany({ where: { lotId: { in: lots.map((l) => l.id) } } });
  await admin.lotProprietaire.deleteMany({ where: { lotId: { in: lots.map((l) => l.id) } } });
  await admin.lot.deleteMany({ where: { coproprieteId: copro } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: copro } });
  await admin.utilisateur.deleteMany({ where: { email: { endsWith: "-com@test.local" } } });
  await admin.copropriete.deleteMany({ where: { id: copro } });
  await admin.$disconnect(); await disconnectTenantDb();
});

describe("M21 — assainissement", () => {
  it("neutralise l'HTML et les liens non http(s), garde le Markdown restreint ; idempotent", () => {
    const s = assainirMarkdown("**Coupure** d'eau <script>alert(1)</script> [site](javascript:alert(1)) [Lydec](https://lydec.ma)\n\n\n\n\n- point");
    expect(s).not.toContain("<script>");
    expect(s).toContain("&lt;script&gt;");
    expect(s).toContain("site");
    expect(s).not.toContain("javascript:");
    expect(s).toContain("[Lydec](https://lydec.ma)");
    expect(assainirMarkdown(s)).toBe(s);
    expect(texteBrut(s, 30).length).toBeLessThanOrEqual(30);
  });
});

describe("M21 — annonces, audiences, lectures, commentaires", () => {
  let idProprietaires: string, idBatimentB: string, idTous: string;
  it("audience PROPRIETAIRES : le locataire ne la voit pas (RLS) et ne la reçoit pas (fan-out) ; le conseil ne publie pas d'URGENCE", async () => {
    const a = await creerAnnonce(S(), { titre: "Appel de fonds 2027", contenu: "Réservé aux **copropriétaires**.", categorie: "INFORMATION", audience: "PROPRIETAIRES", epingle: false, commentaires_actives: true, pieces_jointes: [] });
    idProprietaires = a.id;
    await expect(creerAnnonce(C(), { titre: "Fuite", contenu: "x", categorie: "URGENCE", audience: "TOUS", epingle: true, commentaires_actives: false, pieces_jointes: [] })).rejects.toThrow(PermissionRefuseeError);
    // Brouillon : invisible même du propriétaire.
    expect((await listerAnnonces(A(), {}, PAGE, TRI)).rows.map((r) => r.id)).not.toContain(a.id);
    const pub = await publierAnnonce(S(), a.id, {}, randomUUID());
    expect(pub.statut).toBe("PUBLIEE");
    expect(pub.diffusion).toMatchObject({ programmee: false, destinataires: 2, envoyes: 2 }); // amina + omar (le syndic auteur exclu)
    expect((await listerAnnonces(A(), {}, PAGE, TRI)).rows.map((r) => r.id)).toContain(a.id);
    expect((await listerAnnonces(L(), {}, PAGE, TRI)).rows.map((r) => r.id)).not.toContain(a.id);
    expect((await listerAnnonces(G(), {}, PAGE, TRI)).rows.map((r) => r.id)).not.toContain(a.id);
    await expect(obtenirAnnonce(L(), a.id)).rejects.toThrow();
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "ANNONCE_PUBLIEE", utilisateurId: leila } })).toBe(0);
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "ANNONCE_PUBLIEE", utilisateurId: amina } })).toBe(1);
    // Rejeu idempotent : même clé, même payload → même résultat, aucune notification supplémentaire.
    await publierAnnonce(S(), a.id, {}, randomUUID()).catch((e) => expect(e).toBeInstanceOf(CommunicationError));
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "ANNONCE_PUBLIEE", utilisateurId: amina } })).toBe(1);
  });
  it("audience BATIMENT : seuls les propriétaires / occupants du bâtiment ; le locataire du bâtiment A voit A, pas B", async () => {
    const b = await creerAnnonce(C(), { titre: "Ravalement bâtiment B", contenu: "Échafaudage.", categorie: "TRAVAUX", audience: "BATIMENT", batiment: "B", epingle: false, commentaires_actives: true, pieces_jointes: [] });
    idBatimentB = b.id;
    const pub = await publierAnnonce(C(), b.id, {}, randomUUID());
    expect(pub.diffusion).toMatchObject({ destinataires: 1 }); // omar
    expect((await listerAnnonces(O(), {}, PAGE, TRI)).rows.map((r) => r.id)).toContain(b.id);
    expect((await listerAnnonces(A(), {}, PAGE, TRI)).rows.map((r) => r.id)).not.toContain(b.id);
    expect((await listerAnnonces(L(), {}, PAGE, TRI)).rows.map((r) => r.id)).not.toContain(b.id);
  });
  it("URGENCE épinglée pour TOUS : push + SMS, en tête de liste ; lectures : compte pour la gestion, `lu` pour soi, liste interdite au résident", async () => {
    const u = await creerAnnonce(S(), { titre: "Coupure d'eau ce soir", contenu: "De 20h à 23h.", categorie: "URGENCE", audience: "TOUS", epingle: true, commentaires_actives: true, pieces_jointes: [] });
    idTous = u.id;
    const pub = await publierAnnonce(S(), u.id, {}, randomUUID());
    expect(pub.diffusion).toMatchObject({ destinataires: 5 });
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "ANNONCE_URGENTE", utilisateurId: leila, canal: "SMS" } })).toBe(1);
    const liste = await listerAnnonces(L(), {}, PAGE, TRI);
    expect(liste.rows[0]?.id).toBe(u.id);
    expect(liste.rows[0]?.lu).toBe(false);
    expect(liste.rows[0]?.nbLectures).toBeNull();
    expect(liste.non_lues).toBeGreaterThanOrEqual(1);
    const lu1 = await marquerLue(L(), u.id);
    const lu2 = await marquerLue(L(), u.id);
    expect(lu1.deja).toBe(false); expect(lu2.deja).toBe(true);
    await marquerLue(A(), u.id);
    expect((await listerAnnonces(L(), {}, PAGE, TRI)).rows[0]?.lu).toBe(true);
    const stats = await lecturesAnnonce(S(), u.id);
    expect(stats).toMatchObject({ nb_lu: 2, nb_destinataires: 6 });
    await expect(lecturesAnnonce(L(), u.id)).rejects.toThrow(PermissionRefuseeError);
    // Un résident ne lit pas les accusés des autres (RLS annonce_lecture).
    const vues = await withTenant(L(), (db) => db.annonceLecture.findMany({ where: { annonceId: u.id } }));
    expect(vues.map((v) => v.utilisateurId)).toEqual([leila]);
  });
  it("commentaires : assainis, notifient l'auteur, modération syndic (masqué pour les autres, visible de l'auteur), désactivables", async () => {
    const c = await commenterAnnonce(L(), idTous, { contenu: "Merci <b>syndic</b>" });
    expect(c.contenu).toBe("Merci &lt;b&gt;syndic&lt;/b&gt;");
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "ANNONCE_COMMENTAIRE", utilisateurId: syndic } })).toBe(1);
    await expect(masquerCommentaire(C(), idTous, c.id)).rejects.toThrow(PermissionRefuseeError);
    await masquerCommentaire(S(), idTous, c.id);
    expect((await obtenirAnnonce(A(), idTous)).commentaires.map((x) => x.id)).not.toContain(c.id);
    expect((await obtenirAnnonce(L(), idTous)).commentaires.find((x) => x.id === c.id)?.masque).toBe(true);
    expect((await obtenirAnnonce(S(), idTous)).commentaires.find((x) => x.id === c.id)?.masque).toBe(true);
    await expect(commenterAnnonce(L(), idProprietaires, { contenu: "x" })).rejects.toThrow(); // hors audience → introuvable (RLS)
    const fermee = await creerAnnonce(S(), { titre: "Règlement", contenu: "Rappel.", categorie: "REGLEMENT", audience: "TOUS", epingle: false, commentaires_actives: false, pieces_jointes: [] });
    await publierAnnonce(S(), fermee.id, {}, randomUUID());
    await expect(commenterAnnonce(A(), fermee.id, { contenu: "?" })).rejects.toMatchObject({ code: "COMMENTAIRES_DESACTIVES" });
    await archiverAnnonce(S(), fermee.id);
    expect((await listerAnnonces(A(), {}, PAGE, TRI)).rows.map((r) => r.id)).not.toContain(fermee.id);
    expect(await admin.auditLog.count({ where: { coproprieteId: copro, action: { in: ["ANNONCE_PUBLIEE", "ANNONCE_ARCHIVEE", "COMMENTAIRE_MASQUE"] } } })).toBeGreaterThanOrEqual(5);
  });
  it("publication programmée : reste brouillon (invisible) puis publiée par le job horaire, une seule fois", async () => {
    const p = await creerAnnonce(S(), { titre: "AG du 15", contenu: "Convocation à venir.", categorie: "AG", audience: "TOUS", epingle: false, commentaires_actives: true, pieces_jointes: [] });
    const dans2h = new Date(Date.now() + 2 * 3600_000).toISOString();
    const r = await publierAnnonce(S(), p.id, { publie_le: dans2h }, randomUUID());
    expect(r.diffusion.programmee).toBe(true);
    expect((await listerAnnonces(A(), {}, PAGE, TRI)).rows.map((x) => x.id)).not.toContain(p.id);
    expect(await withTenant(SYS(), (db) => executerProgrammees(db, copro, new Date()))).toMatchObject({ publiees: 0 });
    const plusTard = new Date(Date.now() + 3 * 3600_000);
    expect(await withTenant(SYS(), (db) => executerProgrammees(db, copro, plusTard))).toMatchObject({ publiees: 1 });
    expect(await withTenant(SYS(), (db) => executerProgrammees(db, copro, plusTard))).toMatchObject({ publiees: 0 });
    expect((await listerAnnonces(A(), {}, PAGE, TRI)).rows.map((x) => x.id)).toContain(p.id);
    void idBatimentB;
  });
});

describe("M21 — sondages consultatifs", () => {
  let idSondage: string;
  it("ouverture notifie l'audience ; réponse unique (409), choix contrôlés, résultats agrégés pondérés sans jamais un répondant", async () => {
    const s = await creerSondage(S(), { question: "Repeindre le hall ?", options: [{ id: "oui", libelle: "Oui" }, { id: "non", libelle: "Non" }], choix_multiple: false, anonyme: true, audience: "PROPRIETAIRES", ponderation_tantiemes: true, date_fin: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    idSondage = s.id;
    expect(s.mention).toMatch(/aucune valeur de vote/);
    expect((await listerSondages(A(), {}, PAGE, { champ: "date_fin", sens: "asc" })).rows.map((x) => x.id)).not.toContain(s.id); // brouillon
    await ouvrirSondage(S(), s.id, randomUUID());
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "SONDAGE_OUVERT" } })).toBe(2); // amina + omar
    expect((await listerSondages(L(), {}, PAGE, { champ: "date_fin", sens: "asc" })).rows.map((x) => x.id)).not.toContain(s.id);
    await expect(repondreSondage(L(), s.id, { choix: ["oui"] }, randomUUID())).rejects.toThrow(); // hors audience (RLS → introuvable)
    await expect(repondreSondage(A(), s.id, { choix: ["peut-etre"] }, randomUUID())).rejects.toMatchObject({ code: "SONDAGE_CHOIX_INVALIDE" });
    await expect(repondreSondage(A(), s.id, { choix: ["oui", "non"] }, randomUUID())).rejects.toMatchObject({ code: "SONDAGE_CHOIX_INVALIDE" });
    // Avant de répondre : pas de résultats pour un résident.
    expect((await obtenirSondage(A(), s.id)).resultats).toBeNull();
    const rep = await repondreSondage(A(), s.id, { choix: ["oui"] }, randomUUID());
    expect(rep.maReponse).toEqual(["oui"]);
    expect(rep.resultats?.nb_reponses).toBe(1);
    await expect(repondreSondage(A(), s.id, { choix: ["non"] }, randomUUID())).rejects.toMatchObject({ code: "SONDAGE_DEJA_REPONDU" });
    await repondreSondage(O(), s.id, { choix: ["non"] }, randomUUID());
    const res = await resultatsSondage(S(), s.id);
    expect(res.nb_reponses).toBe(2);
    expect(res.nb_destinataires).toBe(2);
    const oui = res.options.find((o) => o.id === "oui")!;
    const non = res.options.find((o) => o.id === "non")!;
    expect(oui).toMatchObject({ nb: 1, pourcentage: 50, tantiemes: "300.00", pourcentage_tantiemes: 60 });
    expect(non).toMatchObject({ nb: 1, pourcentage: 50, tantiemes: "200.00", pourcentage_tantiemes: 40 });
    expect(JSON.stringify(res)).not.toContain(amina);
    // Négatif : même le syndic ne lit aucune ligne sondage_reponse d'un autre (RLS) — seule la sienne.
    expect(await withTenant(S(), (db) => db.sondageReponse.findMany({ where: { sondageId: s.id } }))).toEqual([]);
    expect((await withTenant(O(), (db) => db.sondageReponse.findMany({ where: { sondageId: s.id } }))).map((r) => r.utilisateurId)).toEqual([omar]);
  });
  it("clôture (manuelle idempotente / job à l'échéance) : SONDAGE_CLOS, résultats visibles de tous, plus de réponse possible", async () => {
    await cloreSondage(S(), idSondage, randomUUID());
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "SONDAGE_CLOS" } })).toBe(2);
    await expect(cloreSondage(S(), idSondage, randomUUID())).rejects.toMatchObject({ code: "SONDAGE_STATUT_INVALIDE" });
    expect((await obtenirSondage(O(), idSondage)).resultats?.nb_reponses).toBe(2);
    await expect(repondreSondage(O(), idSondage, { choix: ["oui"] }, randomUUID())).rejects.toMatchObject({ code: "SONDAGE_STATUT_INVALIDE" });
    const echu = await creerSondage(C(), { question: "Barbecue en juin ?", options: [{ libelle: "Oui" }, { libelle: "Non" }], choix_multiple: false, anonyme: true, audience: "TOUS", ponderation_tantiemes: false, date_fin: new Date(Date.now() + 3600_000).toISOString() });
    await ouvrirSondage(C(), echu.id, randomUUID());
    expect(await withTenant(SYS(), (db) => executerProgrammees(db, copro, new Date(Date.now() + 2 * 3600_000)))).toMatchObject({ sondages_clos: 1 });
    expect((await obtenirSondage(L(), echu.id)).statut).toBe("CLOS");
  });
});

describe("M21 — digest hebdomadaire, contacts, préférences", () => {
  it("digest : un par membre et par semaine (rejeu = 0), respecte les préférences (AUCUN), canal choisi", async () => {
    await definirPreferencesNotification(G(), { ...PREFERENCES_DEFAUT, digest_hebdo: false, canal_digest: "PUSH", annonces_push: true });
    await definirPreferencesNotification(O(), { ...PREFERENCES_DEFAUT, digest_hebdo: true, canal_digest: "PUSH", annonces_push: true });
    const now = new Date();
    const r1 = await withTenant(SYS(), (db) => executerDigest(db, copro, now));
    expect(r1.digests).toBeGreaterThanOrEqual(3); // syndic (annonces conseil non lues), conseil, omar ; pas hamid (désactivé)
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "COMMUNICATION_DIGEST", utilisateurId: hamid } })).toBe(0);
    expect(await admin.notification.count({ where: { coproprieteId: copro, templateCode: "COMMUNICATION_DIGEST", utilisateurId: omar, canal: "PUSH" } })).toBe(1);
    const r2 = await withTenant(SYS(), (db) => executerDigest(db, copro, now));
    expect(r2.digests).toBe(0);
  });
  it("contacts utiles : syndic seul ; lecture par tout membre (RLS tenant)", async () => {
    await creerContact(S(), { libelle: "Pompiers", telephone: "15", ordre: 1 });
    await expect(creerContact(C(), { libelle: "Police", telephone: "19", ordre: 2 })).rejects.toThrow(PermissionRefuseeError);
    const vus = await withTenant(L(), (db) => db.contactUtile.findMany({ where: { coproprieteId: copro } }));
    expect(vus.map((c) => c.libelle)).toEqual(["Pompiers"]);
  });
});
