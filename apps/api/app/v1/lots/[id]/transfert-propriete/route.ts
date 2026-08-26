/**
 * POST /v1/lots/:id/transfert-propriete — vente d'un lot (Master Spec Partie 5.4 — M4).
 * ⚠️ Vérification automatique du solde de charges non disponible (dépend du moteur financier
 * M5, pas encore livré) — voir apps/api/lib/lots/lots.ts::transfererPropriete.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { lotTransfertProprieteSchema } from "../../../../../lib/lots/schemas";
import {
  transfererPropriete,
  PermissionRefuseeError,
  LotIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/lots/lots";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = lotTransfertProprieteSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const invitation = await transfererPropriete(ctx, id, parsed.data);
    return ok(invitation);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof LotIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
