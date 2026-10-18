/**
 * Construction des états d'erreur des Server Actions — SERVEUR uniquement (lit la langue et le
 * chemin de la requête). Chaque échec devient un FormState déjà localisé : titre, message,
 * prochaine étape, référence. Les Server Actions n'écrivent plus jamais de texte d'erreur.
 */
import { randomUUID } from "node:crypto";
import type { ApiError } from "./api/types";
import { describeError, isLegalGateError } from "./errors";
import { ISSUES_INCONNUES, success, type FichierEnvoye, type FormErrorState, type FormState } from "./forms";
import { collectValues } from "./form-values";
import { fill, type Dict } from "./i18n";
import { loginHref, requestDict, requestLocale } from "./request-info";
import { readSession } from "./session";

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

/**
 * Réponse API en échec → FormState localisé (langue et chemin de la requête courante).
 * `fd` : la saisie soumise, renvoyée dans `values` pour que le formulaire la garde (React 19
 * réinitialise les champs non contrôlés après l'action) — jamais les fichiers ni les secrets.
 */
export async function fromApiError(
  e: {
    error: ApiError;
    status?: number;
    requestId?: string;
    retryAfter?: number;
  },
  fd?: FormData
): Promise<FormState> {
  const locale = await requestLocale();
  const dict = await requestDict();
  const relogin = e.error.code === "UNAUTHENTICATED" ? await loginHref(locale) : undefined;
  return withValues(buildErrorState(e, dict, locale, relogin), fd);
}

/**
 * Succès annoncé, dans la langue de la requête : <FormAlert> le montre en toast (et en bandeau
 * dans un formulaire en ligne), le panneau d'<ActionModal> l'affiche — jamais un succès muet.
 */
export async function succes(pick: (d: Dict) => string, data?: unknown): Promise<FormState> {
  return success(pick(await requestDict()), data);
}

/**
 * Clé d'idempotence du geste : le champ caché `idempotency_key` (UUID, tiré une fois par
 * montage du formulaire — <IdempotencyField>) ; à défaut d'une clé valide, une clé neuve.
 */
export function cleIdempotence(fd: FormData): string {
  const cle = String(fd.get("idempotency_key") ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cle) ? cle : randomUUID();
}

/**
 * Échec d'une écriture idempotente (même clé rejouée tant que l'issue est inconnue) :
 *  - issue inconnue (ISSUES_INCONNUES) : les fichiers déjà téléversés sont joints à l'état
 *    (`envoyes`) — le formulaire les renvoie au lieu de re-téléverser (nouveau chemin = autre
 *    contenu sous la même clé = 409) ;
 *  - 409 CONFLICT : présenté comme une issue incertaine, jamais comme un refus — « peut-être déjà
 *    enregistrée, actualisez ».
 */
export async function echecIdempotent(
  e: { error: ApiError; status?: number; requestId?: string; retryAfter?: number },
  fd: FormData,
  envoyes: FichierEnvoye[] = []
): Promise<FormState> {
  const etat = await fromApiError(e, fd);
  if (etat.status !== "error" || !ISSUES_INCONNUES.has(etat.code)) return etat;
  const avecFichiers = envoyes.length > 0 ? { ...etat, envoyes } : etat;
  if (etat.code !== "CONFLICT") return avecFichiers;
  const dict = await requestDict();
  const t = dict.formulaires.peutEtreEnregistre;
  return { ...avecFichiers, title: t.titre, message: t.message, action: "refresh", actionLabel: dict.errors.actions.refresh };
}

/** Dernier segment d'un chemin délivré par l'API : `<uuid>-<nom assaini [a-zA-Z0-9._-], ≤ 120>`. */
const CHEMIN_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9._-]{1,120}$/i;

/**
 * Fichiers déjà téléversés renvoyés par le formulaire (`envoye_chemin` / `envoye_nom`, champs
 * cachés issus de `envoyes`) — jamais pris tels quels : seul un chemin de la forme exacte que
 * l'API délivre pour CETTE copropriété et CE module (`<copropriete>/<module>/<uuid>-<nom>`, sans
 * `..`) est retenu ; tout le reste est ignoré (le fichier devra être choisi à nouveau).
 */
