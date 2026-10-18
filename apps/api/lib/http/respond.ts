/**
 * Enveloppes de réponse standard — Master Spec Partie 3.1 :
 *   succès : { data, meta: { request_id } }
 *   erreur : { error: { code, message, fields? } }
 * Codes normalisés : VALIDATION_ERROR 400, UNAUTHENTICATED 401, FORBIDDEN 403, NOT_FOUND 404,
 * CONFLICT 409, RATE_LIMITED 429, INTERNAL_ERROR 500.
 */
import { randomUUID } from "node:crypto";
import type { ZodError } from "zod";
import { getRequestContext } from "./request-context-storage";
// Effet de bord voulu : messages Zod par défaut en français. respond.ts est importé par chaque
// route : la map est installée une fois, au chargement du premier handler.
import "./zod-fr";

/** request_id du contexte de requête (posé par withApiHandler) ; fallback UUID hors requête. */
function requestId(): string {
  return getRequestContext()?.requestId ?? randomUUID();
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  /** Fonctionnalité non configurée sur ce déploiement (ex. CMI sans compte marchand). */
  | "NOT_IMPLEMENTED"
  | "SERVICE_UNAVAILABLE"
  // M15 — location courte durée : codes métier explicites (Doc A §10.2), 422 sauf chevauchement.
  | "LCD_REGIME_NON_DEFINI"
  | "LCD_INTERDITE"
  | "LCD_PARAMETRE_NON_CONFIGURE"
  | "LCD_GESTIONNAIRE_REQUIS"
  | "LCD_DECLARATION_NON_VALIDEE"
  | "LCD_QUOTA_NUITS_DEPASSE"
  | "LCD_DELAI_DECLARATION"
  | "LCD_VOYAGEURS_MAX"
  | "LCD_SEJOUR_CHEVAUCHEMENT"
  // M16 — dépenses : règles métier explicites (Doc A §3.6, §8.3), 422 sauf conflits (409).
  | "DEPENSE_STATUT_INVALIDE"
  | "DEPENSE_APPROBATION_CONSEIL_REQUISE"
  | "DEPENSE_RESERVE_RESOLUTION_REQUISE"
  | "FONDS_RESERVE_INSUFFISANT"
  | "BUDGET_TOTAL_DERIVE_DES_POSTES"
  | "BUDGET_POSTE_UTILISE"
  | "INCIDENT_NON_RESOLU"
  | "INCIDENT_DEJA_EVALUE"
  // M17 — justificatifs de paiement.
  | "JUSTIFICATIF_STATUT_INVALIDE"
  | "JUSTIFICATIF_PREUVE_REQUISE"
  | "JUSTIFICATIF_PARAMETRE_NON_CONFIGURE"
  // M18 — rapports de gestion.
  | "RAPPORT_STATUT_INVALIDE"
  | "RAPPORT_PARAMETRE_NON_CONFIGURE"
  // M19 — contrats.
  | "CONTRAT_STATUT_INVALIDE"
  | "CONTRAT_RESOLUTION_AG_REQUISE"
  | "CONTRAT_ECHEANCE_STATUT_INVALIDE"
  // M20 — personnel RH.
  | "PAIE_PARAMETRES_NON_CONFIGURES"
  | "PAIE_STATUT_INVALIDE"
  | "CONGE_STATUT_INVALIDE"
  | "CONGE_SOLDE_INSUFFISANT"
  | "PERSONNEL_STATUT_INVALIDE"
  // M21 — communication.
  | "ANNONCE_STATUT_INVALIDE"
  | "COMMENTAIRES_DESACTIVES"
  | "SONDAGE_STATUT_INVALIDE"
  | "SONDAGE_DEJA_REPONDU"
  | "SONDAGE_CHOIX_INVALIDE"
  // M22 — tâches.
  | "TACHE_STATUT_INVALIDE"
  | "TACHE_ASSIGNEE_INVALIDE"
  // M23 — parkings.
  | "EMPLACEMENT_STATUT_INVALIDE"
  | "EMPLACEMENT_CODE_EXISTANT"
  | "EMPLACEMENT_NON_VISITEUR"
  | "ATTRIBUTION_CHEVAUCHEMENT"
  | "IMMATRICULATION_EXISTANTE"
  | "IMMATRICULATION_INCONNUE"
  | "BADGE_STATUT_INVALIDE"
  | "BADGE_IDENTIFIANT_EXISTANT"
  // M24 — import / onboarding.
  | "IMPORT_FICHIER_ILLISIBLE"
  | "IMPORT_STATUT_INVALIDE"
  | "DEMO_INTERDIT"
  // M25 — cabinet.
  | "CABINET_STATUT_INVALIDE"
  | "MANDAT_EXISTANT"
  | "MANDAT_STATUT_INVALIDE"
  | "CONFLIT_SYNDIC";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  // 422 : payload syntaxiquement valide mais violant une règle métier (ex. somme des quote_part
  // ≠ 100%, budget AG absent) — distinct de VALIDATION_ERROR (400, payload mal formé).
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
  LCD_REGIME_NON_DEFINI: 422,
  LCD_INTERDITE: 422,
  LCD_PARAMETRE_NON_CONFIGURE: 422,
  LCD_GESTIONNAIRE_REQUIS: 422,
  LCD_DECLARATION_NON_VALIDEE: 422,
  LCD_QUOTA_NUITS_DEPASSE: 422,
  LCD_DELAI_DECLARATION: 422,
  LCD_VOYAGEURS_MAX: 422,
  LCD_SEJOUR_CHEVAUCHEMENT: 409,
  DEPENSE_STATUT_INVALIDE: 422,
  DEPENSE_APPROBATION_CONSEIL_REQUISE: 422,
  DEPENSE_RESERVE_RESOLUTION_REQUISE: 422,
  FONDS_RESERVE_INSUFFISANT: 422,
  BUDGET_TOTAL_DERIVE_DES_POSTES: 422,
  BUDGET_POSTE_UTILISE: 409,
  INCIDENT_NON_RESOLU: 422,
  INCIDENT_DEJA_EVALUE: 409,
  JUSTIFICATIF_STATUT_INVALIDE: 422,
  JUSTIFICATIF_PREUVE_REQUISE: 422,
  JUSTIFICATIF_PARAMETRE_NON_CONFIGURE: 422,
  RAPPORT_STATUT_INVALIDE: 422,
  RAPPORT_PARAMETRE_NON_CONFIGURE: 422,
  CONTRAT_STATUT_INVALIDE: 422,
  CONTRAT_RESOLUTION_AG_REQUISE: 422,
  CONTRAT_ECHEANCE_STATUT_INVALIDE: 422,
  PAIE_PARAMETRES_NON_CONFIGURES: 422,
  PAIE_STATUT_INVALIDE: 422,
  CONGE_STATUT_INVALIDE: 422,
  CONGE_SOLDE_INSUFFISANT: 422,
  PERSONNEL_STATUT_INVALIDE: 422,
  ANNONCE_STATUT_INVALIDE: 422,
  COMMENTAIRES_DESACTIVES: 422,
  SONDAGE_STATUT_INVALIDE: 422,
  SONDAGE_DEJA_REPONDU: 409,
  SONDAGE_CHOIX_INVALIDE: 422,
  TACHE_STATUT_INVALIDE: 422,
  TACHE_ASSIGNEE_INVALIDE: 422,
  EMPLACEMENT_STATUT_INVALIDE: 422,
  EMPLACEMENT_CODE_EXISTANT: 409,
  EMPLACEMENT_NON_VISITEUR: 422,
  ATTRIBUTION_CHEVAUCHEMENT: 409,
  IMMATRICULATION_EXISTANTE: 409,
  IMMATRICULATION_INCONNUE: 422,
  BADGE_STATUT_INVALIDE: 422,
  BADGE_IDENTIFIANT_EXISTANT: 409,
  IMPORT_FICHIER_ILLISIBLE: 422,
  IMPORT_STATUT_INVALIDE: 422,
  DEMO_INTERDIT: 422,
  CABINET_STATUT_INVALIDE: 422,
  MANDAT_EXISTANT: 409,
  MANDAT_STATUT_INVALIDE: 422,
  CONFLIT_SYNDIC: 409,
};

