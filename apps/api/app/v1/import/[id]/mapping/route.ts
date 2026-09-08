/** PATCH /v1/import/{id}/mapping — le syndic corrige l'association colonne → champ (et les options) ; ré-analyse. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurImport } from "../../../../../lib/import/http";
import { importMappingSchema } from "../../../../../lib/import/schemas";
import { modifierMapping } from "../../../../../lib/import/import";
type P = { params: Promise<{ id: string }> };
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = importMappingSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierMapping(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const PATCH = withApiHandler(handlePATCH);
