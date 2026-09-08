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
  return Response.json(
    { data, meta: { request_id: requestId(), ...init?.meta } },
    { status: init?.status ?? 200 }
  );
}

export function fail(code: ErrorCode, message: string, fields?: Record<string, string>) {
  return Response.json(
    // meta.request_id aussi sur les erreurs : sans lui un client ne peut corréler aucun échec
    // avec les logs/Sentry côté serveur (CLAUDE.md §5).
    { error: { code, message, ...(fields ? { fields } : {}) }, meta: { request_id: requestId() } },
    { status: STATUS[code] }
  );
}

export function failZod(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    fields[issue.path.join(".") || "_"] = issue.message;
  }
  return fail("VALIDATION_ERROR", "Payload invalide.", fields);
}
