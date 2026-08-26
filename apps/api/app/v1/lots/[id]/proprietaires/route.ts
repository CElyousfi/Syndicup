/**
 * POST /v1/lots/:id/proprietaires — ajoute un copropriétaire (plein, indivision, SCI — Doc A
 * §2.4). Contrainte "somme des quote_part actives = 100%" appliquée par trigger DB (migration
 * M3), remontée ici en 422.
 */
import { lotProprietaireCreateSchema } from "../../../../../lib/lots/schemas";
import {
  ajouterProprietaire,
  PermissionRefuseeError,
  LotIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/lots/lots";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = lotProprietaireCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const lotProprietaire = await ajouterProprietaire(ctx, id, parsed.data);
    return ok(lotProprietaire, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof LotIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
