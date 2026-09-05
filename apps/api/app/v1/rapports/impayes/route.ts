/** GET /v1/rapports/impayes — lignes échues avec ancienneté ; filtres, tri, pagination, format=csv|xlsx. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { lirePagination, lireTri, metaPagination } from "../../../../lib/http/pagination";
import { formatDemande, reponseExport } from "../../../../lib/http/export";
import { listerImpayes, exporterImpayes } from "../../../../lib/rapports/exports";
import { impayesFiltresSchema, TRIS_IMPAYES } from "../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../lib/rapports/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort", "format"].includes(k)));
    const parsed = impayesFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterImpayes(ctx, parsed.data, format);
      return reponseExport(format, "impayes", entetes, lignes);
    }
    const pagination = lirePagination(url);
    const tri = lireTri(url, TRIS_IMPAYES, { champ: "retard_jours", sens: "desc" });
    const { total, rows, synthese } = await listerImpayes(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: { ...metaPagination(total, pagination), synthese } });
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
