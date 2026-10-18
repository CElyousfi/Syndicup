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
import { failureOf, unwrap, type LoadFailure, type Loaded } from "../../../../../lib/api/unwrap";

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
}> {
  const [lotsRes, synthese] = await Promise.all([getLotsResult(), getSynthese()]);
  const lots = lotsRes.ok ? lotsRes.data : [];
  const lignes: LigneOption[] = [];
  if (synthese.ok) {
    const ctxLignes = contexteLignes(synthese.data);
    for (const l of synthese.data.lignes) {
      if (l.statut === "PAYE") continue;
      lignes.push({ id: l.id, lotId: l.lotId, periode: ctxLignes.get(l.id)?.periode ?? "", restant: versChaine(versCentimes(l.montantDu) - versCentimes(l.montantPaye)) });
    }
  }
  const erreur = !lotsRes.ok ? lotsRes.error : !synthese.ok ? synthese.error : null;
  return { lots: lots.map((l) => ({ id: l.id, numero: l.numero })), lignes, lotsComplets: lots, erreur };
}

export async function justificatifs(statut?: string): Promise<{
  rows: Justificatif[];
  parStatut: Record<string, { nb: number; montant: string }>;
  erreur: LoadFailure | null;
}> {
  const r = await apiFetch<Justificatif[]>("/finances/justificatifs", { searchParams: { statut, limit: 100 } });
  if (!r.ok) return { rows: [], parStatut: {}, erreur: failureOf(r) };
  return { rows: r.data, parStatut: (r.meta as { par_statut?: Record<string, { nb: number; montant: string }> }).par_statut ?? {}, erreur: null };
}

/**
 * Soldes par lot. Un seul appel en échec rend le TOTAL indisponible : on ne somme jamais des
 * soldes partiels (le résident croirait devoir moins que la réalité).
 */
export async function soldesLots(lots: LotOption[]): Promise<{ soldes: Map<string, SoldeLot>; erreur: LoadFailure | null }> {
  const res = await Promise.all(lots.map((l) => apiFetch<SoldeLot>(`/finances/lots/${l.id}/solde`)));
  const soldes = new Map<string, SoldeLot>();
  let erreur: LoadFailure | null = null;
  res.forEach((r, i) => {
    if (r.ok) soldes.set(lots[i]!.id, r.data);
    else erreur ??= failureOf(r);
  });
  return { soldes, erreur };
}
