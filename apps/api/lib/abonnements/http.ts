/** M29 — routes de la console opérateur : contexte tenant vérifié + mapping d'erreurs commun. */
import type { ZodTypeAny, z } from "zod";
import { withApiHandler } from "../http/handler";
import { fail, failZod } from "../http/respond";
import { mapAuthError, tenantFromRequest } from "../http/request-context";
import type { TenantContext } from "../tenant/context";
import { AbonnementError, IntrouvableError, PermissionRefuseeError } from "./abonnements";

export function mapErreurAbonnement(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof AbonnementError) return fail(e.code, e.message);
  return null;
}

type Params = Record<string, string>;

/** Route authentifiée (contexte tenant vérifié) ; le service exige lui-même le rôle SUPER_ADMIN. */
export function routeOperateur<P extends Params = Params>(
  fn: (req: Request, ctx: TenantContext, params: P) => Promise<Response>
) {
  return withApiHandler(async (req: Request, routeCtx: { params: Promise<P> }) => {
    try {
      const ctx = await tenantFromRequest(req);
      return await fn(req, ctx, await routeCtx.params);
    } catch (e) {
      const m = mapErreurAbonnement(e);
      if (m) return m;
      throw e;
    }
  });
}

/** Parse le corps JSON ; renvoie la réponse 400 à retourner telle quelle si invalide. */
export async function corps<S extends ZodTypeAny>(req: Request, schema: S): Promise<{ data: z.infer<S> } | { erreur: Response }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  return parsed.success ? { data: parsed.data } : { erreur: failZod(parsed.error) };
}
