/** GET /v1/personnel/{id}/fiches-paie/{fid}/pdf?langue=fr|ar — PDF (aide au calcul) pour le syndic et l'employé. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../../../lib/personnel/http";
import { pdfFichePaie } from "../../../../../../../lib/personnel/rh";
async function handleGET(req: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  try {
    const ctx = await tenantFromRequest(req); const { id, fid } = await params;
    const langue = new URL(req.url).searchParams.get("langue") === "ar" ? "ar" : "fr";
    const { buffer, nomFichier } = await pdfFichePaie(ctx, id, fid, langue);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nomFichier}"`, "Cache-Control": "private, no-store" } });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void ok; void failZod; void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
