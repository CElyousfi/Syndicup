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
  | "LCD_SEJOUR_CHEVAUCHEMENT";

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
