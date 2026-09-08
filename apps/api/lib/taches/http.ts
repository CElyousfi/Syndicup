/** Mapping erreurs → réponses HTTP — M22 Tâches. */
import { fail } from "../http/respond";
import { mapAuthError } from "../http/request-context";
import { IdempotencyConflitError, IdempotencyKeyManquanteError } from "../http/idempotency";
import { CheminHorsPerimetreError, IntrouvableError, PermissionRefuseeError, TacheError } from "./taches";

export function mapErreurTaches(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError || e instanceof CheminHorsPerimetreError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof TacheError) return fail(e.code, e.message);
  if (e instanceof IdempotencyConflitError) return fail("CONFLICT", e.message);
  if (e instanceof IdempotencyKeyManquanteError) return fail("VALIDATION_ERROR", e.message);
  return null;
}
