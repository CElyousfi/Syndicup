/**
 * Service notifications — M9 (Master Spec Partie 7).
 *
 * Aucun agrégateur SMS/FCM/email réel n'est branché dans cet environnement (⚠️ même limitation
 * que le sandbox CMI, voir M5/ROADMAP_BACKLOG.md) : `envoyerNotification` simule l'envoi en
 * écrivant directement la ligne `notification` avec `statut_envoi = ENVOYE`. Le point d'intégration
 * réel (Resend/FCM/agrégateur SMS marocain) reste à brancher ici sans changer la signature ni les
 * appelants (ag.ts, incidents.ts, etc.), conformément à Doc A §12.2 "Preuve de l'envoi".
 */
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type { Prisma, Notification } from "@prisma/client";
import { uuidv7 } from "uuidv7";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}

export interface EnvoyerNotificationParams {
  coproprieteId: string;
  utilisateurId: string;
  templateCode: string;
  canal: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";
  contenuJson?: Prisma.InputJsonValue;
}

/**
 * Helper interne, appelé par les autres modules (ex. `ag.convoquer`) au sein d'une transaction
 * `withTenant` déjà ouverte — pas de vérification de permission ici, l'appelant a déjà le contexte
 * légitime (ex. syndic qui convoque une AG déclenche l'envoi aux copropriétaires, pas eux-mêmes).
 *
 * ⚠️ INSERT brut (sans `RETURNING`) plutôt que `db.notification.create()` : la policy RLS
 * "tenant_isolation" (SELECT) exige `utilisateur_id = app.current_user_id`, or l'expéditeur
 * (souvent le syndic, via son propre contexte tenant) n'est presque jamais le destinataire de la
 * notification qu'il envoie. `.create()` fait un `INSERT ... RETURNING *` en interne, et Postgres
 * applique la policy SELECT à la ligne retournée par un RETURNING — pas seulement le WITH CHECK de
 * l'INSERT — donc `.create()` échoue ici avec une violation RLS même quand le WITH CHECK (limité à
 * `copropriete_id`) est satisfait. On construit donc la ligne nous-mêmes (id, horodatage) plutôt
 * que de la relire.
 */
export async function envoyerNotification(
  db: TenantDb,
  params: EnvoyerNotificationParams
): Promise<Notification> {
  const id = uuidv7();
  const horodatageEnvoi = new Date();
  await db.$executeRaw`
    INSERT INTO notification
      (id, copropriete_id, utilisateur_id, template_code, canal, statut_envoi, contenu_json, horodatage_envoi)
    VALUES
      (${id}::uuid, ${params.coproprieteId}::uuid, ${params.utilisateurId}::uuid, ${params.templateCode},
       ${params.canal}::"CanalNotification", 'ENVOYE'::"StatutEnvoiNotification",
       ${params.contenuJson === undefined ? null : (params.contenuJson as Prisma.InputJsonObject)}::jsonb,
       ${horodatageEnvoi})
  `;
  return {
    id,
    coproprieteId: params.coproprieteId,
    utilisateurId: params.utilisateurId,
    templateCode: params.templateCode,
    canal: params.canal,
    statutEnvoi: "ENVOYE",
    contenuJson: params.contenuJson ?? null,
    accuseReception: null,
    lu: false,
    luLe: null,
    horodatageEnvoi,
  } as Notification;
}

export async function listerMesNotifications(ctx: TenantContext) {
  if (can("notifications.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter les notifications.");
  }
  return withTenant(ctx, (db) =>
    db.notification.findMany({
      where: { utilisateurId: ctx.utilisateurId },
      orderBy: { horodatageEnvoi: "desc" },
    })
  );
}

/**
 * Master Spec Partie 3.2 : `PATCH /notifications/:id/read`. La policy RLS "tenant_isolation" sur
 * `notification` restreint déjà la ligne à son destinataire — la vérification `utilisateurId` en
 * service ci-dessous transforme un accès RLS-bloqué en 404 explicite plutôt qu'en erreur SQL brute.
 */
export async function marquerLue(ctx: TenantContext, notificationId: string) {
  if (can("notifications.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé.");
  }
  return withTenant(ctx, async (db) => {
    const notification = await db.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.utilisateurId !== ctx.utilisateurId) {
      throw new IntrouvableError("Notification introuvable.");
    }
    if (notification.lu) return notification;
    return db.notification.update({
      where: { id: notificationId },
      data: { lu: true, luLe: new Date() },
    });
  });
}
