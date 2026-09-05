/** GET /v1/rapports/proprietaires?format=csv|xlsx — annuaire nominatif des propriétaires (syndic seul, tracé). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { fail } from "../../../../lib/http/respond";
import { formatDemande, reponseExport } from "../../../../lib/http/export";
import { exporterProprietaires } from "../../../../lib/rapports/exports";
import { mapErreurRapports } from "../../../../lib/rapports/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const format = formatDemande(new URL(req.url));
    if (format === "json") return fail("VALIDATION_ERROR", "Cet export exige format=csv ou format=xlsx.");
    const { entetes, lignes } = await exporterProprietaires(ctx, format);
    return reponseExport(format, "proprietaires", entetes, lignes);
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
