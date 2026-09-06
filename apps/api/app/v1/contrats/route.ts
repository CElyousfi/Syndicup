/** GET/POST /v1/contrats — contrats de la copropriété (M19, Doc A §7/§8). GET : filtres, pagination, tri, format=csv|xlsx ; POST : BROUILLON (syndic). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { lirePagination, lireTri, metaPagination } from "../../../lib/http/pagination";
import { formatDemande, reponseExport } from "../../../lib/http/export";
import { creerContrat, exporterContrats, listerContrats } from "../../../lib/contrats/contrats";
import { contratCreateSchema, contratsFiltresSchema, TRIS_CONTRAT } from "../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../lib/contrats/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort", "format"].includes(k)));
    const parsed = contratsFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterContrats(ctx, parsed.data, format);
      return reponseExport(format, "contrats", entetes, lignes);
    }
    const pagination = lirePagination(url);
    const tri = lireTri(url, TRIS_CONTRAT, { champ: "date_fin", sens: "asc" });
    const { total, rows, par_statut, assurance } = await listerContrats(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: { ...metaPagination(total, pagination), par_statut, assurance } });
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = contratCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerContrat(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
