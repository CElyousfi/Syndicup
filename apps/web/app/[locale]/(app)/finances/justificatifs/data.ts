/**
 * Chargements partagés des écrans Justificatifs (serveur). Chaque chargement financier dit
 * s'il a ÉCHOUÉ (`indisponible` / `Loaded`) : un solde qu'on n'a pas pu lire n'est jamais
 * présenté comme « 0 MAD — à jour ».
 */
import { apiFetch } from "../../../../../lib/api/client";
import type { CompteBancaire, Justificatif, Lot, SoldeLot } from "../../../../../lib/api/types";
import type { LigneOption, LotOption } from "./declarer-form";
import { contexteLignes, getLotsResult, getSynthese } from "../../../../../lib/finances-data";
import { versChaine, versCentimes } from "../../../../../lib/centimes";
import { failureOf, isRefused, unwrap, type LoadFailure, type Loaded } from "../../../../../lib/api/unwrap";

export async function comptesBancaires(coproprieteId: string | null): Promise<Loaded<CompteBancaire[]>> {
  if (!coproprieteId) return { ok: true, data: [] };
  return unwrap(await apiFetch<CompteBancaire[]>(`/coproprietes/${coproprieteId}/comptes-bancaires`));
}

/** Lots visibles de l'appelant (RLS) + échéances ouvertes par lot (période, restant). */
export async function lotsEtLignesOuvertes(): Promise<{
  lots: LotOption[];
  lignes: LigneOption[];
  lotsComplets: Lot[];
  /** Premier chargement en échec (lots ou synthèse) — l'écran affiche alors <LoadError>. */
  erreur: LoadFailure | null;
  /** Lots refusés PAR CONCEPTION (403 : rôle sans lots.lire) — l'écran masque ce qui en dépend. */
  lotsRefuses: boolean;
}> {
  const [lotsRes, synthese] = await Promise.all([getLotsResult(), getSynthese()]);
  const lots = lotsRes.ok ? lotsRes.data : [];
  const lignes: LigneOption[] = [];
  // Synthèse refusée par conception (403 : locataire, gardien — pas de
  // finances.lister_appels_de_fonds) : pas d'échéances proposées, ce n'est PAS une panne.
  const syntheseRefusee = !synthese.ok && synthese.error.status === 403;
  const lotsRefuses = !lotsRes.ok && lotsRes.error.status === 403;
  if (synthese.ok) {
    const ctxLignes = contexteLignes(synthese.data);
    for (const l of synthese.data.lignes) {
      if (l.statut === "PAYE") continue;
      lignes.push({ id: l.id, lotId: l.lotId, periode: ctxLignes.get(l.id)?.periode ?? "", restant: versChaine(versCentimes(l.montantDu) - versCentimes(l.montantPaye)) });
    }
  }
  const erreur = !lotsRes.ok && !lotsRefuses ? lotsRes.error : !synthese.ok && !syntheseRefusee ? synthese.error : null;
  return { lots: lots.map((l) => ({ id: l.id, numero: l.numero })), lignes, lotsComplets: lots, erreur, lotsRefuses };
}

export async function justificatifs(statut?: string): Promise<{
  rows: Justificatif[];
  parStatut: Record<string, { nb: number; montant: string }>;
  erreur: LoadFailure | null;
  /** 403 par conception (rôle sans justificatifs.lire) : section masquée. */
  refuse: boolean;
}> {
  const r = await apiFetch<Justificatif[]>("/finances/justificatifs", { searchParams: { statut, limit: 100 } });
  if (!r.ok) return { rows: [], parStatut: {}, erreur: isRefused(r) ? null : failureOf(r), refuse: isRefused(r) };
  return { rows: r.data, parStatut: (r.meta as { par_statut?: Record<string, { nb: number; montant: string }> }).par_statut ?? {}, erreur: null, refuse: false };
}

/**
 * Soldes par lot. Un seul appel en échec rend le TOTAL indisponible : on ne somme jamais des
 * soldes partiels (le résident croirait devoir moins que la réalité).
 */
export async function soldesLots(lots: LotOption[]): Promise<{ soldes: Map<string, SoldeLot>; erreur: LoadFailure | null; refuse: boolean }> {
  const res = await Promise.all(lots.map((l) => apiFetch<SoldeLot>(`/finances/lots/${l.id}/solde`)));
  const soldes = new Map<string, SoldeLot>();
  let erreur: LoadFailure | null = null;
  let refus = 0;
  res.forEach((r, i) => {
    if (r.ok) soldes.set(lots[i]!.id, r.data);
    else if (isRefused(r)) refus++;
    else erreur ??= failureOf(r);
  });
  // Tous refusés (rôle sans finances.voir_solde_lot) : le solde ne concerne pas ce rôle.
  // Refus partiel : le total serait incomplet → indisponible plutôt qu'un total faux.
  const refuse = res.length > 0 && refus === res.length;
  if (!erreur && refus > 0 && !refuse) {
    const premier = res.find((r) => !r.ok && isRefused(r));
    if (premier && !premier.ok) erreur = failureOf(premier);
  }
  return { soldes, erreur, refuse };
}
