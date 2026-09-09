/**
 * M0 — GET /api/health (sonde Render) : 200 { status, version, commit, db } après SELECT 1 ;
 * 503 si la base ne répond pas ; sans enveloppe, jamais mis en cache. CMI : 501 tant que
 * CMI_WEBHOOK_HMAC_SECRET est absent.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/health/route";
import { etatSante, versionApplication } from "../lib/health";
import { disconnectTenantDb } from "../lib/tenant/db";
import { POST as initierCmi } from "../app/v1/finances/paiements/cmi/initier/route";
import { POST as webhookCmi } from "../app/v1/finances/paiements/cmi/webhook/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("200 ok avec version, commit et db=ok quand la base répond", async () => {
    vi.stubEnv("RENDER_GIT_COMMIT", "abc1234");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ status: "ok", version: versionApplication(), commit: "abc1234", db: "ok" });
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    await disconnectTenantDb();
  });

  it("503 degraded avec db=error si le ping échoue ; commit null sans RENDER_GIT_COMMIT", async () => {
    vi.stubEnv("RENDER_GIT_COMMIT", "");
    const { corps, statut } = await etatSante(() => Promise.reject(new Error("connexion refusée")));
    expect(statut).toBe(503);
    expect(corps).toEqual({ status: "degraded", version: versionApplication(), commit: null, db: "error" });
  });
});

describe("routes CMI sans configuration", () => {
  it("initier et webhook répondent 501 NOT_IMPLEMENTED quand CMI_WEBHOOK_HMAC_SECRET est absent", async () => {
    vi.stubEnv("CMI_WEBHOOK_HMAC_SECRET", "");
    const req = () => new Request("http://localhost:3001/v1/finances/paiements/cmi/initier", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    for (const handler of [initierCmi, webhookCmi]) {
      const res = await handler(req(), undefined as never);
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_IMPLEMENTED");
      expect(body.error.message).toContain("CMI");
    }
  });
});
