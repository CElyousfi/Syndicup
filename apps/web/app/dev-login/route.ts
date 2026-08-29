/**
 * Connexion de DÉVELOPPEMENT uniquement — 404 systématique hors NODE_ENV=development.
 * Permet de se connecter d'un clic avec un compte du seed local :
 *   /dev-login?email=syndic.alamal@example.ma&next=/fr/tableau-de-bord
 * Mot de passe du seed local : SyndicUp2026! (packages/database/scripts/seed-auth-local.ts).
 */
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  const email = req.nextUrl.searchParams.get("email") ?? "syndic.alamal@example.ma";
  const next = req.nextUrl.searchParams.get("next") ?? "/fr/tableau-de-bord";

  const r = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, mot_de_passe: "SyndicUp2026!" }),
    cache: "no-store",
  });
  if (!r.ok) return new Response(`login failed: ${await r.text()}`, { status: 500 });
  const { data } = (await r.json()) as {
    data: { access_token: string; refresh_token: string; expires_in: number };
  };

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set("su_access", data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: data.expires_in,
  });
  res.cookies.set("su_refresh", data.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.delete("su_copro");
  return res;
}
