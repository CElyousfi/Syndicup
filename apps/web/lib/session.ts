/**
 * Session côté web — les jetons Supabase vivent dans des cookies httpOnly, jamais exposés au
 * JavaScript client (le navigateur ne parle JAMAIS directement à l'API : Server Components et
 * Server Actions relaient, cf. PARITE_WEB_MOBILE M12).
 */
import { cookies } from "next/headers";

export const COOKIE_ACCESS = "su_access";
export const COOKIE_REFRESH = "su_refresh";
export const COOKIE_COPRO = "su_copro";

const BASE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export interface SessionCookies {
  accessToken: string | null;
  refreshToken: string | null;
  coproprieteId: string | null;
}

export async function readSession(): Promise<SessionCookies> {
  const jar = await cookies();
  return {
    accessToken: jar.get(COOKIE_ACCESS)?.value ?? null,
    refreshToken: jar.get(COOKIE_REFRESH)?.value ?? null,
    coproprieteId: jar.get(COOKIE_COPRO)?.value ?? null,
  };
}

/** À appeler uniquement depuis une Server Action ou un Route Handler. */
export async function writeTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_ACCESS, tokens.access_token, {
    ...BASE_OPTS,
    maxAge: Math.max(60, tokens.expires_in),
  });
  // Le refresh token Supabase est rotatif et sans expiration courte — 30 jours de session max.
  jar.set(COOKIE_REFRESH, tokens.refresh_token, { ...BASE_OPTS, maxAge: 60 * 60 * 24 * 30 });
}

export async function writeCoproprieteId(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_COPRO, id, { ...BASE_OPTS, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_ACCESS);
  jar.delete(COOKIE_REFRESH);
  jar.delete(COOKIE_COPRO);
}

/** Décode l'exp d'un JWT sans vérifier la signature (le serveur API vérifie, lui). */
export function jwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Jeton d'appareil des invitations (posé par le middleware) — usage unique des codes (M17). */
export async function readInvitationJeton(): Promise<string | null> {
  const store = await cookies();
  return store.get("su_invitation")?.value ?? null;
}
