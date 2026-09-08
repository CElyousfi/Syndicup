/** GET/POST /v1/taches — tâches (M22) : liste filtrée (statut, priorité, origine, assigné, retard, ouvertes, q), `meta.par_statut` / `meta.retard`, export csv / xlsx ; création (syndic). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurTaches } from "../../../lib/taches/http";
import { lirePagination, lireTri, metaPagination } from "../../../lib/http/pagination";
import { formatDemande, reponseExport } from "../../../lib/http/export";
import { tacheCreateSchema, tachesFiltresSchema, TRIS_TACHE } from "../../../lib/taches/schemas";
import { creerTache, exporterTaches, listerTaches } from "../../../lib/taches/taches";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort", "format"].includes(k)));
    const parsed = tachesFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterTaches(ctx, parsed.data, format);
      return reponseExport(format, "taches", entetes, lignes);
    }
    const pagination = lirePagination(url);
    const tri = lireTri(url, TRIS_TACHE, { champ: "date_echeance", sens: "asc" });
    const { total, rows, par_statut, retard } = await listerTaches(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: { ...metaPagination(total, pagination), par_statut, retard } });
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = tacheCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerTache(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
