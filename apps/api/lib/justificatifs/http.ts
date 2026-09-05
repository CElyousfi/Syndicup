/** Mapping erreurs → HTTP des routes Justificatifs (M17). */
import { mapAuthError } from "../http/request-context";
import { fail } from "../http/respond";
import { PermissionRefuseeError, IntrouvableError, JustificatifError, CheminHorsPerimetreError } from "./justificatifs";
import { PermissionRefuseeError as CbPermission, IntrouvableError as CbIntrouvable } from "./comptes-bancaires";
import { PermissionRefuseeError as FinPermission, RessourceIntrouvableError, ContrainteMetierError, ConflitIdempotenceError } from "../finances/finances";

export function mapErreurJustificatifs(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError || e instanceof CbPermission || e instanceof FinPermission || e instanceof CheminHorsPerimetreError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError || e instanceof CbIntrouvable || e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof JustificatifError) return fail(e.code, e.message);
  if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
  if (e instanceof ConflitIdempotenceError) return fail("CONFLICT", e.message);
  return null;
}
