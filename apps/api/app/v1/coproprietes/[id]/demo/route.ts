/** POST /v1/coproprietes/{id}/demo — SUPER_ADMIN : crée une résidence de démonstration jetable (est_demo, purge après 30 jours) et renvoie le code d'invitation SYNDIC. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurImport } from "../../../../../lib/import/http";
import { demoCreateSchema } from "../../../../../lib/import/schemas";
import { creerDemo, PermissionRefuseeError } from "../../../../../lib/import/demo";
import { fail } from "../../../../../lib/http/respond";
type P = { params: Promise<{ id: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    await params;
    const parsed = demoCreateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerDemo(ctx, parsed.data), { status: 201 });
  } catch (e) { if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message); const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
