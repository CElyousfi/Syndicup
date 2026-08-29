/**
 * Client API côté serveur (Server Components / Server Actions uniquement — les cookies httpOnly
 * portent le JWT). Toutes les réponses suivent l'enveloppe { data, meta } / { error, meta }.
 *
 *  - `apiFetch`   : appel authentifié dans le contexte tenant (Bearer + X-Copropriete-Id).
 *  - `apiPublic`  : endpoints /auth/* sans jeton.
 *  - Idempotency-Key générée par appel quand `idempotent: true` — le pattern « Réessayer »
 *    après erreur réseau est donc toujours sûr (jamais de doublon financier).
 */
import { randomUUID } from "node:crypto";
import { readSession } from "../session";
import type { ApiMeta, ApiError, ApiResult } from "./types";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Génère et joint un header Idempotency-Key (écritures financières/probantes). */
  idempotent?: boolean;
  /** Clé d'idempotence imposée (retry explicite d'un même geste utilisateur). */
  idempotencyKey?: string;
  /** Jeton explicite (avant que le cookie soit posé, ex. bootstrap de session). */
  accessToken?: string;
  /** Copropriété explicite (avant le cookie, ex. sélection en cours). */
  coproprieteId?: string;
  searchParams?: Record<string, string | number | undefined>;
}

async function run<T>(path: string, opts: FetchOptions, auth: boolean): Promise<ApiResult<T>> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(opts.searchParams ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const session = await readSession();
    const token = opts.accessToken ?? session.accessToken;
    if (!token) {
      return {
        ok: false,
        status: 401,
        error: { code: "UNAUTHENTICATED", message: "Session absente." },
      };
    }
    headers.Authorization = `Bearer ${token}`;
    const copro = opts.coproprieteId ?? session.coproprieteId;
    if (copro) headers["X-Copropriete-Id"] = copro;
  }
  if (opts.idempotent || opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey ?? randomUUID();
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: { code: "INTERNAL_ERROR", message: "API injoignable." },
    };
  }

  let payload: { data?: unknown; meta?: ApiMeta; error?: ApiError } = {};
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    // corps vide ou non-JSON — traité selon le status ci-dessous
  }

  if (!res.ok || payload.error) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "") || undefined;
    return {
      ok: false,
      status: res.status,
      error:
        payload.error ??
        ({ code: "INTERNAL_ERROR", message: `Réponse inattendue (${res.status}).` } as ApiError),
      requestId: payload.meta?.request_id ?? res.headers.get("X-Request-Id") ?? undefined,
      retryAfter,
    };
  }

  return {
    ok: true,
    status: res.status,
    data: payload.data as T,
    meta: payload.meta ?? { request_id: "" },
  };
}

export function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<ApiResult<T>> {
  return run<T>(path, opts, true);
}

export function apiPublic<T>(path: string, opts: FetchOptions = {}): Promise<ApiResult<T>> {
  return run<T>(path, opts, false);
}
