/** GET/POST /v1/annonces — tableau d'affichage (M21) : liste filtrée par audience (RLS), `meta.non_lues`, export csv / xlsx (gestion) ; création (syndic / conseil). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurCommunication } from "../../../lib/communication/http";
import { lirePagination, lireTri, metaPagination } from "../../../lib/http/pagination";
import { formatDemande, reponseExport } from "../../../lib/http/export";
import { annonceCreateSchema, annoncesFiltresSchema, TRIS_ANNONCE } from "../../../lib/communication/schemas";
import { creerAnnonce, exporterAnnonces, listerAnnonces } from "../../../lib/communication/communication";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const brut = Object.fromEntries([...url.searchParams.entries()].filter(([k]) => !["page", "limit", "sort", "format"].includes(k)));
    const parsed = annoncesFiltresSchema.safeParse(brut);
    if (!parsed.success) return failZod(parsed.error);
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterAnnonces(ctx, parsed.data, format);
      return reponseExport(format, "annonces", entetes, lignes);
    }
    const pagination = lirePagination(url);
    const tri = lireTri(url, TRIS_ANNONCE, { champ: "publie_le", sens: "desc" });
    const { total, rows, non_lues } = await listerAnnonces(ctx, parsed.data, pagination, tri);
    return ok(rows, { meta: { ...metaPagination(total, pagination), non_lues } });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = annonceCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerAnnonce(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
