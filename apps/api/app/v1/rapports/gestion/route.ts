/** GET/POST /v1/rapports/gestion — rapports de gestion annuels (M18, Doc A §8). POST : génération (Idempotency-Key). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { lirePagination, lireTri, metaPagination } from "../../../../lib/http/pagination";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { genererRapportGestion, listerRapportsGestion } from "../../../../lib/rapports/gestion";
import { rapportGestionCreateSchema, rapportsGestionFiltresSchema, TRIS_RAPPORT } from "../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../lib/rapports/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort"].includes(k)));
    const parsed = rapportsGestionFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const pagination = lirePagination(url);
    const tri = lireTri(url, TRIS_RAPPORT, { champ: "exercice", sens: "desc" });
    const { total, rows } = await listerRapportsGestion(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: metaPagination(total, pagination) });
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = rapportGestionCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    const rapport = await genererRapportGestion(ctx, parsed.data, readIdempotencyKey(req));
    return ok(rapport, { status: rapport.regenere ? 200 : 201 });
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
