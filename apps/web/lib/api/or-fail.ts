/**
 * Page de détail : `if (!res.ok) notFound()` transformait TOUT échec (session expirée, accès
 * refusé, panne) en « Page introuvable ». `orFail` dit la vérité :
 *   404 → notFound() ;
 *   401 → /{locale}/connexion?next=<page courante> (retour exact après reconnexion) ;
 *   403 → écran « Pas d'accès » (/{locale}/acces-refuse) ;
 *   402 → abonnement suspendu : même écran, motif « abonnement » + contact du syndic ;
 *   autre (500, réseau…) → exception : la frontière (app)/error.tsx garde la coque et propose
 *   « Réessayer » avec la référence.
 */
import { notFound, redirect } from "next/navigation";
import type { ApiResult } from "./types";
import type { Locale } from "../i18n";
import { currentPathWithoutLocale } from "../request-info";

export class ApiLoadError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId?: string
  ) {
    super(`Chargement impossible (${code} ${status})${requestId ? ` [${requestId}]` : ""}`);
    this.name = "ApiLoadError";
  }
}

/** Décision pure (testable) : que faire d'une réponse en échec. */
export type FailDecision =
  | { kind: "notFound" }
  | { kind: "login" }
  | { kind: "forbidden"; motif?: "abonnement" }
  | { kind: "throw" };

export function decideFailure(res: { status: number; error: { code: string } }): FailDecision {
  if (res.status === 404 || res.error.code === "NOT_FOUND") return { kind: "notFound" };
  if (res.status === 401 || res.error.code === "UNAUTHENTICATED") return { kind: "login" };
  if (res.status === 402) return { kind: "forbidden", motif: "abonnement" };
  if (res.status === 403 || res.error.code === "FORBIDDEN") return { kind: "forbidden" };
  return { kind: "throw" };
}

export function loginPath(locale: Locale, next: string | null): string {
  return `/${locale}/connexion${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
}

export function forbiddenPath(locale: Locale, motif?: "abonnement"): string {
  return `/${locale}/acces-refuse${motif ? `?motif=${motif}` : ""}`;
}

/** Échec d'une réponse quelconque (sans retour). */
export async function failWith(res: Extract<ApiResult<unknown>, { ok: false }>, locale: Locale): Promise<never> {
  const d = decideFailure(res);
  if (d.kind === "notFound") notFound();
  if (d.kind === "login") redirect(loginPath(locale, await currentPathWithoutLocale()));
  if (d.kind === "forbidden") redirect(forbiddenPath(locale, d.motif));
  console.error(
    JSON.stringify({ niveau: "error", message: "chargement de page impossible", code: res.error.code, status: res.status, request_id: res.requestId })
  );
  throw new ApiLoadError(res.error.code, res.status, res.requestId);
}

/** Données d'une réponse réussie, sinon l'issue juste (voir en tête de fichier). */
export async function orFail<T>(res: ApiResult<T>, locale: Locale): Promise<T> {
  if (res.ok) return res.data;
  return failWith(res, locale);
}
