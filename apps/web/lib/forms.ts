/**
 * Contrat commun des Server Actions de formulaire — consommé par useActionState côté client.
 * Module CLIENT-COMPATIBLE (types, constantes, aides pures) : la construction d'un état d'erreur
 * à partir d'une réponse API, qui a besoin de la langue de la requête, vit dans
 * lib/forms-server.ts (`fromApiError`).
 *
 * Un état d'erreur porte TOUJOURS, déjà localisés côté serveur : un titre, un message, la
 * prochaine étape (Réessayer / Se reconnecter / Actualiser / Contacter le syndic) et la
 * référence courte de la requête — <FormAlert> n'a plus qu'à les afficher.
 */
import type { ApiErrorCode } from "./api/types";
import type { ErrorAction } from "./errors";

export type FormState =
  | { status: "idle" }
  | {
      status: "error";
      code: ApiErrorCode;
      /** Message localisé, prêt à afficher. */
      message: string;
      /** Titre localisé (absent pour une simple erreur de champ). */
      title?: string;
      fields?: Record<string, string>;
      requestId?: string;
      /** Référence courte formatée (« Réf. 1a2b3c4d »), copiable. */
      reference?: string;
      /** 422 « gaté légalement » (paramètre légal non configuré) — bannière, pas erreur rouge. */
      legalGate?: boolean;
      retryAfter?: number;
      /** Prochaine étape proposée, et son libellé localisé. */
      action?: ErrorAction;
      actionLabel?: string;
      /** Lien de l'action (reconnexion : /{locale}/connexion?next=…). */
      actionHref?: string;
      /** Libellés du bouton de copie de la référence. */
      copyLabel?: string;
      copiedLabel?: string;
      /** Message brut du serveur (FR) — repli texte pour les rares tests de contenu. */
      serverMessage?: string;
    }
  | { status: "success"; message?: string; data?: unknown };

export type FormErrorState = Extract<FormState, { status: "error" }>;

export const IDLE: FormState = { status: "idle" };

export function success(message?: string, data?: unknown): FormState {
  return { status: "success", message, data };
}

export function fieldError(state: FormState, name: string): string | undefined {
  return state.status === "error" ? state.fields?.[name] : undefined;
}
