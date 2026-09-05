/** GET/POST /v1/finances/justificatifs — déclarations de paiement (M17). POST probant : Idempotency-Key. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { lirePagination, metaPagination } from "../../../../lib/http/pagination";
import { listerJustificatifs, declarerJustificatif } from "../../../../lib/justificatifs/justificatifs";
import { justificatifsFiltresSchema, justificatifCreateSchema } from "../../../../lib/justificatifs/schemas";
import { mapErreurJustificatifs } from "../../../../lib/justificatifs/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const parsed = justificatifsFiltresSchema.safeParse(Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit"].includes(k))));
    if (!parsed.success) return failZod(parsed.error);
    const pagination = lirePagination(url, { limit: 50 });
    const { total, rows, par_statut } = await listerJustificatifs(ctx, parsed.data, pagination);
    return ok(rows, { meta: { ...metaPagination(total, pagination), par_statut } });
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = justificatifCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await declarerJustificatif(ctx, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
