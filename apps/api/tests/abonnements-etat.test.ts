/**
 * M29 — logique pure des abonnements : état d'accès (dates → OK / RAPPEL / GRACE / BLOQUE),
 * montants de facture (TTC syndicat, HT cabinet, minimum, option Accompagné), grille, rappels.
 */
import { describe, expect, it } from "vitest";
import { ajouterJours, ajouterMois, etatAcces, jourCasablanca, type DonneesEtat } from "../lib/abonnements/etat";
import { calculerFacture } from "../lib/abonnements/calcul";
import { tarifSuggere } from "../lib/abonnements/tarifs";
import { rappelsDus } from "../lib/abonnements/rappels";
import { routeLibre } from "../lib/abonnements/routes-libres";

// 15 oct. 2026, 12:00 à Casablanca (UTC+1 → 11:00Z).
const MAINTENANT = new Date("2026-10-15T11:00:00Z");
const abo = (p: Partial<DonneesEtat>): DonneesEtat => ({ statut: "ESSAI", finEssai: null, finPeriode: null, delaiGraceJours: 15, accesProlongeJusquAu: null, ...p });

describe("dates", () => {
  it("jour calendaire à Casablanca, pas en UTC", () => {
    // 23:30 UTC le 15 = 00:30 le 16 à Casablanca (UTC+1)
    expect(jourCasablanca(new Date("2026-10-15T23:30:00Z"))).toBe("2026-10-16");
  });
  it("ajout de mois sans débordement (31 janvier + 1 mois = fin février)", () => {
    expect(ajouterMois("2027-01-31", 1)).toBe("2027-02-28");
    expect(ajouterMois("2026-10-16", 12)).toBe("2027-10-16");
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("etatAcces", () => {
  it("sans abonnement : accès normal (clients historiques)", () => {
    expect(etatAcces(null, MAINTENANT)).toMatchObject({ etat: "SANS_ABONNEMENT", niveau: "OK" });
  });

  it("essai : silencieux, puis rappel doux à J-7, échéance valable toute la journée", () => {
    expect(etatAcces(abo({ finEssai: "2026-11-10" }), MAINTENANT)).toMatchObject({ etat: "EN_ESSAI", niveau: "OK", jours_avant_echeance: 26 });
    expect(etatAcces(abo({ finEssai: "2026-10-22" }), MAINTENANT)).toMatchObject({ etat: "EN_ESSAI", niveau: "RAPPEL", jours_avant_echeance: 7 });
    expect(etatAcces(abo({ finEssai: "2026-10-15" }), MAINTENANT)).toMatchObject({ etat: "EN_ESSAI", niveau: "RAPPEL", jours_avant_echeance: 0 });
  });

  it("essai expiré : délai de grâce avec date de coupure, puis blocage", () => {
    const e = etatAcces(abo({ finEssai: "2026-10-10", delaiGraceJours: 7 }), MAINTENANT);
    expect(e).toMatchObject({ etat: "ESSAI_EXPIRE", niveau: "GRACE", date_blocage: "2026-10-17", jours_avant_blocage: 2 });
    expect(etatAcces(abo({ finEssai: "2026-10-01", delaiGraceJours: 7 }), MAINTENANT)).toMatchObject({ etat: "BLOQUE_IMPAYE", niveau: "BLOQUE" });
  });

  it("actif : à jour, renouvellement proche (opérateur à 30 j, client à 14 j), en retard", () => {
    expect(etatAcces(abo({ statut: "ACTIF", finPeriode: "2027-06-30" }), MAINTENANT)).toMatchObject({ etat: "A_JOUR", niveau: "OK" });
    expect(etatAcces(abo({ statut: "ACTIF", finPeriode: "2026-11-10" }), MAINTENANT)).toMatchObject({ etat: "RENOUVELLEMENT_PROCHE", niveau: "OK" });
    expect(etatAcces(abo({ statut: "ACTIF", finPeriode: "2026-10-25" }), MAINTENANT)).toMatchObject({ etat: "RENOUVELLEMENT_PROCHE", niveau: "RAPPEL" });
    expect(etatAcces(abo({ statut: "ACTIF", finPeriode: "2026-10-14" }), MAINTENANT)).toMatchObject({ etat: "EN_RETARD", niveau: "GRACE", date_blocage: "2026-10-29" });
  });

  it("délai accordé (vote en AG) : l'accès reste ouvert jusqu'à la date, puis coupure", () => {
    const base = abo({ statut: "ACTIF", finPeriode: "2026-09-01", accesProlongeJusquAu: "2026-10-20" });
    expect(etatAcces(base, MAINTENANT)).toMatchObject({ etat: "ACCES_PROLONGE", niveau: "GRACE", date_blocage: "2026-10-20" });
    expect(etatAcces({ ...base, accesProlongeJusquAu: "2026-10-01" }, MAINTENANT)).toMatchObject({ niveau: "BLOQUE" });
  });

  it("suspension manuelle et résiliation : bloqué, même avec un délai accordé", () => {
    expect(etatAcces(abo({ statut: "SUSPENDU", finPeriode: "2027-01-01", accesProlongeJusquAu: "2027-01-01" }), MAINTENANT)).toMatchObject({ etat: "SUSPENDU", niveau: "BLOQUE" });
    expect(etatAcces(abo({ statut: "RESILIE" }), MAINTENANT)).toMatchObject({ etat: "RESILIE", niveau: "BLOQUE" });
  });
});

describe("calculerFacture", () => {
  it("syndicat Standard annuel, 48 lots × 9,90 TTC : TTC exact, HT + TVA = TTC", () => {
    const m = calculerFacture({ formule: "STANDARD", basePrix: "TTC", prixLot: "9.90", tauxTva: "20", minimumMensuel: "149.00", forfaitAccompagne: null, lots: 48, mois: 12, tarifFondateur: false });
    expect(m.montant_ttc).toBe("5702.40"); // 48 × 9,90 = 475,20 / mois × 12
    expect(m.montant_ht).toBe("4752.00");
    expect(m.montant_tva).toBe("950.40");
    expect(m.lignes).toHaveLength(1);
  });

  it("minimum de facturation appliqué aux petites résidences", () => {
    const m = calculerFacture({ formule: "ESSENTIEL", basePrix: "TTC", prixLot: "5.90", tauxTva: "20", minimumMensuel: "99.00", forfaitAccompagne: null, lots: 10, mois: 1, tarifFondateur: false });
    expect(m.montant_ttc).toBe("99.00");
    expect(m.lignes[0]!.libelle).toMatch(/minimum/);
  });

  it("cabinet HT : TVA ajoutée ; option Accompagné au prorata ; ligne libre", () => {
    const m = calculerFacture({ formule: "CABINET", basePrix: "HT", prixLot: "3.90", tauxTva: "20", minimumMensuel: "500.00", forfaitAccompagne: "3900.00", lots: 350, mois: 12, tarifFondateur: false, lignesSupplementaires: [{ libelle: "Mise en service", montant: "490.00" }] });
    // 350 × 3,90 = 1 365 HT/mois × 12 = 16 380 + 3 900 + 490 = 20 770 HT
    expect(m.montant_ht).toBe("20770.00");
    expect(m.montant_tva).toBe("4154.00");
    expect(m.montant_ttc).toBe("24924.00");
    expect(m.lignes).toHaveLength(3);
  });

  it("refuse une quantité invalide", () => {
    expect(() => calculerFacture({ formule: "STANDARD", basePrix: "TTC", prixLot: "9.90", tauxTva: "20", minimumMensuel: null, forfaitAccompagne: null, lots: 0, mois: 12, tarifFondateur: false })).toThrow();
  });
});

describe("tarifSuggere", () => {
  it("grille syndicat : catalogue, fondateur, majoration mensuelle", () => {
    expect(tarifSuggere({ formule: "STANDARD", lots: 48, periodicite: "ANNUELLE", fondateur: false })).toMatchObject({ prix_lot: "9.90", base_prix: "TTC", mensuel_estime: "475.20" });
    expect(tarifSuggere({ formule: "STANDARD", lots: 48, periodicite: "ANNUELLE", fondateur: true }).prix_lot).toBe("8.40");
    expect(tarifSuggere({ formule: "STANDARD", lots: 48, periodicite: "MENSUELLE", fondateur: false }).prix_lot).toBe("11.38"); // 11,385 → arrondi bancaire (lib/money)
  });
  it("cabinet : HT dégressif, jamais de remise fondateur", () => {
    expect(tarifSuggere({ formule: "CABINET", lots: 350, periodicite: "ANNUELLE", fondateur: true })).toMatchObject({ prix_lot: "3.90", base_prix: "HT", tarif_fondateur: false });
    expect(tarifSuggere({ formule: "CABINET", lots: 1200, periodicite: "ANNUELLE", fondateur: false }).prix_lot).toBe("3.20");
    expect(tarifSuggere({ formule: "CABINET", lots: 3000, periodicite: "ANNUELLE", fondateur: false }).prix_lot).toBe("2.60");
  });
});

describe("rappelsDus", () => {
  const id = "0192a000-0000-7000-8000-000000000001";
  it("essai : un seul palier à la fois, clé stable par échéance", () => {
    const r = rappelsDus({ abonnementId: id, statut: "ESSAI", etat: etatAcces(abo({ finEssai: "2026-10-20" }), MAINTENANT), residences: ["Les Jasmins"] });
    expect(r).toHaveLength(1);
    expect(r[0]!.cle).toBe(`rappel:${id}:essai:2026-10-20:j7`);
    expect(r[0]!.corps).toMatch(/Les Jasmins/);
  });
  it("essai à J-1 : le rappel de la veille part (et prévient l'opérateur), pas celui de J-7", () => {
    const r = rappelsDus({ abonnementId: id, statut: "ESSAI", etat: etatAcces(abo({ finEssai: "2026-10-16" }), MAINTENANT), residences: [] });
    expect(r.map((x) => x.palier)).toEqual(["ESSAI_J1"]);
    expect(r[0]!.operateur).toBe(true);
  });
  it("grâce et blocage annoncés avec leur date ; rien pour un abonnement suspendu", () => {
    const grace = rappelsDus({ abonnementId: id, statut: "ACTIF", etat: etatAcces(abo({ statut: "ACTIF", finPeriode: "2026-10-10" }), MAINTENANT), residences: [] });
    expect(grace.map((x) => x.palier)).toEqual(["GRACE"]);
    const bloque = rappelsDus({ abonnementId: id, statut: "ACTIF", etat: etatAcces(abo({ statut: "ACTIF", finPeriode: "2026-09-01" }), MAINTENANT), residences: [] });
    expect(bloque.map((x) => x.palier)).toEqual(["BLOQUE"]);
    expect(rappelsDus({ abonnementId: id, statut: "SUSPENDU", etat: etatAcces(abo({ statut: "SUSPENDU" }), MAINTENANT), residences: [] })).toEqual([]);
  });
});

describe("routes libres d'une résidence bloquée", () => {
  it("laisse passer l'état d'abonnement, le profil, la version d'app — rien d'autre", () => {
    expect(routeLibre("/v1/abonnement")).toBe(true);
    expect(routeLibre("/v1/users/me")).toBe(true);
    expect(routeLibre("/v1/users/me/appareils")).toBe(true);
    expect(routeLibre("/v1/users/me/appareils/jeton-fcm")).toBe(true);
    expect(routeLibre("/v1/users/me/export")).toBe(true);
    // Rien qui lise les données de la résidence :
    expect(routeLibre("/v1/users/me/widget")).toBe(false);
    expect(routeLibre("/v1/users/me/appareils/activite")).toBe(false);
    expect(routeLibre("/v1/users/me/appareils/activite/0192")).toBe(false);
    expect(routeLibre("/v1/users/me/preferences-notification")).toBe(false);
    expect(routeLibre("/v1/app/version")).toBe(true);
    expect(routeLibre("/v1/lots")).toBe(false);
    expect(routeLibre("/v1/abonnements-pirate")).toBe(false);
    expect(routeLibre("/v1/users/meilleur")).toBe(false);
  });
});
