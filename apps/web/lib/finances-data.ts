/**
 * Lecture financière mutualisée — UN appel `GET /finances/synthese` par requête (React.cache),
 * partagé entre layout/pages/composants. Toutes les dérivations sont de l'affichage pur en
 * centimes BigInt (jamais de float, jamais d'écriture).
 */
import { cache } from "react";
import { apiFetch } from "./api/client";
import type { AppelDeFonds, AppelDeFondsLigne, Lot } from "./api/types";
import { ratio, sommeCentimes, versCentimes, versChaine } from "./centimes";

export interface SyntheseFinanciere {
  appels: AppelDeFonds[];
  lignes: AppelDeFondsLigne[];
}

export const getSynthese = cache(async (): Promise<SyntheseFinanciere> => {
  const res = await apiFetch<SyntheseFinanciere>("/finances/synthese");
  return res.ok ? res.data : { appels: [], lignes: [] };
});

/** Lots (limite 100) mutualisés par requête — évite les doubles fetchs page + annuaire. */
export const getLots = cache(async (): Promise<Lot[]> => {
  const res = await apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } });
  return res.ok ? res.data : [];
});

// ── Dérivations d'affichage ────────────────────────────────────────────────

export function totauxParAppel(s: SyntheseFinanciere) {
  const parAppel = new Map<string, { du: bigint; paye: bigint; ratio: number }>();
  for (const a of s.appels) parAppel.set(a.id, { du: 0n, paye: 0n, ratio: 0 });
  for (const l of s.lignes) {
    const t = parAppel.get(l.appelDeFondsId);
    if (!t) continue;
    t.du += versCentimes(l.montantDu);
    t.paye += versCentimes(l.montantPaye);
  }
  for (const t of parAppel.values()) t.ratio = ratio(t.paye, t.du);
  return parAppel;
}

export function soldeParLot(s: SyntheseFinanciere) {
  const parLot = new Map<string, bigint>();
  for (const l of s.lignes) {
    parLot.set(
      l.lotId,
      (parLot.get(l.lotId) ?? 0n) + versCentimes(l.montantDu) - versCentimes(l.montantPaye)
    );
  }
  return parLot;
}

export function totauxGlobaux(s: SyntheseFinanciere) {
  const du = sommeCentimes(s.lignes.map((l) => l.montantDu));
  const paye = sommeCentimes(s.lignes.map((l) => l.montantPaye));
  return { du, paye, impaye: du - paye, taux: ratio(paye, du) };
}

export function impayesParNiveau(s: SyntheseFinanciere) {
  const niveaux = ["N1", "N2", "N3", "N4", "N5", "N6"] as const;
  return niveaux
    .map((niveau) => {
      const concernees = s.lignes.filter(
        (l) => l.niveauEscalade === niveau && l.statut !== "PAYE"
      );
      return {
        niveau,
        count: concernees.length,
        montant:
          sommeCentimes(concernees.map((l) => l.montantDu)) -
          sommeCentimes(concernees.map((l) => l.montantPaye)),
      };
    })
    .filter((x) => x.count > 0);
}

/** ligne.id → contexte (période, type d'appel, escalade) pour libeller sans re-fetch. */
export function contexteLignes(s: SyntheseFinanciere) {
  const appelParId = new Map(s.appels.map((a) => [a.id, a]));
  const parLigne = new Map<
    string,
    { periode: string; type: AppelDeFonds["type"]; escalade: string; lotId: string }
  >();
  for (const l of s.lignes) {
    const a = appelParId.get(l.appelDeFondsId);
    if (!a) continue;
    parLigne.set(l.id, {
      periode: a.periode,
      type: a.type,
      escalade: l.niveauEscalade,
      lotId: l.lotId,
    });
  }
  return parLigne;
}

export { versChaine };