export async function fichiersDejaEnvoyes(fd: FormData, module: "documents" | "incidents", max: number): Promise<FichierEnvoye[]> {
  const { coproprieteId } = await readSession();
  if (!coproprieteId) return [];
  const prefixe = `${coproprieteId}/${module}/`;
  const chemins = fd.getAll("envoye_chemin").map(String);
  const noms = fd.getAll("envoye_nom").map(String);
  const retenus: FichierEnvoye[] = [];
  for (const [i, chemin] of chemins.entries()) {
    if (retenus.length >= max) break;
    if (!chemin.startsWith(prefixe) || chemin.includes("..")) continue;
    if (!CHEMIN_FICHIER.test(chemin.slice(prefixe.length))) continue;
    retenus.push({ chemin, nom: (noms[i] ?? "").slice(0, 200) || chemin.slice(prefixe.length + 37) });
  }
  return retenus;
}

/** Joint la saisie soumise à un état d'erreur (aucun effet sans FormData). */
export function withValues<S extends FormState>(state: S, fd?: FormData): S {
  if (!fd || state.status !== "error") return state;
  return { ...state, values: collectValues(fd) };
}

/**
 * Erreur détectée dans l'application (avant l'API) : message tiré du dictionnaire.
 * `pick` choisit le texte dans `dict.errors.local` ; `field` l'attache aussi sous un champ.
 */
export async function localError(
  code: "VALIDATION_ERROR" | "INTERNAL_ERROR" | "UNAUTHENTICATED",
  pick: (l: Dict["errors"]["local"], dict: Dict) => string,
  opts: {
    field?: string;
    fieldMessage?: (l: Dict["errors"]["local"]) => string;
    vars?: Record<string, string | number>;
    /** Saisie à conserver dans le formulaire (voir `withValues`). */
    fd?: FormData;
  } = {}
): Promise<FormErrorState> {
  const dict = await requestDict();
  const l = dict.errors.local;
  const message = fill(pick(l, dict), opts.vars ?? {});
  const champ = opts.fieldMessage ? fill(opts.fieldMessage(l), opts.vars ?? {}) : message;
  if (code === "UNAUTHENTICATED") {
    const locale = await requestLocale();
    return withValues(buildErrorState({ error: { code, message } }, dict, locale, await loginHref(locale)), opts.fd);
  }
  if (code === "INTERNAL_ERROR") {
    return withValues<FormErrorState>(
      {
        status: "error",
        code,
        title: l.televersementRefuseTitre,
        message,
        action: "retry",
        actionLabel: dict.errors.actions.retry,
      },
      opts.fd
    );
  }
  return withValues<FormErrorState>(
    {
      status: "error",
      code,
      message,
      ...(opts.field ? { fields: { [opts.field]: champ } } : {}),
    },
    opts.fd
  );
}

/** Session absente côté web (cookie de copropriété manquant…) : « Se reconnecter ». */
export function sessionExpired(fd?: FormData): Promise<FormErrorState> {
  return localError("UNAUTHENTICATED", (_l, d) => d.errors.codes.UNAUTHENTICATED.body, { fd });
}

/** Fichier trop lourd : message global + message court sous le champ. */
export function fileTooLarge(field: string, maxMo: number, image = false, fd?: FormData): Promise<FormErrorState> {
  return localError("VALIDATION_ERROR", (l) => (image ? l.imageTropLourde : l.fichierTropLourd), {
    field,
    fieldMessage: (l) => l.fichierTropLourdCourt,
    vars: { max: maxMo },
    fd,
  });
}

/** Le stockage a refusé le téléversement (URL signée) : « Réessayer ». */
export function uploadRefused(status: number, fd?: FormData): Promise<FormErrorState> {
  console.warn(JSON.stringify({ niveau: "warn", message: "televersement refuse par le stockage", status }));
  return localError("INTERNAL_ERROR", (l) => l.televersementRefuse, { fd });
}
