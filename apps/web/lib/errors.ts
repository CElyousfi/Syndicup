/**
 * Vocabulaire des moments difficiles — traduit un code d'erreur de l'API (enveloppe
 * `{ error: { code, message } }`, codes de apps/api/lib/http/respond.ts) en un message que
 * l'utilisateur comprend, DANS SA LANGUE, avec la prochaine étape à proposer.
 *
 * Module PUR (aucun accès aux cookies / en-têtes) : utilisable côté serveur comme dans les tests.
 * La résolution de la langue de la requête vit dans lib/request-context.ts.
 *
 * Règles :
 *  - code connu → titre + corps du dictionnaire `errors.codes` ;
 *  - UNPROCESSABLE_ENTITY / CONFLICT génériques (sans code métier) → en FR, le message du serveur
 *    (déjà rédigé pour l'utilisateur) débarrassé de ses références de spécification ; en AR, le
 *    texte générique arabe (le serveur ne parle que français) ;
 *  - RATE_LIMITED + Retry-After → « Réessayez dans X min » ;
 *  - status 0 / NETWORK → API injoignable.
 */
import { fill, getDict, type Dict, type Locale } from "./i18n";

type ErrorsDict = Dict["errors"];

/** Prochaine étape proposée après un échec. */
export type ErrorAction = "retry" | "relogin" | "refresh" | "contact" | "none";

export interface ErrorInput {
  code: string;
  message?: string;
  status?: number;
  retryAfter?: number;
  requestId?: string;
}

export interface DescribedError {
  /** Code normalisé (NETWORK pour un status 0). */
  code: string;
  title: string;
  body: string;
  action: ErrorAction;
  /** Libellé localisé de l'action (absent pour « none »). */
  actionLabel?: string;
  /** 8 premiers caractères du request_id — à communiquer au support. */
  reference?: string;
  /** Erreur « gatée légalement » (paramètre légal non configuré) : bannière neutre, pas rouge. */
  legalGate: boolean;
}

type CodeKey = keyof ErrorsDict["codes"];

/** Codes dont le message serveur, en français, est plus précis que notre texte générique. */
const GENERIQUES_A_MESSAGE_SERVEUR = new Set(["UNPROCESSABLE_ENTITY", "CONFLICT"]);

const RETRY = new Set(["NETWORK", "INTERNAL_ERROR", "SERVICE_UNAVAILABLE", "RATE_LIMITED", "UNEXPECTED"]);
const REFRESH = new Set(["NOT_FOUND", "CONFLICT", "SONDAGE_CHOIX_INVALIDE"]);
const CONTACT = new Set(["FORBIDDEN", "NOT_IMPLEMENTED", "UNPROCESSABLE_ENTITY", "DEMO_INTERDIT"]);

/** Référence courte d'une requête (8 premiers caractères alphanumériques). */
export function shortRef(requestId?: string | null): string | undefined {
  if (!requestId) return undefined;
  const ref = requestId.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8);
  return ref.length > 0 ? ref : undefined;
}

/**
 * Retire d'un message serveur les références internes de spécification — « (Partie 2.4) »,
 * « (Doc A §8, brief §10) », « — LEGAL_QUESTIONS_BRIEF §9 », « (PUT /lcd/reglement) »… — qui
 * ne veulent rien dire pour un résident. Filet de sécurité : l'API les retire déjà (respond.ts,
 * #15) ; même prudence qu'elle — « Partie 2 » ou « § 3 » SEULS sont du vocabulaire métier
 * (« Partie 2 non attribuée ») et restent ; seules les formes préfixées (Doc A, Master Spec,
 * brief, LEGAL_QUESTIONS_BRIEF, CLAUDE.md) et une parenthèse « (Partie n) » sont retirées.
 */