export function ok(data: unknown, init?: { status?: number; meta?: Record<string, unknown> }) {
  // meta.rejouee : posé quand withIdempotency a renvoyé la réponse stockée d'un rejeu
  // Idempotency-Key (aucune nouvelle écriture) — documenté dans openapi (Meta.rejouee).
  const rejouee = getRequestContext()?.idempotenceRejouee ? { rejouee: true } : {};
  return Response.json(
    { data, meta: { request_id: requestId(), ...rejouee, ...init?.meta } },
    { status: init?.status ?? 200 }
  );
}

// ── Nettoyage des références de spec dans les messages utilisateur ──────────────────────────
// Les services citent leurs sources (« (Partie 5.5) », « (Doc A §6) », « — Master Spec Partie
// 2.4 », « LEGAL_QUESTIONS_BRIEF §9 »). Utile dans le code et les logs, illisible pour un
// copropriétaire : retiré ici, une seule fois, du texte renvoyé au client.
//
// Prudence : « Partie » et « § » seuls sont des mots du métier (« Partie 2 non attribuée »,
// « § 4.2 du règlement », « art. 16 §2 de la loi 18-00 ») — jamais retirés tels quels. Seules
// les formes clairement préfixées le sont (Doc A, Master Spec, LEGAL_QUESTIONS_BRIEF / brief §,
// CLAUDE.md), plus une parenthèse qui ne contient QUE « Partie <n> » (éventuellement plusieurs,
// séparés par virgules / barres obliques).
const NUM = String.raw`\d+(?:\.\d+)*`;
const REF_SOURCE = [
  String.raw`Master\s+Spec(?:\s+Partie\s+${NUM})?`,
  String.raw`Doc\s+A(?:\s*§\s*${NUM})?`,
  String.raw`(?:docs\/)?LEGAL_QUESTIONS_BRIEF(?:\.md)?(?:\s*§\s*${NUM})?`,
  String.raw`brief\s*§\s*${NUM}`,
  String.raw`CLAUDE\.md(?:\s*§\s*${NUM})?`,
].join("|");
// Suites accolées à une source préfixée : « / 4.4 », « /§2.2 », « , §8.3 », « étape 2 »,
// « point 4 », « — M6 ».
const REF_SUITE = String.raw`(?:\s*\/\s*(?:§\s*)?${NUM}|\s*,\s*§\s*${NUM}|\s+(?:étape|point)\s+\d+|\s*—\s*M\d+\b)*`;
const REF = String.raw`(?:voir\s+)?(?:${REF_SOURCE})${REF_SUITE}`;
const RE_INDICE_PREFIXE = /Doc\s+A\b|Master\s+Spec|LEGAL_QUESTIONS_BRIEF|brief\s*§|CLAUDE\.md/;
const RE_PARTIE_SEULE = new RegExp(String.raw`^\s*Partie\s+${NUM}(?:\s*[,/]\s*(?:Partie\s+)?${NUM})*\s*$`);
const RE_INDICE = new RegExp(String.raw`${RE_INDICE_PREFIXE.source}|\(\s*Partie\s+\d`);
const RE_REF = new RegExp(REF, "g");
const RE_PARENTHESE = /\s*\(([^()]*)\)/g;
const RE_REF_TIRET = new RegExp(String.raw`\s*(?:—|–|\s-)\s*${REF}(?:\s*(?:\/|,)\s*${REF})*`, "g");
const RE_REF_PREFIXE = new RegExp(String.raw`^${REF}\s*:\s*`);
const BORDS = /^[\s,;:/—–-]+|[\s,;:/—–-]+$/g;

