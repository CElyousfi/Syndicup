/** GET /v1/cabinets/{id}/portefeuille — une ligne par copropriété (KPI de la vue matérialisée rafraîchie toutes les 15 min), tri, filtre alertes, csv / xlsx. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { ok, failZod } from "../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../lib/cabinet/http";
import { lireTri } from "../../../../../lib/http/pagination";
import { formatDemande, reponseExport } from "../../../../../lib/http/export";
import { portefeuilleFiltresSchema, TRIS_PORTEFEUILLE } from "../../../../../lib/cabinet/schemas";
import { ENTETES_PORTEFEUILLE, lignesCsv, portefeuille } from "../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const a = await acteurFromRequest(req);
    const { id } = await params;
    const url = new URL(req.url);
    const parsed = portefeuilleFiltresSchema.safeParse(Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["sort", "format"].includes(k))));
    if (!parsed.success) return failZod(parsed.error);
    const r = await portefeuille(a, id, parsed.data, lireTri(url, TRIS_PORTEFEUILLE, { champ: "nom", sens: "asc" }));
    const format = formatDemande(url);
    if (format !== "json") return reponseExport(format, "portefeuille", ENTETES_PORTEFEUILLE, lignesCsv(r.lignes));
    return ok(r.lignes, { meta: { totaux: r.totaux, calcule_le: r.calcule_le, parametres: r.parametres } });
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