export function stripSpecRefs(message: string): string {
  return (
    message
      // Parenthèses de référence : formes préfixées, « (Partie n[, n]) » seule, champ ou chemin d'API.
      .replace(/\s*\((?:[^()]*?(?:Doc\s*A\b|brief\s*§|Master\s*Spec|LEGAL_QUESTIONS|CLAUDE\.md|config_json|(?:GET|POST|PUT|PATCH|DELETE)\s+\/)[^()]*)\)/gi, "")
      .replace(/\s*\(\s*Partie\s+\d+(?:\.\d+)*(?:\s*[,/]\s*(?:Partie\s+)?\d+(?:\.\d+)*)*\s*\)/g, "")
      // Références en incise après un tiret.
      // (un point suivi d'un chiffre fait partie du numéro : « Partie 4.2 », pas une fin de phrase)
      .replace(/\s*[—–-]\s*(?:LEGAL_QUESTIONS_BRIEF|Doc\s*A\b|Master\s*Spec)(?:[^.;:]|\.(?=\d))*?(?=\s*[.;:](?!\d)|$)/gi, "")
      // Formes préfixées nues restantes.
      .replace(/\s*Doc\s*A\s*§\s*\d+(?:\.\d+)*/g, "")
      .replace(/\s*Master\s+Spec(?:\s+Partie\s+\d+(?:\.\d+)*)?/g, "")
      .replace(/\s*(?:docs\/)?LEGAL_QUESTIONS_BRIEF(?:\.md)?(?:\s*§\s*\d+(?:\.\d+)*)?/g, "")
      // Typographie française : espace avant ; : ! ? conservée, jamais avant . ou ,
      .replace(/\s+([.,])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** « 45 s » / « 3 min » — arrondi au supérieur, jamais « 0 ». */
export function formatRetryAfter(seconds: number, locale: Locale): string {
  const e = getDict(locale).errors;
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return fill(e.seconds, { n: s });
  return fill(e.minutes, { n: Math.ceil(s / 60) });
}

/** Durée écoulée lisible (« 30 s », « 2 min ») — indicateur de données périmées. */
export const formatElapsed = formatRetryAfter;

function isStatutInvalide(code: string): boolean {
  return code.endsWith("_STATUT_INVALIDE");
}

/** Paramètre légal/technique non configuré (brief §6.3) : bannière informative, jamais rouge. */
export function isLegalGateError(code: string, message = ""): boolean {
  if (/_NON_CONFIGURES?$/.test(code)) return true;
  // Repli texte : 422 générique dont le message pointe une valeur légale non configurée.
  return code === "UNPROCESSABLE_ENTITY" && /non configur|confirmation juridique|LEGAL_QUESTIONS/i.test(message);
}

/** Normalise le code : status 0 = réseau, quel que soit le code transporté. */
export function normalizeCode(input: Pick<ErrorInput, "code" | "status">): string {
  if (input.status === 0 || input.code === "NETWORK") return "NETWORK";
  return input.code || "UNEXPECTED";
}

export function actionFor(code: string): ErrorAction {
  if (code === "UNAUTHENTICATED") return "relogin";
  if (isStatutInvalide(code) || REFRESH.has(code)) return "refresh";
  if (RETRY.has(code)) return "retry";
  if (CONTACT.has(code) || /_NON_CONFIGURES?$/.test(code)) return "contact";
  return "none";
}

export function describeError(input: ErrorInput, locale: Locale): DescribedError {
  const e = getDict(locale).errors;
  const code = normalizeCode(input);
  const known = (e.codes as Record<string, { title: string; body: string } | undefined>)[code];
  const serveur = (input.message ?? "").trim();

  let title: string;
  let body: string;
  if (known) {
    title = known.title;
    body = known.body;
    if (GENERIQUES_A_MESSAGE_SERVEUR.has(code) && locale === "fr" && serveur) {
      const nettoye = stripSpecRefs(serveur);
      if (nettoye) body = nettoye;
    }
  } else if (isStatutInvalide(code)) {
    // Nouveau code « *_STATUT_INVALIDE » pas encore au dictionnaire : même sens, même action.
    title = e.codes.CONFLICT.title;
    body = e.codes.CONFLICT.body;
  } else if ((input.status ?? 0) >= 500) {
    title = e.codes.INTERNAL_ERROR.title;
    body = e.codes.INTERNAL_ERROR.body;
  } else {
    // Code métier inconnu (API plus récente que le web) : le message serveur en FR, générique en AR.
    const generique = e.codes.UNPROCESSABLE_ENTITY;
    title = generique.title;
    body = locale === "fr" && serveur ? stripSpecRefs(serveur) || generique.body : generique.body;
  }

  if (code === "RATE_LIMITED" && input.retryAfter && input.retryAfter > 0) {
    body = `${body} ${fill(e.retryIn, { temps: formatRetryAfter(input.retryAfter, locale) })}`;
  }

  const action = actionFor(known ? code : isStatutInvalide(code) ? "CONFLICT" : code);
  return {
    code,
    title,
    body,
    action,
    actionLabel: action === "none" ? undefined : e.actions[action === "contact" ? "contact" : action],
    reference: shortRef(input.requestId),
    legalGate: isLegalGateError(code, serveur),
  };
}

/** Le code est-il l'un de ceux que le dictionnaire connaît ? (tests, garde-fous) */
export function isKnownCode(code: string, locale: Locale = "fr"): code is CodeKey {
  return code in getDict(locale).errors.codes;
}
