/** GET /v1/coproprietes/{id}/onboarding — checklist de démarrage calculée (lots, tantièmes, invitations, % acceptés, budget, premier appel, RIB, assurance, gardien). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurImport } from "../../../../../lib/import/http";
import { checklistOnboarding, PermissionRefuseeError } from "../../../../../lib/import/onboarding";
import { fail } from "../../../../../lib/http/respond";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    if (id !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") return fail("FORBIDDEN", "Copropriété hors du contexte courant.");
    return ok(await checklistOnboarding(id === ctx.coproprieteId ? ctx : { ...ctx, coproprieteId: id }));
  } catch (e) { if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message); const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
