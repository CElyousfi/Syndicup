/**
 * GET /v1/assistant — Dari : ce qui mérite l'attention maintenant (calcul déterministe sur
 * l'instantané du widget, filtré par rôle + RLS) et questions proposées. Aucun appel au modèle.
 */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";
import { etatAssistant } from "../../../lib/assistant";
import { assistantQuerySchema } from "../../../lib/assistant/schemas";
import { PermissionRefuseeError } from "../../../lib/users/widget";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const parsed = assistantQuerySchema.safeParse({ langue: url.searchParams.get("langue") ?? undefined });
    if (!parsed.success) return failZod(parsed.error);
    return ok(await etatAssistant(ctx, parsed.data.langue));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
