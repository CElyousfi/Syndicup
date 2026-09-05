/** Chargements partagés des écrans Justificatifs (serveur). */
import { apiFetch } from "../../../../../lib/api/client";
import type { CompteBancaire, Justificatif, Lot, SoldeLot } from "../../../../../lib/api/types";
import type { LigneOption, LotOption } from "./declarer-form";
import { contexteLignes, getLots, getSynthese } from "../../../../../lib/finances-data";
import { versChaine, versCentimes } from "../../../../../lib/centimes";

export async function comptesBancaires(coproprieteId: string | null): Promise<CompteBancaire[]> {
  if (!coproprieteId) return [];
  const r = await apiFetch<CompteBancaire[]>(`/coproprietes/${coproprieteId}/comptes-bancaires`);
  return r.ok ? r.data : [];
}

/** Lots visibles de l'appelant (RLS) + échéances ouvertes par lot (période, restant). */
export async function lotsEtLignesOuvertes(): Promise<{ lots: LotOption[]; lignes: LigneOption[]; lotsComplets: Lot[] }> {
  const [lots, synthese] = await Promise.all([getLots(), getSynthese()]);
  const ctxLignes = contexteLignes(synthese);
  const lignes: LigneOption[] = synthese.lignes
    .filter((l) => l.statut !== "PAYE")
    .map((l) => ({ id: l.id, lotId: l.lotId, periode: ctxLignes.get(l.id)?.periode ?? "", restant: versChaine(versCentimes(l.montantDu) - versCentimes(l.montantPaye)) }));
  return { lots: lots.map((l) => ({ id: l.id, numero: l.numero })), lignes, lotsComplets: lots };
}

export async function justificatifs(statut?: string): Promise<{ rows: Justificatif[]; parStatut: Record<string, { nb: number; montant: string }> }> {
  const r = await apiFetch<Justificatif[]>("/finances/justificatifs", { searchParams: { statut, limit: 100 } });
  return { rows: r.ok ? r.data : [], parStatut: r.ok ? ((r.meta as { par_statut?: Record<string, { nb: number; montant: string }> }).par_statut ?? {}) : {} };
}

export async function soldesLots(lots: LotOption[]): Promise<Map<string, SoldeLot>> {
  const res = await Promise.all(lots.map((l) => apiFetch<SoldeLot>(`/finances/lots/${l.id}/solde`)));
  return new Map(res.flatMap((r, i) => (r.ok ? [[lots[i]!.id, r.data] as const] : [])));
}
