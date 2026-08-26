/**
 * Tests unitaires (sans DB) du socle observabilité :
 *   - withApiHandler : enveloppe INTERNAL_ERROR sur erreur non gérée, header X-Request-Id
 *     sur toute réponse, propagation d'un X-Request-Id entrant valide, mapping auth ;
 *   - respond : meta.request_id présent sur les erreurs ;
 *   - logger : masquage des téléphones et des secrets (pas de PII en clair, CLAUDE.md §5).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { withApiHandler } from "../lib/http/handler";
import { ok, fail } from "../lib/http/respond";
import { logger, maskTelephone } from "../lib/logging/logger";
import { UnauthenticatedError } from "../lib/tenant/jwt";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3001/v1/test", { headers });
}

afterEach(() => vi.restoreAllMocks());

describe("withApiHandler", () => {
  it("renvoie une enveloppe INTERNAL_ERROR (jamais un 500 brut) sur erreur non gérée", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true); // silencer le log d'erreur
    const handler = withApiHandler(() => {
      throw new Error("boom interne");
    });
    const res = await handler(req(), undefined);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("boom"); // pas de fuite du détail interne
    expect(body.meta.request_id).toMatch(UUID_RE);
    expect(res.headers.get("x-request-id")).toBe(body.meta.request_id);
  });

  it("propage un X-Request-Id entrant valide jusque dans l'enveloppe et le header", async () => {
    const entrant = "0198c0de-1111-7222-8333-444455556666";
    const handler = withApiHandler(() => ok({ ping: true }));
    const res = await handler(req({ "x-request-id": entrant }), undefined);
    expect(res.headers.get("x-request-id")).toBe(entrant);
    const body = await res.json();
    expect(body.meta.request_id).toBe(entrant);
  });

  it("ignore un X-Request-Id entrant non-UUID et en génère un", async () => {
    const handler = withApiHandler(() => ok({}));
    const res = await handler(req({ "x-request-id": "pas-un-uuid" }), undefined);
    const id = res.headers.get("x-request-id");
    expect(id).toMatch(UUID_RE);
  });

  it("mappe UnauthenticatedError en 401 même hors try/catch de la route", async () => {
    const handler = withApiHandler(() => {
      throw new UnauthenticatedError("Token manquant.");
    });
    const res = await handler(req(), undefined);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("journalise l'erreur non gérée en JSON structuré avec les champs obligatoires", async () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const handler = withApiHandler(() => {
      throw new Error("explosion");
    });
    await handler(req(), undefined);
    expect(write).toHaveBeenCalled();
    const ligne = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(ligne.niveau).toBe("error");
    expect(ligne.timestamp).toBeTruthy();
    expect(ligne.request_id).toMatch(UUID_RE);
    expect("copropriete_id" in ligne).toBe(true);
    expect("utilisateur_id" in ligne).toBe(true);
  });
});

describe("respond.fail", () => {
  it("inclut meta.request_id sur les erreurs (corrélation client-serveur)", async () => {
    const res = fail("NOT_FOUND", "Introuvable.");
    const body = await res.json();
    expect(body.meta.request_id).toMatch(UUID_RE);
  });
});

describe("logger — pas de PII en clair", () => {
  it("masque partiellement les numéros de téléphone", () => {
    expect(maskTelephone("+212612345678")).toBe("+2126••••••78");
    expect(maskTelephone("06")).toBe("••");
  });

  it("masque récursivement les clés téléphone et secrets dans les extras", () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    logger.info("test", {
      destinataire: { telephone: "+212612345678", nom: "Alami" },
      password: "supersecret",
    });
    const ligne = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(ligne.destinataire.telephone).toBe("+2126••••••78");
    expect(ligne.destinataire.nom).toBe("Alami");
    expect(ligne.password).toBe("[MASQUÉ]");
  });
});
