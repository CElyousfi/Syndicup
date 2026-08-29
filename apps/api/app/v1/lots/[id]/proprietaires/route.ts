/**
 * POST /v1/lots/:id/proprietaires — ajoute un copropriétaire (plein, SCI) OU, d'un seul bloc,
 * les co-indivisaires d'une indivision `{ proprietaires: [...] }` (Doc A §2.4). La contrainte
 * « somme des quote_part actives = 100 % » est appliquée par un trigger DB différé au commit
 * (migration M3) : une indivision ne peut donc être créée qu'en une transaction — d'où la
 * forme liste. Remontée en 422 si la somme n'est pas 100.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { lotProprietairesCreateSchema } from "../../../../../lib/lots/schemas";
import {
  ajouterProprietaires,
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
    const parsed = lotProprietairesCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const liste = "proprietaires" in parsed.data ? parsed.data.proprietaires : [parsed.data];
    const crees = await ajouterProprietaires(ctx, id, liste);
    // Rétro-compatible : un seul copropriétaire → l'objet ; une liste → le tableau.
    return ok("proprietaires" in parsed.data ? crees : crees[0], { status: 201 });
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
