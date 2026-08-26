/**
 * Service notifications — M9 (Master Spec Partie 7).
 *
 * L'envoi réel passe par les adaptateurs de ./transports (env-gated — noop par défaut tant que
 * M0 n'a pas provisionné Resend/FCM/agrégateur SMS). Le statut écrit dans la ligne
 * `notification` est CELUI RETOURNÉ par le transport (Doc A §12.2 "Preuve de l'envoi") :
 * EN_ATTENTE en dev (noop), ENVOYE seulement quand un fournisseur a réellement accepté le
 * message, ECHOUE sinon. Le rendu FR/AR suit `utilisateur.langue_preferee` (Partie 7.3) via
 * le registre ./templates ; un template_code hors registre est envoyé sans rendu (contenu_json
 * brut) — les codes émis par le code applicatif doivent tous exister dans le registre.
 */
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type { Prisma, Notification } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { render, templateExiste } from "./templates";
import { transportPour } from "./transports";
import { logger } from "../logging/logger";

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
  // Destinataire (langue + coordonnées) — visible via la policy utilisateur_visibilite quand
  // l'expéditeur est syndic/gardien du même tenant ; repli FR/coordonnées nulles sinon.
  const destinataire = await db.utilisateur
    .findUnique({
      where: { id: params.utilisateurId },
      select: { email: true, telephone: true, languePreferee: true },
    })
    .catch(() => null);
  const langue = (destinataire?.languePreferee ?? "FR") as "FR" | "AR";

  let statutEnvoi: "EN_ATTENTE" | "ENVOYE" | "ECHOUE" = "EN_ATTENTE";
  try {
    const rendu = templateExiste(params.templateCode)
      ? render(
          params.templateCode,
          langue,
          (params.contenuJson ?? {}) as Record<string, unknown>
        )
      : {
          titre: params.templateCode,
          corps: JSON.stringify(params.contenuJson ?? {}),
          langue,
        };
    const resultat = await transportPour(params.canal).envoyer({
      destinataire: {
        utilisateurId: params.utilisateurId,
        email: destinataire?.email ?? null,
        telephone: destinataire?.telephone ?? null,
      },
      titre: rendu.titre,
      corps: rendu.corps,
      langue,
    });
    statutEnvoi = resultat.statut;
  } catch (e) {
    // Un transport défaillant ne doit jamais faire échouer l'écriture métier appelante —
    // la ligne notification trace l'échec (ECHOUE) pour reprise.
    logger.error("Transport de notification en erreur", {
      canal: params.canal,
      template_code: params.templateCode,
      erreur: e instanceof Error ? e.message : String(e),
    });
    statutEnvoi = "ECHOUE";
  }

  const id = uuidv7();
  const horodatageEnvoi = new Date();
  await db.$executeRaw`
    INSERT INTO notification
      (id, copropriete_id, utilisateur_id, template_code, canal, statut_envoi, contenu_json, horodatage_envoi)
    VALUES
      (${id}::uuid, ${params.coproprieteId}::uuid, ${params.utilisateurId}::uuid, ${params.templateCode},
       ${params.canal}::"CanalNotification", ${statutEnvoi}::"StatutEnvoiNotification",
       ${params.contenuJson === undefined ? null : (params.contenuJson as Prisma.InputJsonObject)}::jsonb,
       ${horodatageEnvoi})
  `;
  return {
    id,
    coproprieteId: params.coproprieteId,
    utilisateurId: params.utilisateurId,
    templateCode: params.templateCode,
    canal: params.canal,
    statutEnvoi,
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
