/**
 * GET/POST /v1/depenses — dépenses de la copropriété (M16, Doc A §3/§8). GET : filtres, pagination,
 * tri, `?format=csv|xlsx` (export journalisé dans export_log). POST : BROUILLON (syndic).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { lirePagination, lireTri, metaPagination } from "../../../lib/http/pagination";
import { formatDemande, reponseExport } from "../../../lib/http/export";
import { listerDepenses, creerDepense, exporterDepensesCsv } from "../../../lib/depenses/depenses";
import { depensesFiltresSchema, depenseCreateSchema, TRIS_DEPENSE } from "../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../lib/depenses/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort", "format"].includes(k)));
    const parsed = depensesFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterDepensesCsv(ctx, parsed.data, format);
      return reponseExport(format, `depenses-${parsed.data.exercice ?? "toutes"}`, entetes, lignes);
    }
    const pagination = lirePagination(url);
    const tri = lireTri(url, TRIS_DEPENSE, { champ: "date_depense", sens: "desc" });
    const { total, rows, totaux } = await listerDepenses(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: { ...metaPagination(total, pagination), totaux } });
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = depenseCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerDepense(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
