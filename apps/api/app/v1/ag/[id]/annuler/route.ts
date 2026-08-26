/**
 * POST /v1/ag/:id/annuler — annulation avec motif obligatoire (Doc A §12.2 — M6, ajout nécessaire).
 */
import { agAnnulerSchema } from "../../../../../lib/ag/schemas";
import {
  annulerAg,
  PermissionRefuseeError,
  AgIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = agAnnulerSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const ag = await annulerAg(ctx, id, parsed.data.motif);
    return ok(ag);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
