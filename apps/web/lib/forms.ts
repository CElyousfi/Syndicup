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
      /**
       * Saisie renvoyée telle quelle (chaînes uniquement — jamais un fichier, un mot de passe ni
       * un RIB) : React 19 réinitialise un formulaire après son action, les champs la relisent
       * via `formValue(state, nom, initial)` (lib/form-values.ts) pour ne rien perdre.
       */
      values?: FormValues;
      /**
       * Fichiers déjà téléversés dans le Storage avant une écriture idempotente dont l'issue est
       * inconnue : le formulaire les renvoie tels quels (champs cachés) au lieu de re-téléverser,
       * pour que le rejeu porte le MÊME contenu sous la même clé (<FichiersEnvoyes>).
       */
      envoyes?: FichierEnvoye[];
    }
  | { status: "success"; message?: string; data?: unknown };

/** Valeurs soumises : une chaîne, ou la liste des valeurs d'un nom répété (cases multiples). */
export type FormValues = Record<string, string | string[]>;

/** Fichier déjà présent dans le Storage : chemin renvoyé par l'API (`storage_path`) + nom affiché. */
export interface FichierEnvoye {
  chemin: string;
  nom: string;
}

/**
 * Codes d'échec où l'on NE SAIT PAS si l'écriture a eu lieu : la même clé d'idempotence doit être
 * rejouée. 409 CONFLICT en fait partie — même clé déjà traitée avec un autre contenu, ou encore en
 * cours : le geste a peut-être déjà été enregistré, tirer une clé neuve risquerait un doublon.
 */
export const ISSUES_INCONNUES: ReadonlySet<string> = new Set([
  "NETWORK",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
  "UNEXPECTED",
  "CONFLICT",
]);

export type FormErrorState = Extract<FormState, { status: "error" }>;

export const IDLE: FormState = { status: "idle" };

export function success(message?: string, data?: unknown): FormState {
  return { status: "success", message, data };
}

export function fieldError(state: FormState, name: string): string | undefined {
  return state.status === "error" ? state.fields?.[name] : undefined;
}
