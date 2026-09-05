/** POST /v1/depenses/upload-url — URL signée d'upload (facture, preuve de paiement, devis) — syndic. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { preparerUploadDepense } from "../../../../lib/depenses/depenses";
import { depenseUploadUrlSchema } from "../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../lib/depenses/http";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = depenseUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadDepense(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
