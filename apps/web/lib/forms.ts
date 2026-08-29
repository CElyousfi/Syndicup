/**
 * Contrat commun des Server Actions de formulaire — consommé par useActionState côté client.
 * Les erreurs métier (422) portent le message français de l'API, à afficher tel quel ;
 * VALIDATION_ERROR porte `fields` (champ → message) à afficher sous chaque champ.
 */
import type { ApiError } from "./api/types";

export type FormState =
  | { status: "idle" }
  | {
      status: "error";
      code: ApiError["code"] | "NETWORK";
      message: string;
      fields?: Record<string, string>;
      requestId?: string;
      /** 422 « gaté légalement » (paramètre légal non configuré) — bannière, pas erreur rouge. */
      legalGate?: boolean;
      retryAfter?: number;
    }
  | { status: "success"; message?: string; data?: unknown };

export const IDLE: FormState = { status: "idle" };

/** Heuristique : un 422 dont le message pointe une valeur légale non configurée (brief §6.3). */
function isLegalGate(error: ApiError): boolean {
  if (error.code !== "UNPROCESSABLE_ENTITY") return false;
  return /non configur|confirmation juridique|LEGAL_QUESTIONS/i.test(error.message);
}

export function fromApiError(e: {
  error: ApiError;
  requestId?: string;
  retryAfter?: number;
}): FormState {
  return {
    status: "error",
    code: e.error.code,
    message: e.error.message,
    fields: e.error.fields,
    requestId: e.requestId,
    legalGate: isLegalGate(e.error),
    retryAfter: e.retryAfter,
  };
}

export function success(message?: string, data?: unknown): FormState {
  return { status: "success", message, data };
}

export function fieldError(state: FormState, name: string): string | undefined {
  return state.status === "error" ? state.fields?.[name] : undefined;
}
