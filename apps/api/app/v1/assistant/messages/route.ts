/**
 * POST /v1/assistant/messages — Dari répond à une question, ancré sur les données de
 * l'utilisateur (rôle + RLS) et la carte des écrans de son rôle. Lecture seule : aucune
 * écriture métier, rien n'est stocké (l'historique court voyage avec la requête).
 *
 * 501 si GROQ_API_KEY absente, 503 si tous les modèles sont saturés, 429 au-delà du plafond
 * par utilisateur (RATE_LIMIT_ASSISTANT_MAX / 10 min).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";
import { enforceRateLimit } from "../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../lib/rate-limit";
import { repondre, AssistantIndisponibleError, AssistantNonConfigureError } from "../../../../lib/assistant";
import { assistantMessagesSchema } from "../../../../lib/assistant/schemas";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const limite = await enforceRateLimit(req, "assistant", RATE_LIMITS.assistant(), ctx.utilisateurId);
    if (limite) return limite;
    const body = await req.json().catch(() => null);
    const parsed = assistantMessagesSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await repondre(ctx, parsed.data));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof AssistantNonConfigureError) return fail("NOT_IMPLEMENTED", "L'assistant n'est pas activé sur ce déploiement.");
    if (e instanceof AssistantIndisponibleError) return fail("SERVICE_UNAVAILABLE", "L'assistant est très sollicité — réessayez dans un instant.");
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
