/** GET /v1/finances/lots/{id}/releve/pdf?exercice=&langue=fr|ar — relevé de charges en PDF. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { failZod } from "../../../../../../../lib/http/respond";
import { pdfReleveLot } from "../../../../../../../lib/rapports/releve";
import { releveQuerySchema } from "../../../../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../../../../lib/rapports/http";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = releveQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    const { buffer, nomFichier } = await pdfReleveLot(ctx, id, parsed.data.exercice ?? String(new Date().getUTCFullYear()), parsed.data.langue);
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nomFichier}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
