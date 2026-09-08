/**
 * Jobs Communication — M21.
 *  - `communication-digest-hebdo` (lundi 09:00) : par membre actif, annonces publiées non lues +
 *    sondages ouverts, envoyés sur le canal de sa préférence (`preferences_notification_json`,
 *    défaut EMAIL — repli SMS/PUSH géré par `envoyerNotification`). Idempotent : au plus un digest
 *    par utilisateur et par semaine ISO (recherche de la notification déjà envoyée).
 *  - `communication-programmees-horaire` : publie les annonces programmées (`publie_le` atteint,
 *    encore BROUILLON) avec leur fan-out, clôt les sondages dont `date_fin` est passée.
 * Une transaction tenant (contexte système) par copropriété.
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { audit, diffuserAnnonce, preferencesDe } from "./communication";
import { cloreSondageDb } from "./sondages";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
const ctxSysteme = (coproprieteId: string): TenantContext => ({ utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" });

export function debutSemaineIso(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const jour = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - jour);
  return d;
}

export async function executerDigest(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ digests: number }> {
  const depuis = debutSemaineIso(now);
  const membres = await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: { not: "PRESTATAIRE" } }, select: { utilisateurId: true }, distinct: ["utilisateurId"] });
  const annonces = await db.annonce.findMany({ where: { coproprieteId, statut: "PUBLIEE", OR: [{ expireLe: null }, { expireLe: { gt: now } }] }, select: { id: true, titre: true, audience: true, batiment: true, publieLe: true } });
  const sondages = await db.sondage.findMany({ where: { coproprieteId, statut: "OUVERT", dateFin: { gt: now } }, select: { id: true, question: true, audience: true, batiment: true } });
  if (!annonces.length && !sondages.length) return { digests: 0 };
  const { destinatairesAudience } = await import("./communication");
  // Audience résolue une fois par (audience, bâtiment).
  const cache = new Map<string, Set<string>>();
  const audienceDe = async (audience: (typeof annonces)[number]["audience"], batiment: string | null) => {
    const cle = `${audience}|${batiment ?? ""}`;
    if (!cache.has(cle)) cache.set(cle, new Set(await destinatairesAudience(db, coproprieteId, audience, batiment)));
    return cache.get(cle)!;
  };
  let digests = 0;
  for (const { utilisateurId } of membres) {
    const deja = await db.notification.findFirst({ where: { coproprieteId, utilisateurId, templateCode: "COMMUNICATION_DIGEST", horodatageEnvoi: { gte: depuis } }, select: { id: true } });
    if (deja) continue;
    const u = await db.utilisateur.findUnique({ where: { id: utilisateurId }, select: { preferencesNotificationJson: true } });
    const pref = preferencesDe(u?.preferencesNotificationJson);
    if (!pref.digest_hebdo || pref.canal_digest === "AUCUN") continue;
    const lues = new Set((await db.annonceLecture.findMany({ where: { utilisateurId, annonceId: { in: annonces.map((a) => a.id) } }, select: { annonceId: true } })).map((l) => l.annonceId));
    const nonLues: typeof annonces = [];
    for (const a of annonces) if (!lues.has(a.id) && (await audienceDe(a.audience, a.batiment)).has(utilisateurId)) nonLues.push(a);
    const repondus = new Set((await db.sondageReponse.findMany({ where: { utilisateurId, sondageId: { in: sondages.map((s) => s.id) } }, select: { sondageId: true } })).map((r) => r.sondageId));
    const ouverts: typeof sondages = [];
    for (const s of sondages) if (!repondus.has(s.id) && (await audienceDe(s.audience, s.batiment)).has(utilisateurId)) ouverts.push(s);
    if (!nonLues.length && !ouverts.length) continue;
    await envoyerNotification(db, {
      coproprieteId,
      utilisateurId,
      templateCode: "COMMUNICATION_DIGEST",
      canal: pref.canal_digest,
      contenuJson: { semaine: depuis.toISOString().slice(0, 10), nb_annonces: String(nonLues.length), nb_sondages: String(ouverts.length), titres: [...nonLues.map((a) => a.titre), ...ouverts.map((s) => s.question)].slice(0, 5).join(" · ") },
    });
    digests += 1;
  }
  return { digests };
}

export async function executerProgrammees(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ publiees: number; sondages_clos: number }> {
  const ctx = ctxSysteme(coproprieteId);
  const res = { publiees: 0, sondages_clos: 0 };
  const dues = await db.annonce.findMany({ where: { coproprieteId, statut: "BROUILLON", publieLe: { not: null, lte: now } } });
  for (const a of dues) {
    await db.annonce.update({ where: { id: a.id }, data: { statut: "PUBLIEE" } });
    const diffusion = await diffuserAnnonce(db, ctx, a);
    await audit(db, ctx, "ANNONCE_PUBLIEE", "annonce", a.id, { statut: "BROUILLON" }, { statut: "PUBLIEE", programmee: true, ...diffusion });
    res.publiees += 1;
  }
  const echus = await db.sondage.findMany({ where: { coproprieteId, statut: "OUVERT", dateFin: { lte: now } }, select: { id: true } });
  for (const s of echus) {
    await cloreSondageDb(db, ctx, s.id, "echeance");
    res.sondages_clos += 1;
  }
  return res;
}

export const executerDigestCopropriete = (coproprieteId: string, now = new Date()) => withTenant(ctxSysteme(coproprieteId), (db) => executerDigest(db, coproprieteId, now));
export const executerProgrammeesCopropriete = (coproprieteId: string, now = new Date()) => withTenant(ctxSysteme(coproprieteId), (db) => executerProgrammees(db, coproprieteId, now));

async function pourToutes<T extends Record<string, number>>(fn: (id: string) => Promise<T>) {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total = { coproprietes: 0, compteurs: {} as Record<string, number>, erreurs: [] as string[] };
  try {
    for (const { id } of await raw.copropriete.findMany({ where: { statut: "ACTIVE" }, select: { id: true } })) {
      total.coproprietes += 1;
      try {
        const r = await fn(id);
        for (const [k, v] of Object.entries(r)) total.compteurs[k] = (total.compteurs[k] ?? 0) + v;
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}
export const executerDigestToutesCoproprietes = (now = new Date()) => pourToutes((id) => executerDigestCopropriete(id, now));
export const executerProgrammeesToutesCoproprietes = (now = new Date()) => pourToutes((id) => executerProgrammeesCopropriete(id, now));
