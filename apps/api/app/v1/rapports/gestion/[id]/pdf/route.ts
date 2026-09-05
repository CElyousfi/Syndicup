/** GET /v1/rapports/gestion/{id}/pdf?langue=fr|ar&variante=publique|complete — PDF rendu depuis l'instantané. */
import { z } from "zod";
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { failZod } from "../../../../../../lib/http/respond";
import { pdfRapportGestion } from "../../../../../../lib/rapports/gestion";
import { mapErreurRapports } from "../../../../../../lib/rapports/http";

const querySchema = z.object({ langue: z.enum(["fr", "ar"]).default("fr"), variante: z.enum(["publique", "complete"]).default("publique") });

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    const { buffer, nomFichier } = await pdfRapportGestion(ctx, id, parsed.data.langue, parsed.data.variante);
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
