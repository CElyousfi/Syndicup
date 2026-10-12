import { describe, it, expect } from "vitest";
import { comparerSemver, verdict } from "../lib/app-version";

describe("comparerSemver", () => {
  it("compare numériquement, pas lexicalement", () => {
    expect(comparerSemver("1.10.0", "1.9.0")).toBe(1);
    expect(comparerSemver("1.2.3", "1.2.3")).toBe(0);
    expect(comparerSemver("0.9.9", "1.0.0")).toBe(-1);
  });
});

describe("verdict", () => {
  const env = { APP_MIN_VERSION_IOS: "2.0.0", APP_LATEST_VERSION_IOS: "2.1.0" } as NodeJS.ProcessEnv;
  it("deux niveaux", () => {
    expect(verdict("ios", "1.9.0", env).statut).toBe("bloquer");
    expect(verdict("ios", "2.0.5", env).statut).toBe("proposer");
    expect(verdict("ios", "2.1.0", env).statut).toBe("ok");
  });
  it("ignore une version client mal formée ou une config absente", () => {
    expect(verdict("ios", "beta", env).statut).toBe("ok");
    expect(verdict("android", "0.0.1", env).statut).toBe("ok");
    expect(verdict("ios", "1.0.0", { APP_MIN_VERSION_IOS: "pas-semver" } as NodeJS.ProcessEnv).statut).toBe("ok");
  });
});
