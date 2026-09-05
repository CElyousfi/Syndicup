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
    /** Jetons FCM des appareils du destinataire (canal PUSH — M19). */
    tokensPush?: string[];
  };
  titre: string;
  corps: string;
  langue: "FR" | "AR";
  /** Code du template + variables (chaînes) — deep-links côté mobile (brief §8.2). */
  templateCode?: string;
  donnees?: Record<string, string>;
}

export interface ResultatEnvoi {
  statut: "ENVOYE" | "EN_ATTENTE" | "ECHOUE";
  fournisseurRef?: string;
  /** Jetons refusés définitivement par le fournisseur — à retirer de la base (PUSH). */
  tokensInvalides?: string[];
}

export interface NotificationTransport {
  readonly canal: CanalNotification;
  envoyer(message: MessageNotification): Promise<ResultatEnvoi>;
}
