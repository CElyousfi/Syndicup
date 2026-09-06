/** Mapping erreurs → HTTP des routes Contrats (M19). */
import { mapAuthError } from "../http/request-context";
import { fail } from "../http/respond";
import { PermissionRefuseeError, IntrouvableError, ContratError, CheminHorsPerimetreError } from "./contrats";
import { PermissionRefuseeError as DepPermission, IntrouvableError as DepIntrouvable, DepenseError } from "../depenses/depenses";
import { IdempotencyConflitError, IdempotencyKeyManquanteError } from "../http/idempotency";

export function mapErreurContrats(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError || e instanceof DepPermission || e instanceof CheminHorsPerimetreError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError || e instanceof DepIntrouvable) return fail("NOT_FOUND", e.message);
  if (e instanceof ContratError || e instanceof DepenseError) return fail(e.code, e.message);
  if (e instanceof IdempotencyConflitError) return fail("CONFLICT", e.message);
  if (e instanceof IdempotencyKeyManquanteError) return fail("VALIDATION_ERROR", e.message);
  return null;
}
