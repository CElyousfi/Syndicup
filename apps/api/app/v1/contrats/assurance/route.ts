/** GET /v1/contrats/assurance — invariant Doc A §8 : assurance immeuble / RC active, polices en cours. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { etatAssurance } from "../../../../lib/contrats/contrats";
import { mapErreurContrats } from "../../../../lib/contrats/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await etatAssurance(ctx));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
