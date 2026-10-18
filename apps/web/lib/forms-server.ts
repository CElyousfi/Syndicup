/**
 * Construction des états d'erreur des Server Actions — SERVEUR uniquement (lit la langue et le
 * chemin de la requête). Chaque échec devient un FormState déjà localisé : titre, message,
 * prochaine étape, référence. Les Server Actions n'écrivent plus jamais de texte d'erreur.
 */
import type { ApiError } from "./api/types";
import { describeError, isLegalGateError } from "./errors";
import type { FormErrorState, FormState } from "./forms";
import { fill, type Dict } from "./i18n";
import { loginHref, requestDict, requestLocale } from "./request-info";

export function buildErrorState(
  e: { error: ApiError; status?: number; requestId?: string; retryAfter?: number },
  dict: Dict,
  locale: "fr" | "ar",
  reloginHref?: string
): FormErrorState {
  const d = describeError(
    { code: e.error.code, message: e.error.message, status: e.status, retryAfter: e.retryAfter, requestId: e.requestId },
    locale
  );
  return {
    status: "error",
    code: d.code,
    title: d.title,
    message: d.body,
    fields: e.error.fields,
    requestId: e.requestId,
    reference: d.reference ? fill(dict.errors.reference, { ref: d.reference }) : undefined,
    legalGate: d.legalGate || isLegalGateError(e.error.code, e.error.message),
    retryAfter: e.retryAfter,
    action: d.action,
    actionLabel: d.actionLabel,
    actionHref: d.action === "relogin" ? reloginHref : undefined,
    copyLabel: dict.errors.referenceCopy,
    copiedLabel: dict.errors.referenceCopied,
    serverMessage: e.error.message,
  };
}

/** Réponse API en échec → FormState localisé (langue et chemin de la requête courante). */
export async function fromApiError(e: {
  error: ApiError;
  status?: number;
  requestId?: string;
  retryAfter?: number;
}): Promise<FormState> {
  const locale = await requestLocale();
  const dict = await requestDict();
  const relogin = e.error.code === "UNAUTHENTICATED" ? await loginHref(locale) : undefined;
  return buildErrorState(e, dict, locale, relogin);
}

/**
 * Erreur détectée dans l'application (avant l'API) : message tiré du dictionnaire.
 * `pick` choisit le texte dans `dict.errors.local` ; `field` l'attache aussi sous un champ.
 */
export async function localError(
  code: "VALIDATION_ERROR" | "INTERNAL_ERROR" | "UNAUTHENTICATED",
  pick: (l: Dict["errors"]["local"], dict: Dict) => string,
  opts: { field?: string; fieldMessage?: (l: Dict["errors"]["local"]) => string; vars?: Record<string, string | number> } = {}
): Promise<FormErrorState> {
  const dict = await requestDict();
  const l = dict.errors.local;
  const message = fill(pick(l, dict), opts.vars ?? {});
  const champ = opts.fieldMessage ? fill(opts.fieldMessage(l), opts.vars ?? {}) : message;
  if (code === "UNAUTHENTICATED") {
    const locale = await requestLocale();
    return buildErrorState({ error: { code, message } }, dict, locale, await loginHref(locale));
  }
  if (code === "INTERNAL_ERROR") {
    return {
      status: "error",
      code,
      title: l.televersementRefuseTitre,
      message,
      action: "retry",
      actionLabel: dict.errors.actions.retry,
    };
  }
  return {
    status: "error",
    code,
    message,
    ...(opts.field ? { fields: { [opts.field]: champ } } : {}),
  };
}

/** Session absente côté web (cookie de copropriété manquant…) : « Se reconnecter ». */
export function sessionExpired(): Promise<FormErrorState> {
  return localError("UNAUTHENTICATED", (_l, d) => d.errors.codes.UNAUTHENTICATED.body);
}

/** Fichier trop lourd : message global + message court sous le champ. */
export function fileTooLarge(field: string, maxMo: number, image = false): Promise<FormErrorState> {
  return localError("VALIDATION_ERROR", (l) => (image ? l.imageTropLourde : l.fichierTropLourd), {
    field,
    fieldMessage: (l) => l.fichierTropLourdCourt,
    vars: { max: maxMo },
  });
}

/** Le stockage a refusé le téléversement (URL signée) : « Réessayer ». */
export function uploadRefused(status: number): Promise<FormErrorState> {
  console.warn(JSON.stringify({ niveau: "warn", message: "televersement refuse par le stockage", status }));
  return localError("INTERNAL_ERROR", (l) => l.televersementRefuse);
}
