/** Mapping erreurs → réponses HTTP des routes Dépenses (M16) — une seule table pour tout le module. */
import { mapAuthError } from "../http/request-context";
import { fail } from "../http/respond";
import { PermissionRefuseeError, IntrouvableError, DepenseError, CheminHorsPerimetreError } from "./depenses";
import { PermissionRefuseeError as PostePermission, IntrouvableError as PosteIntrouvable, BudgetPosteError } from "./budget-postes";
import { PermissionRefuseeError as PrestaPermission, IntrouvableError as PrestaIntrouvable } from "../prestataires/prestataires";
import { PermissionRefuseeError as IncPermission, IncidentIntrouvableError, IncidentError } from "../incidents/incidents";
import { PermissionRefuseeError as FinPermission, RessourceIntrouvableError, ContrainteMetierError } from "../finances/finances";

export function mapErreurDepenses(e: unknown): Response | null {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError || e instanceof PostePermission || e instanceof PrestaPermission || e instanceof IncPermission || e instanceof FinPermission) {
    return fail("FORBIDDEN", e.message);
  }
  if (e instanceof IntrouvableError || e instanceof PosteIntrouvable || e instanceof PrestaIntrouvable || e instanceof IncidentIntrouvableError || e instanceof RessourceIntrouvableError) {
    return fail("NOT_FOUND", e.message);
  }
  if (e instanceof DepenseError || e instanceof BudgetPosteError || e instanceof IncidentError) return fail(e.code, e.message);
  if (e instanceof CheminHorsPerimetreError) return fail("FORBIDDEN", e.message);
  if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
  return null;
}
