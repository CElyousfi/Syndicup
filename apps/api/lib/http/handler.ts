/**
 * Wrapper commun de route handler — filet de sécurité le plus externe :
 *   - pose le RequestContext (request_id entrant X-Request-Id ou généré, IP x-forwarded-for) ;
 *   - renvoie X-Request-Id sur TOUTE réponse (succès comme erreur) ;
 *   - attrape tout ce qui s'échappe : mapAuthError d'abord, sinon log structuré + Sentry +
 *     enveloppe INTERNAL_ERROR — jamais de 500 Next brut sans enveloppe (CLAUDE.md §5).
 * Les try/catch internes des routes restent la voie normale des erreurs métier.
 */
import { randomUUID } from "node:crypto";
import { runWithRequestContext } from "./request-context-storage";
import { mapAuthError } from "./request-context";
import { IdempotencyKeyManquanteError, IdempotencyConflitError } from "./idempotency";
import { fail } from "./respond";
import { logger } from "../logging/logger";
import { captureException } from "../observability/sentry";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteHandler<C> = (req: Request, routeCtx: C) => Promise<Response> | Response;

export function withApiHandler<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req: Request, routeCtx: C): Promise<Response> => {
    const entrant = req.headers.get("x-request-id");
    const requestId = entrant && UUID_RE.test(entrant) ? entrant : randomUUID();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    return runWithRequestContext({ requestId, ip }, async () => {
      let res: Response;
      try {
        res = await handler(req, routeCtx);
      } catch (e) {
        const mapped = mapAuthError(e);
        if (mapped) {
          res = mapped;
        } else if (e instanceof IdempotencyKeyManquanteError) {
          res = fail("VALIDATION_ERROR", e.message);
        } else if (e instanceof IdempotencyConflitError) {
          res = fail("CONFLICT", e.message);
        } else {
          logger.error("Erreur non gérée dans un handler API", {
            methode: req.method,
            url: new URL(req.url).pathname,
            erreur:
              e instanceof Error ? { nom: e.name, message: e.message, stack: e.stack } : String(e),
          });
          captureException(e);
          res = fail("INTERNAL_ERROR", "Erreur interne.");
        }
      }
      const headers = new Headers(res.headers);
      headers.set("x-request-id", requestId);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    });
  };
}
