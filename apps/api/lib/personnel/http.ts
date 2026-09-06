/** Mapping erreurs → HTTP des routes Personnel RH (M20). */
import { mapAuthError } from "../http/request-context";
import { fail } from "../http/respond";
import { PermissionRefuseeError, IntrouvableError, RhError } from "./rh";
import { PermissionRefuseeError as P10, IntrouvableError as I10, ContrainteMetierError } from "./personnel";
import { PermissionRefuseeError as DepPermission, IntrouvableError as DepIntrouvable, DepenseError, CheminHorsPerimetreError } from "../depenses/depenses";
import { IdempotencyConflitError, IdempotencyKeyManquanteError } from "../http/idempotency";

export function mapErreurRh(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError || e instanceof P10 || e instanceof DepPermission || e instanceof CheminHorsPerimetreError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError || e instanceof I10 || e instanceof DepIntrouvable) return fail("NOT_FOUND", e.message);
  if (e instanceof RhError || e instanceof DepenseError) return fail(e.code, e.message);
  if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
  if (e instanceof IdempotencyConflitError) return fail("CONFLICT", e.message);
  if (e instanceof IdempotencyKeyManquanteError) return fail("VALIDATION_ERROR", e.message);
  return null;
}
