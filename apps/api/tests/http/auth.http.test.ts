/**
 * Tests HTTP — routes auth (GoTrue mocké) : formes d'enveloppes, mapping des statuts,
 * X-Request-Id sur toute réponse, rate limiting 429 (Partie 3.4).
 * Les handlers de route sont invoqués directement avec des Request construits — pas de serveur.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  otpRequest: vi.fn(),
  otpVerify: vi.fn(),
  loginEmail: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../lib/auth/supabase", () => ({
  createSupabaseAuth: () => mocks,
}));

import { POST as otpRequestPOST } from "../../app/v1/auth/otp/request/route";
import { POST as loginPOST } from "../../app/v1/auth/login/route";
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

describe("POST /v1/auth/otp/request (HTTP)", () => {
  it("200 avec enveloppe data+meta.request_id et header X-Request-Id", async () => {
    mocks.otpRequest.mockResolvedValue({ error: null });
    const res = await otpRequestPOST(req({ telephone: "+212600000001" }), undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body.data).toEqual({ envoye: true });
    expect(body.meta.request_id).toBeTruthy();
  });

  it("400 VALIDATION_ERROR sur payload invalide, avec meta.request_id", async () => {
    const res = await otpRequestPOST(req({ telephone: "pas-un-numero" }), undefined);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.meta.request_id).toBeTruthy();
  });

  it("429 RATE_LIMITED après la limite, avec Retry-After", async () => {
    mocks.otpRequest.mockResolvedValue({ error: null });
    process.env.RATE_LIMIT_OTP_REQUEST_MAX = "2";
    try {
      for (let i = 0; i < 2; i++) {
        const ok = await otpRequestPOST(req({ telephone: "+212600000009" }), undefined);
        expect(ok.status).toBe(200);
      }
      const res = await otpRequestPOST(req({ telephone: "+212600000009" }), undefined);
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBeTruthy();
      const body = await res.json();
      expect(body.error.code).toBe("RATE_LIMITED");
    } finally {
      delete process.env.RATE_LIMIT_OTP_REQUEST_MAX;
    }
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
