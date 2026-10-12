/**
 * Tests HTTP — routes auth (GoTrue mocké) : formes d'enveloppes, mapping des statuts,
 * X-Request-Id sur toute réponse, rate limiting 429 (Partie 3.4).
 * Les handlers de route sont invoqués directement avec des Request construits — pas de serveur.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  loginEmail: vi.fn(),
  refresh: vi.fn(),
  demanderReinitialisation: vi.fn(),
  reinitialiserMotDePasse: vi.fn(),
}));

vi.mock("../../lib/auth/supabase", () => ({
  createSupabaseAuth: () => mocks,
}));

import { POST as loginPOST } from "../../app/v1/auth/login/route";
import { POST as forgotPOST } from "../../app/v1/auth/password/forgot/route";
import { POST as resetPOST } from "../../app/v1/auth/password/reset/route";
import { GET as versionGET } from "../../app/v1/app/version/route";
import { _resetMemoryRateLimiter } from "../../lib/rate-limit/memory";

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3001/v1/auth/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetMemoryRateLimiter();
});

describe("POST /v1/auth/password/forgot (HTTP)", () => {
  it("200 { envoye: true } que l'e-mail existe ou non (aucune énumération), avec X-Request-Id", async () => {
    mocks.demanderReinitialisation.mockResolvedValue({ error: null });
    const ok = await forgotPOST(req({ email: "a@b.ma" }), undefined);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-request-id")).toBeTruthy();
    expect((await ok.json()).data).toEqual({ envoye: true });

    mocks.demanderReinitialisation.mockResolvedValue({ error: "User not found" });
    const inconnu = await forgotPOST(req({ email: "inconnu@b.ma" }), undefined);
    expect(inconnu.status).toBe(200);
    expect((await inconnu.json()).data).toEqual({ envoye: true });
  });

  it("transmet le lien de retour localisé à GoTrue", async () => {
    mocks.demanderReinitialisation.mockResolvedValue({ error: null });
    process.env.NEXT_PUBLIC_APP_URL = "https://app.syndicup.pro/";
    try {
      await forgotPOST(req({ email: "A@B.ma", langue: "ar" }), undefined);
      expect(mocks.demanderReinitialisation).toHaveBeenCalledWith("a@b.ma", "https://app.syndicup.pro/ar/reinitialiser");
    } finally {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("400 VALIDATION_ERROR sur e-mail invalide", async () => {
    const res = await forgotPOST(req({ email: "pas-un-email" }), undefined);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("429 RATE_LIMITED après la limite par e-mail, avec Retry-After", async () => {
    mocks.demanderReinitialisation.mockResolvedValue({ error: null });
    process.env.RATE_LIMIT_PASSWORD_RESET_MAX = "2";
    try {
      for (let i = 0; i < 2; i++) expect((await forgotPOST(req({ email: "x@b.ma" }), undefined)).status).toBe(200);
      const res = await forgotPOST(req({ email: "x@b.ma" }), undefined);
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBeTruthy();
    } finally {
      delete process.env.RATE_LIMIT_PASSWORD_RESET_MAX;
    }
  });
});

describe("POST /v1/auth/password/reset (HTTP)", () => {
  it("200 avec la session quand le lien est valide", async () => {
    mocks.reinitialiserMotDePasse.mockResolvedValue({
      session: { access_token: "a", refresh_token: "r", expires_in: 3600 },
      userId: "u1",
      error: null,
    });
    const res = await resetPOST(req({ token_hash: "x".repeat(40), mot_de_passe: "nouveauMdp1!" }), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.access_token).toBe("a");
    expect(body.data.utilisateur_id).toBe("u1");
  });

  it("401 UNAUTHENTICATED sur lien invalide/expiré", async () => {
    mocks.reinitialiserMotDePasse.mockResolvedValue({ session: null, userId: null, error: "expired" });
    const res = await resetPOST(req({ token_hash: "x".repeat(40), mot_de_passe: "nouveauMdp1!" }), undefined);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("400 sur mot de passe trop court", async () => {
    const res = await resetPOST(req({ token_hash: "x".repeat(40), mot_de_passe: "court" }), undefined);
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/app/version (HTTP)", () => {
  const get = (q: string) => versionGET(new Request(`http://localhost:3001/v1/app/version?${q}`), undefined);
  const env = { APP_MIN_VERSION_ANDROID: "1.2.0", APP_LATEST_VERSION_ANDROID: "1.4.0", APP_STORE_URL_ANDROID: "https://play.google.com/store/apps/details?id=ma.syndicup.app" };

  beforeEach(() => Object.assign(process.env, env));
  afterEach(() => { for (const k of Object.keys(env)) delete process.env[k]; });

  it("bloquer sous la minimale, proposer sous la dernière, ok sinon ; cache public 5 min", async () => {
    for (const [v, statut] of [["1.1.9", "bloquer"], ["1.2.0", "proposer"], ["1.3.7", "proposer"], ["1.4.0", "ok"], ["2.0.0", "ok"]] as const) {
      const res = await get(`plateforme=android&version=${v}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.statut, v).toBe(statut);
      expect(body.data.url_store).toBe(env.APP_STORE_URL_ANDROID);
      expect(res.headers.get("cache-control")).toContain("max-age=300");
    }
  });

  it("ok quand la plateforme n'a rien de configuré (iOS ici), et sans version client", async () => {
    expect((await (await get("plateforme=ios&version=0.0.1")).json()).data.statut).toBe("ok");
    expect((await (await get("plateforme=android")).json()).data.statut).toBe("ok");
  });

  it("400 sur plateforme inconnue", async () => {
    expect((await get("plateforme=windows&version=1.0.0")).status).toBe(400);
  });
});

describe("POST /v1/auth/login (HTTP)", () => {
  it("401 UNAUTHENTICATED sur identifiants invalides (jamais de détail GoTrue)", async () => {
    mocks.loginEmail.mockResolvedValue({ session: null, userId: null, error: "bad creds" });
    const res = await loginPOST(req({ email: "a@b.ma", mot_de_passe: "xxxxxxxx" }), undefined);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).not.toContain("bad creds");
  });

  it("200 avec les tokens de session en cas de succès", async () => {
    mocks.loginEmail.mockResolvedValue({
      session: { access_token: "at", refresh_token: "rt", expires_in: 3600 },
      userId: "3f0d2f6a-0000-4000-8000-00000000aaaa",
      error: null,
    });
    const res = await loginPOST(req({ email: "a@b.ma", mot_de_passe: "xxxxxxxx" }), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.access_token).toBe("at");
    expect(body.data.utilisateur_id).toBe("3f0d2f6a-0000-4000-8000-00000000aaaa");
  });
});
