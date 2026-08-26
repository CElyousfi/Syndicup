/**
 * Interface commune des transports de notification (Master Spec Partie 7) — un adaptateur par
 * canal, env-gated (M0). Le statut retourné est écrit TEL QUEL dans la ligne `notification`
 * (preuve d'envoi Doc A §12.2) — jamais de ENVOYE simulé.
 */
export type CanalNotification = "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";

export interface MessageNotification {
  destinataire: {
    utilisateurId: string;
    email: string | null;
    telephone: string | null;
  };
  titre: string;
  corps: string;
  langue: "FR" | "AR";
}

export interface ResultatEnvoi {
  statut: "ENVOYE" | "EN_ATTENTE" | "ECHOUE";
  fournisseurRef?: string;
}

export interface NotificationTransport {
  readonly canal: CanalNotification;
  envoyer(message: MessageNotification): Promise<ResultatEnvoi>;
}
