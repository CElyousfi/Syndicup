/** GET/POST /v1/emplacements — emplacements non titrés (M23) : liste filtrée (type, niveau, statut, q), `meta.par_statut`, export csv / xlsx ; création (syndic). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurParkings } from "../../../lib/parkings/http";
import { lirePagination, lireTri, metaPagination } from "../../../lib/http/pagination";
import { formatDemande, reponseExport } from "../../../lib/http/export";
import { emplacementCreateSchema, emplacementsFiltresSchema, TRIS_EMPLACEMENT } from "../../../lib/parkings/schemas";
import { creerEmplacement, exporterEmplacements, listerEmplacements } from "../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort", "format"].includes(k)));
    const parsed = emplacementsFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterEmplacements(ctx, parsed.data, format);
      return reponseExport(format, "emplacements", entetes, lignes);
    }
    const pagination = lirePagination(url, { limit: 100, max: 500 });
    const tri = lireTri(url, TRIS_EMPLACEMENT, { champ: "niveau", sens: "asc" });
    const { total, rows, par_statut } = await listerEmplacements(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: { ...metaPagination(total, pagination), par_statut } });
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = emplacementCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerEmplacement(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
