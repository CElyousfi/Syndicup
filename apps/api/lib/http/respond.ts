/**
 * Enveloppes de réponse standard — Master Spec Partie 3.1 :
 *   succès : { data, meta: { request_id } }
 *   erreur : { error: { code, message, fields? } }
 * Codes normalisés : VALIDATION_ERROR 400, UNAUTHENTICATED 401, FORBIDDEN 403, NOT_FOUND 404,
 * CONFLICT 409, RATE_LIMITED 429, INTERNAL_ERROR 500.
 */
import { randomUUID } from "node:crypto";
import type { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

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
};

export function ok(data: unknown, init?: { status?: number; meta?: Record<string, unknown> }) {
  return Response.json(
    { data, meta: { request_id: randomUUID(), ...init?.meta } },
    { status: init?.status ?? 200 }
  );
}

export function fail(code: ErrorCode, message: string, fields?: Record<string, string>) {
  return Response.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
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
