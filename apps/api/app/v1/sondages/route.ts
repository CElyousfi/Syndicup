/** GET/POST /v1/sondages — sondages consultatifs (jamais un vote d'AG, Doc A §6) : liste par audience, création (syndic / conseil). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurCommunication } from "../../../lib/communication/http";
import { lirePagination, lireTri, metaPagination } from "../../../lib/http/pagination";
import { sondageCreateSchema, sondagesFiltresSchema, TRIS_SONDAGE } from "../../../lib/communication/schemas";
import { creerSondage, listerSondages } from "../../../lib/communication/sondages";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort"].includes(k)));
    const parsed = sondagesFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const pagination = lirePagination(url);
    const tri = lireTri(url, TRIS_SONDAGE, { champ: "date_fin", sens: "asc" });
    const { total, rows } = await listerSondages(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: metaPagination(total, pagination) });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = sondageCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerSondage(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
