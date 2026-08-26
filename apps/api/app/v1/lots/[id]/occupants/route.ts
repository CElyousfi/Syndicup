/**
 * POST /v1/lots/:id/occupants — ajoute un occupant (locataire ou propriétaire occupant — Doc A
 * §2.2/§2.3).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { lotOccupantCreateSchema } from "../../../../../lib/lots/schemas";
import {
  ajouterOccupant,
  PermissionRefuseeError,
  LotIntrouvableError,
} from "../../../../../lib/lots/lots";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = lotOccupantCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const lotOccupant = await ajouterOccupant(ctx, id, parsed.data);
    return ok(lotOccupant, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof LotIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
