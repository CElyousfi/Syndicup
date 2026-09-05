/** Mapping erreurs → HTTP des routes Rapports (M18). */
import { mapAuthError } from "../http/request-context";
import { fail } from "../http/respond";
import { ConflitError, IntrouvableError, PermissionRefuseeError, RapportError } from "./erreurs";
import { PermissionRefuseeError as DepPermission, IntrouvableError as DepIntrouvable } from "../depenses/depenses";
import { PermissionRefuseeError as AgPermission, AgIntrouvableError, ContrainteMetierError as AgContrainte } from "../ag/ag";
import { IdempotencyConflitError, IdempotencyKeyManquanteError } from "../http/idempotency";

export function mapErreurRapports(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError || e instanceof DepPermission || e instanceof AgPermission) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError || e instanceof DepIntrouvable || e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof RapportError) return fail(e.code, e.message);
  if (e instanceof ConflitError || e instanceof IdempotencyConflitError) return fail("CONFLICT", e.message);
  if (e instanceof IdempotencyKeyManquanteError) return fail("VALIDATION_ERROR", e.message);
  if (e instanceof AgContrainte) return fail("UNPROCESSABLE_ENTITY", e.message);
  return null;
}
