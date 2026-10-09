/**
 * GET /v1/config/client — drapeaux d'interface publics lus depuis l'environnement (ALIVE_V1),
 * sans authentification, cache 60 s, défaut ON sur valeur absente ou mal saisie.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/v1/config/client/route";
import { clientFlags, DEFAULT_CLIENT_FLAGS } from "../lib/config/client-flags";
import { envSchema } from "../lib/config/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

const appel = () => GET(new Request("http://localhost:3001/v1/config/client"), undefined);

describe("GET /v1/config/client", () => {
  it("200 sans jeton, enveloppe standard, cache public 60 s", async () => {
    vi.stubEnv("ALIVE_V1", "true");
    const res = await appel();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body.data).toEqual({ flags: { alive_v1: true } });
    expect(body.meta.request_id).toBeTruthy();
  });

  it("ALIVE_V1=false coupe la couche", async () => {
    vi.stubEnv("ALIVE_V1", "false");
    const body = await (await appel()).json();
    expect(body.data.flags.alive_v1).toBe(false);
  });

  it("variable absente ou invalide → défaut ON", () => {
    expect(DEFAULT_CLIENT_FLAGS.alive_v1).toBe(true);
    expect(clientFlags({})).toEqual({ alive_v1: true });
    expect(clientFlags({ ALIVE_V1: "peut-être" })).toEqual({ alive_v1: true });
    expect(clientFlags({ ALIVE_V1: " OFF " })).toEqual({ alive_v1: false });
    expect(clientFlags({ ALIVE_V1: "0" })).toEqual({ alive_v1: false });
  });

  it("ne renvoie que des booléens (aucun secret)", async () => {
    vi.stubEnv("JWT_SECRET", "x".repeat(40));
    const body = await (await appel()).json();
    for (const v of Object.values(body.data.flags)) expect(typeof v).toBe("boolean");
    expect(JSON.stringify(body)).not.toContain("xxxx");
  });

  it("le schéma d'environnement accepte ALIVE_V1 et refuse une valeur libre", () => {
    expect(envSchema.safeParse({ ALIVE_V1: "false" }).success).toBe(true);
    expect(envSchema.safeParse({ ALIVE_V1: "" }).success).toBe(true);
    expect(envSchema.safeParse({ ALIVE_V1: "maybe" }).success).toBe(false);
  });
});
