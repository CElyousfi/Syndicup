import { describe, expect, it } from "vitest";
import { dataOr, firstFailure, unwrapList, unwrapOptional } from "../api/unwrap";
import { decideFailure, forbiddenPath, loginPath } from "../api/or-fail";
import type { ApiResult } from "../api/types";

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data, meta: { request_id: "r" }, status: 200 });
const ko = (status: number, code: string): ApiResult<never> => ({
  ok: false,
  status,
  error: { code, message: "m" },
  requestId: "abcd1234-xyz",
});

describe("unwrapList", () => {
  it("garde la différence entre « vide » et « indisponible »", () => {
    expect(unwrapList(ok([]))).toEqual({ ok: true, data: [] });
    const echec = unwrapList(ko(500, "INTERNAL_ERROR"));
    expect(echec.ok).toBe(false);
    if (!echec.ok) {
      expect(echec.error.code).toBe("INTERNAL_ERROR");
      expect(echec.error.status).toBe(500);
      expect(echec.error.requestId).toBe("abcd1234-xyz");
    }
  });
  it("appel non fait pour ce rôle = vide légitime", () => {
    expect(unwrapOptional(null, [] as number[])).toEqual({ ok: true, data: [] });
    expect(unwrapOptional(ko(0, "NETWORK"), [] as number[]).ok).toBe(false);
  });
  it("dataOr / firstFailure", () => {
    expect(dataOr(unwrapList(ko(500, "X")), [1])).toEqual([1]);
    expect(firstFailure(unwrapList(ok([1])), null, unwrapList(ko(503, "SERVICE_UNAVAILABLE")))?.code).toBe("SERVICE_UNAVAILABLE");
    expect(firstFailure(unwrapList(ok([1])))).toBeNull();
  });
});

describe("orFail — décision", () => {
  it.each([
    [404, "NOT_FOUND", "notFound"],
    [401, "UNAUTHENTICATED", "login"],
    [403, "FORBIDDEN", "forbidden"],
    [402, "PAYMENT_REQUIRED", "forbidden"],
    [500, "INTERNAL_ERROR", "throw"],
    [0, "NETWORK", "throw"],
    [422, "UNPROCESSABLE_ENTITY", "throw"],
  ])("%i %s → %s", (status, code, kind) => {
    expect(decideFailure({ status, error: { code } }).kind).toBe(kind);
  });
  it("402 porte le motif abonnement", () => {
    expect(decideFailure({ status: 402, error: { code: "X" } })).toEqual({ kind: "forbidden", motif: "abonnement" });
  });
  it("chemins", () => {
    expect(loginPath("ar", "/incidents/42?onglet=x")).toBe("/ar/connexion?next=%2Fincidents%2F42%3Fonglet%3Dx");
    expect(loginPath("fr", null)).toBe("/fr/connexion");
    expect(loginPath("fr", "/")).toBe("/fr/connexion");
    expect(forbiddenPath("fr")).toBe("/fr/acces-refuse");
    expect(forbiddenPath("fr", "abonnement")).toBe("/fr/acces-refuse?motif=abonnement");
  });
});