/** Retire les références internes (spec, Doc A, brief) d'un message destiné à l'utilisateur. */
export function nettoyerMessage(message: string): string {
  if (!RE_INDICE.test(message)) return message;
  let s = message.replace(RE_PARENTHESE, (entier: string, interieur: string) => {
    if (RE_PARTIE_SEULE.test(interieur)) return "";
    if (!RE_INDICE_PREFIXE.test(interieur)) return entier;
    const reste = interieur
      .replace(RE_REF, "")
      .replace(/\s*([,;/])\s*(?:[,;/—–-]\s*)+/g, "$1 ")
      .replace(BORDS, "")
      .trim();
    // Rien d'utile (ou seulement une citation du document) : la parenthèse disparaît.
    if (!reste || /^[«"“].*[»"”]$/.test(reste)) return "";
    return entier.replace(`(${interieur})`, `(${reste})`);
  });
  s = s.replace(RE_REF_TIRET, "").replace(RE_REF_PREFIXE, "");
  s = s
    .replace(/\s{2,}/g, " ")
    // Espace orphelin avant « . » / « , » uniquement — l'espace typographique français avant
    // « : ; ! ? » est conservé.
    .replace(/\s+([.,])/g, "$1")
    .replace(/([.,])\1+/g, "$1")
    .replace(/\s*:\s*\./g, ".")
    .trim();
  return s.length > 0 ? s : message;
}

export function fail(code: ErrorCode, message: string, fields?: Record<string, string>) {
  const champs = fields
    ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, nettoyerMessage(v)]))
    : undefined;
  return Response.json(
    // meta.request_id aussi sur les erreurs : sans lui un client ne peut corréler aucun échec
    // avec les logs/Sentry côté serveur (CLAUDE.md §5).
    {
      error: { code, message: nettoyerMessage(message), ...(champs ? { fields: champs } : {}) },
      meta: { request_id: requestId() },
    },
    { status: STATUS[code] }
  );
}

/** Ajoute le header Retry-After (secondes, ≥ 1) à une réponse d'erreur (429, 503). */
export function avecRetryAfter(res: Response, secondes: number): Response {
  const headers = new Headers(res.headers);
  headers.set("Retry-After", String(Math.max(1, Math.ceil(secondes))));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function failZod(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    fields[issue.path.join(".") || "_"] = issue.message;
  }
  return fail("VALIDATION_ERROR", "Payload invalide.", fields);
}
