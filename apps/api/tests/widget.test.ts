import { describe, it, expect } from "vitest";
import { composerCharges, composerRecouvrement, CATEGORIES_URGENTES, type AppelPourResidence } from "../lib/users/widget-compose";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("composerCharges", () => {
  it("solde, prochaine échéance et anneau de progression", () => {
    const r = composerCharges(["lot-1"], [
      { lotId: "lot-1", montantDu: "1000.00", montantPaye: "1000.00", statut: "PAYE", dateEcheance: d("2026-01-31"), appelStatut: "CLOTURE" },
      { lotId: "lot-1", montantDu: "1000.00", montantPaye: "250.00", statut: "PARTIEL", dateEcheance: d("2026-04-30"), appelStatut: "EMIS" },
      { lotId: "lot-1", montantDu: "1000.00", montantPaye: "0", statut: "IMPAYE", dateEcheance: d("2026-07-31"), appelStatut: "EMIS" },
      // Brouillon : jamais compté (pas encore émis au résident).
      { lotId: "lot-1", montantDu: "9999.00", montantPaye: "0", statut: "IMPAYE", dateEcheance: d("2026-10-31"), appelStatut: "BROUILLON" },
    ]);
    expect(r.solde_du).toBe("1750.00");
    expect(r.prochaine_echeance).toBe("2026-04-30");
    expect(r.prochain_montant).toBe("750.00");
    expect(r.taux_paye).toBeCloseTo(1250 / 3000, 4);
    expect(r.nb_quittances).toBe(1);
    expect(r.lot_id).toBe("lot-1");
  });
  it("plusieurs lots : pas de lot cible, anneau plein sans appel", () => {
    const r = composerCharges(["a", "b"], []);
    expect(r.lot_id).toBeNull();
    expect(r.taux_paye).toBe(1);
    expect(r.solde_du).toBe("0.00");
  });
});

describe("composerRecouvrement", () => {
  it("6 derniers appels émis dans l'ordre des périodes, impayé global", () => {
    const appels: AppelPourResidence[] = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"].map((p, i) => ({ id: `a${i}`, periode: p, statut: "EMIS" }));
    appels.push({ id: "brouillon", periode: "2026-06", statut: "BROUILLON" });
    const lignes = appels.flatMap((a) => [{ appelDeFondsId: a.id, montantDu: "100.00", montantPaye: a.id === "a6" ? "50.00" : "100.00" }]);
    const r = composerRecouvrement(appels, lignes);
    expect(r.recouvrement_6).toHaveLength(6);
    expect(r.recouvrement_6.at(-1)).toBe(0.5);
    expect(r.impaye_total).toBe("50.00");
    expect(r.taux_recouvrement).toBeCloseTo(650 / 700, 4);
  });
});

describe("catégories urgentes", () => {
  it("barre rouge seulement pour urgence / coupure / sécurité", () => {
    expect(CATEGORIES_URGENTES.has("URGENCE")).toBe(true);
    expect(CATEGORIES_URGENTES.has("CONVIVIALITE")).toBe(false);
  });
});
