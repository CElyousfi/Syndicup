/**
 * Contexte de requête propagé par AsyncLocalStorage — porte le request_id (corrélation
 * client ↔ logs ↔ audit, CLAUDE.md §5), l'IP source, et l'identité résolue après auth.
 * Posé par withApiHandler (lib/http/handler.ts), enrichi par tenantFromRequest.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  ip: string | null;
  utilisateurId?: string;
  coproprieteId?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

/** Enrichit le contexte courant après résolution de l'identité (post-auth). No-op hors requête. */
export function setRequestIdentity(utilisateurId: string, coproprieteId?: string): void {
  const store = als.getStore();
  if (!store) return;
  store.utilisateurId = utilisateurId;
  if (coproprieteId) store.coproprieteId = coproprieteId;
}
