/**
 * GET /v1/finances/quittances/:id/pdf — la quittance en PDF (Doc A §3.4, valeur fiscale,
 * conservation 10 ans). Rendu à la demande depuis les lignes immuables — même confidentialité
 * que GET /finances/quittances/:id.
 */
import { withApiHandler } from "../../../../../../lib/http/handler";
import {
  obtenirQuittancePdf,
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { fail } from "../../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const { buffer, numero } = await obtenirQuittancePdf(ctx, id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quittance-${numero}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
