/**
 * Seam Sentry — no-op tant que SENTRY_DSN n'est pas défini (M0 non provisionné).
 * L'init réelle est faite par instrumentation.ts (hook Next 15) ; captureException reste
 * appelable partout sans garde : sans DSN elle ne fait rien.
 */
import { getRequestContext } from "../http/request-context-storage";

type SentryModule = typeof import("@sentry/node");

let sentry: SentryModule | null = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const mod = await import("@sentry/node");
  mod.init({ dsn, environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development" });
  sentry = mod;
}

export function captureException(e: unknown): void {
  if (!sentry) return;
  const ctx = getRequestContext();
  sentry.withScope((scope) => {
    if (ctx?.requestId) scope.setTag("request_id", ctx.requestId);
    if (ctx?.utilisateurId) scope.setTag("utilisateur_id", ctx.utilisateurId);
    if (ctx?.coproprieteId) scope.setTag("copropriete_id", ctx.coproprieteId);
    sentry?.captureException(e);
  });
}
