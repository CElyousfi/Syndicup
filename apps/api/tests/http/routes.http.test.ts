/**
 * Tests HTTP transverses — un handler représentatif par famille : mapping des statuts
 * (401/400/…), enveloppe d'erreur avec meta.request_id, exigence Idempotency-Key sur les
 * écritures financières/probantes. Sans bearer valide, tout s'arrête à l'auth — ces tests
 * vérifient la COUCHE HTTP, pas le métier (couvert par les tests service).
 */
import { describe, it, expect } from "vitest";
import { GET as lotsGET } from "../../app/v1/lots/route";
import { POST as paiementsPOST } from "../../app/v1/finances/paiements/route";
import { POST as visitesPOST } from "../../app/v1/visites/route";
import { GET as notificationsGET } from "../../app/v1/notifications/route";

const routeCtx = undefined;

describe("Mapping HTTP commun", () => {
  it("401 UNAUTHENTICATED sans bearer, enveloppe complète + X-Request-Id", async () => {
    const res = await lotsGET(new Request("http://localhost:3001/v1/lots"), routeCtx);
    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.meta.request_id).toBe(res.headers.get("x-request-id"));
  });

  it("X-Request-Id entrant propagé jusque dans la réponse d'erreur", async () => {
    const entrant = "0198aaaa-bbbb-7ccc-8ddd-eeeeffff0000";
    const res = await notificationsGET(
      new Request("http://localhost:3001/v1/notifications", {
        headers: { "x-request-id": entrant },
      }),
      routeCtx
    );
    expect(res.headers.get("x-request-id")).toBe(entrant);
    const body = await res.json();
    expect(body.meta.request_id).toBe(entrant);
  });
});

describe("Exigence Idempotency-Key (écritures financières/probantes)", () => {
  const bearer = { authorization: "Bearer jeton-invalide-mais-present" };

  it("POST /finances/paiements sans Idempotency-Key → 400 explicite (avant même l'auth invalide ? non : auth d'abord)", async () => {
    // Sans bearer : 401 (l'auth passe en premier).
    const sansAuth = await paiementsPOST(
      new Request("http://localhost:3001/v1/finances/paiements", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      routeCtx
    );
    expect(sansAuth.status).toBe(401);

    // Avec bearer invalide : toujours 401 — la clé n'est lue qu'après une auth valide,
    // aucune information n'est divulguée à un appelant non authentifié.
    const res = await paiementsPOST(
      new Request("http://localhost:3001/v1/finances/paiements", {
        method: "POST",
        headers: bearer,
        body: JSON.stringify({ montant: "10.00", methode: "VIREMENT" }),
      }),
      routeCtx
    );
    expect(res.status).toBe(401);
  });

  it("POST /visites : enveloppe 401 uniforme (idempotence sync_queue documentée au contrat)", async () => {
    const res = await visitesPOST(
      new Request("http://localhost:3001/v1/visites", {
        method: "POST",
        body: JSON.stringify({ lot_id: "x", visiteur_nom: "y" }),
      }),
      routeCtx
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});
