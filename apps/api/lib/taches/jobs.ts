/**
 * Jobs Tâches — M22.
 *  - `taches-rappels-quotidien` (08:00) : J-3, J-0 et retard → `TACHE_ECHEANCE` à l'assigné(e) (ou au
 *    syndic sans assigné), chacun une seule fois (`rappel_j3_le` / `rappel_j0_le` / `rappel_retard_le`) ;
 *    le lundi, synthèse `TACHES_EN_RETARD_HEBDO` au syndic et au conseil (une fois par semaine ISO).
 * Une transaction tenant (contexte système) par copropriété.
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { dateUtc, isoDate, journal, syndics } from "./taches";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
const ctxSysteme = (coproprieteId: string): TenantContext => ({ utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" });
const OUVERTES = ["A_FAIRE", "EN_COURS", "BLOQUEE"] as const;

export async function executerRappelsTaches(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ j3: number; j0: number; retard: number; hebdo: number }> {
  const res = { j3: 0, j0: 0, retard: 0, hebdo: 0 };
  const ctx = { coproprieteId, utilisateurId: SYSTEME };
  const aujourdhui = dateUtc(isoDate(now));
  const dansTroisJours = new Date(aujourdhui.getTime() + 3 * 86_400_000);
  const dest = async (assigneeId: string | null) => (assigneeId ? [assigneeId] : await syndics(db, coproprieteId));
  const ouvertes = await db.tache.findMany({ where: { coproprieteId, statut: { in: [...OUVERTES] }, dateEcheance: { not: null } }, select: { id: true, titre: true, assigneeId: true, dateEcheance: true, rappelJ3Le: true, rappelJ0Le: true, rappelRetardLe: true } });
  for (const t of ouvertes) {
    const echeance = t.dateEcheance!;
    let type: "j3" | "j0" | "retard" | null = null;
    if (!t.rappelRetardLe && echeance < aujourdhui) type = "retard";
    else if (!t.rappelJ0Le && echeance.getTime() === aujourdhui.getTime()) type = "j0";
    else if (!t.rappelJ3Le && echeance > aujourdhui && echeance <= dansTroisJours) type = "j3";
    if (!type) continue;
    for (const u of await dest(t.assigneeId)) {
      await envoyerNotification(db, { coproprieteId, utilisateurId: u, templateCode: "TACHE_ECHEANCE", canal: "PUSH", contenuJson: { tache_id: t.id, titre: t.titre, date_echeance: isoDate(echeance), type } });
    }
    await db.tache.update({ where: { id: t.id }, data: type === "j3" ? { rappelJ3Le: now } : type === "j0" ? { rappelJ0Le: now } : { rappelRetardLe: now } });
    await journal(db, ctx, t.id, "RAPPEL", { type, date_echeance: isoDate(echeance) });
    res[type] += 1;
  }
  // Synthèse hebdomadaire (lundi) des retards au syndic + conseil — une fois par semaine ISO.
  if (now.getUTCDay() === 1) {
    const retards = ouvertes.filter((t) => t.dateEcheance! < aujourdhui);
    if (retards.length) {
      const lundi = aujourdhui;
      const membres = await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: { in: ["SYNDIC", "CONSEIL_SYNDICAL"] } }, select: { utilisateurId: true }, distinct: ["utilisateurId"] });
      for (const { utilisateurId } of membres) {
        // Idempotence par semaine ISO portée par l'horloge injectée (`semaine` dans contenu_json),
        // jamais par l'horodatage réel d'envoi : rejouable et testable à date fixe.
        const deja = await db.notification.findFirst({ where: { coproprieteId, utilisateurId, templateCode: "TACHES_EN_RETARD_HEBDO", contenuJson: { path: ["semaine"], equals: isoDate(lundi) } }, select: { id: true } });
        if (deja) continue;
        await envoyerNotification(db, { coproprieteId, utilisateurId, templateCode: "TACHES_EN_RETARD_HEBDO", canal: "PUSH", contenuJson: { nb: String(retards.length), titres: retards.slice(0, 5).map((t) => t.titre).join(" · "), semaine: isoDate(lundi) } });
        res.hebdo += 1;
      }
    }
  }
  return res;
}

export const executerRappelsTachesCopropriete = (coproprieteId: string, now = new Date()) => withTenant(ctxSysteme(coproprieteId), (db) => executerRappelsTaches(db, coproprieteId, now));

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
export const executerRappelsTachesToutesCoproprietes = (now = new Date()) => pourToutes((id) => executerRappelsTachesCopropriete(id, now));
