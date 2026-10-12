/**
 * Résumé du matin (opt-in, `preferences_notification_json.resume_matin`) — un push discret à
 * 08:00 (Casablanca) par membre actif : charges dues et prochaine échéance, prochaine AG,
 * incidents ouverts (syndic), annonces non lues, visiteurs en attente (gardien). Rien d'envoyé
 * quand il n'y a rien à dire. Idempotent : au plus un par utilisateur et par jour.
 * Le contenu vient de l'instantané widget (lib/users/widget.ts) lu SOUS LE RÔLE du destinataire
 * (RLS exacte — personne ne reçoit ce qu'il ne verrait pas dans l'app).
 */
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type { Role } from "../auth/permissions";
import { instantaneWidget } from "../users/widget";
import { composerResume } from "./resume-matin-compose";
import { preferencesDe } from "../communication/communication";
import { envoyerNotification } from "./notifications";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
const ctxSysteme = (coproprieteId: string): TenantContext => ({ utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" });

export async function executerResumeMatin(coproprieteId: string, now = new Date()): Promise<{ resumes: number }> {
  return withTenant(ctxSysteme(coproprieteId), async (db) => {
    const debutJour = new Date(now);
    debutJour.setUTCHours(0, 0, 0, 0);
    const membres = await db.roleUtilisateur.findMany({
      where: { coproprieteId, actif: true, role: { notIn: ["PRESTATAIRE", "SUPER_ADMIN"] } },
      select: { utilisateurId: true, role: true, utilisateur: { select: { languePreferee: true, preferencesNotificationJson: true } } },
    });
    const copro = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { nom: true } });
    let resumes = 0;
    const vus = new Set<string>();
    for (const m of membres) {
      if (vus.has(m.utilisateurId)) continue;
      vus.add(m.utilisateurId);
      if (!preferencesDe(m.utilisateur.preferencesNotificationJson).resume_matin) continue;
      const deja = await db.notification.findFirst({ where: { coproprieteId, utilisateurId: m.utilisateurId, templateCode: "RESUME_MATIN", horodatageEnvoi: { gte: debutJour } }, select: { id: true } });
      if (deja) continue;
      const langue = (m.utilisateur.languePreferee ?? "FR") as "FR" | "AR";
      const snapshot = await instantaneWidget({ utilisateurId: m.utilisateurId, coproprieteId, role: m.role as Role }).catch(() => null);
      if (!snapshot) continue;
      const resume = composerResume(snapshot, langue, now);
      if (!resume) continue;
      await envoyerNotification(db, { coproprieteId, utilisateurId: m.utilisateurId, templateCode: "RESUME_MATIN", canal: "PUSH", contenuJson: { residence: copro?.nom ?? "SyndicUp", resume } });
      resumes += 1;
    }
    return { resumes };
  });
}

export async function executerResumeMatinToutesCoproprietes(now = new Date()) {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total = { coproprietes: 0, resumes: 0, erreurs: [] as string[] };
  try {
    for (const { id } of await raw.copropriete.findMany({ where: { statut: "ACTIVE" }, select: { id: true } })) {
      total.coproprietes += 1;
      try {
        total.resumes += (await executerResumeMatin(id, now)).resumes;
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}
