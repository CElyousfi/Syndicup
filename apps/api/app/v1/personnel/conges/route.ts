/** GET/POST /v1/personnel/conges — toutes les demandes (syndic, conseil) ou les miennes (employé) ; POST = ma demande (Idempotency-Key). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../lib/personnel/http";
import { demanderConge, exporterConges, listerConges } from "../../../../lib/personnel/rh";
import { formatDemande, reponseExport } from "../../../../lib/http/export";
import { congeCreateSchema, congesFiltresSchema } from "../../../../lib/personnel/schemas";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const parsed = congesFiltresSchema.safeParse(Object.fromEntries([...url.searchParams.entries()].filter(([k]) => k !== "format")));
    if (!parsed.success) return failZod(parsed.error);
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterConges(ctx, parsed.data, format);
      return reponseExport(format, "conges", entetes, lignes);
    }
    return ok(await listerConges(ctx, null, parsed.data));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = congeCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await demanderConge(ctx, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
