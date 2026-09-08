/** Mapping erreurs → réponses HTTP — M24 Import. */
import { fail } from "../http/respond";
import { mapAuthError } from "../http/request-context";
import { CheminHorsPerimetreError } from "../documents/attach";
import { ImportError, IntrouvableError, PermissionRefuseeError } from "./import";

export function mapErreurImport(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError || e instanceof CheminHorsPerimetreError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof ImportError) return fail(e.code, e.message);
  return null;
}
