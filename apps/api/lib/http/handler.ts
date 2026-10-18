/**
 * Wrapper commun de route handler — filet de sécurité le plus externe :
 *   - pose le RequestContext (request_id entrant X-Request-Id ou généré, IP x-forwarded-for) ;
 *   - renvoie X-Request-Id sur TOUTE réponse (succès comme erreur) ;
 *   - attrape tout ce qui s'échappe : mapAuthError d'abord, sinon log structuré + Sentry +
 *     enveloppe INTERNAL_ERROR — jamais de 500 Next brut sans enveloppe (CLAUDE.md §5) ;
 *   - erreurs récupérables mappées centralement : Prisma P2025 → 404 NOT_FOUND, P2002 non
 *     traité par le domaine → 409 CONFLICT, stockage indisponible → 503 + Retry-After.
 * Les try/catch internes des routes restent la voie normale des erreurs métier.
 */
import { randomUUID } from "node:crypto";
import { runWithRequestContext } from "./request-context-storage";
import { mapAuthError } from "./request-context";
import { IdempotencyKeyManquanteError, IdempotencyConflitError } from "./idempotency";
import { fail, avecRetryAfter } from "./respond";
import { codePrisma, champsPrisma } from "./prisma-errors";
import { StockageIndisponibleError } from "../storage/erreurs";
import { logger } from "../logging/logger";
import { captureException } from "../observability/sentry";

/** Délai suggéré avant de réessayer après une panne du stockage de fichiers. */
const STOCKAGE_RETRY_AFTER_SEC = 10;

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
        } else if (e instanceof StockageIndisponibleError) {
          logger.warn("Stockage des fichiers indisponible", {
            methode: req.method,
            url: new URL(req.url).pathname,
            erreur: e.detail,
          });
          // Panne fournisseur : récupérable pour l'utilisateur, mais doit alerter (Sentry).
          captureException(e);
          res = avecRetryAfter(fail("SERVICE_UNAVAILABLE", e.message), STOCKAGE_RETRY_AFTER_SEC);
        } else if (codePrisma(e) === "P2025") {
          // update/delete/findUniqueOrThrow sur une ligne disparue (supprimée entre-temps, ou
          // masquée par la RLS) : état normal le plus souvent — tracé quand même, un vrai bug
          // (mauvais id, filtre tenant) doit laisser une piste.
          logger.warn("Élément introuvable (Prisma P2025) non mappé par le domaine", {
            methode: req.method,
            url: new URL(req.url).pathname,
            modele: (e as { meta?: { modelName?: unknown } }).meta?.modelName ?? null,
          });
          res = fail("NOT_FOUND", "Cet élément n'existe plus. Actualisez la page.");
        } else if (codePrisma(e) === "P2002") {
          // Violation d'unicité non traitée par le domaine : 409 sans aucun texte Postgres.
          logger.warn("Violation d'unicité non mappée par le domaine", {
            methode: req.method,
            url: new URL(req.url).pathname,
            champs: champsPrisma(e),
          });
          res = fail("CONFLICT", "Cette valeur existe déjà. Modifiez-la puis réessayez.");
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
