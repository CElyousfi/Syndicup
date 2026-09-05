/**
 * Données de référence d'un formulaire de dépense (serveur) : postes du budget ACTIF de
 * l'exercice, fournisseurs actifs, résolutions d'AG ADOPTEE (décaissement de réserve), TVA par défaut.
 */
import { cache } from "react";
import { apiFetch } from "../../../../../lib/api/client";
import type { AssembleeGenerale, BudgetAg, BudgetPoste, Copropriete, Prestataire } from "../../../../../lib/api/types";
import { formatDate } from "../../../../../lib/format";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { OptionRef } from "./depense-form";

export const referencesDepense = cache(async (dict: Dict, locale: Locale, coproprieteId: string | null, exercice: string) => {
  const [budgetsRes, prestatairesRes, agsRes, coproRes] = await Promise.all([
    apiFetch<BudgetAg[]>("/finances/budgets", { searchParams: { limit: 50 } }),
    apiFetch<Prestataire[]>("/prestataires"),
    apiFetch<AssembleeGenerale[]>("/ag", { searchParams: { limit: 20 } }),
    coproprieteId ? apiFetch<Copropriete & { tvaParDefaut?: string | null }>(`/coproprietes/${coproprieteId}`) : Promise.resolve(null),
  ]);
  const budgets = budgetsRes.ok ? budgetsRes.data : [];
  const actif = budgets.find((b) => b.statut === "ACTIF" && b.exercice === exercice) ?? budgets.find((b) => b.statut === "ACTIF") ?? null;
  const postesRes = actif ? await apiFetch<{ postes: BudgetPoste[] }>(`/finances/budgets/${actif.id}/postes`) : null;
  const postes = postesRes?.ok ? postesRes.data.postes : [];
  const prestataires: OptionRef[] = (prestatairesRes.ok ? prestatairesRes.data : []).filter((p) => p.actif).map((p) => ({ id: p.id, libelle: `${p.nom} · ${p.specialite}` }));

  // Résolutions ADOPTEE des AG clôturées (détail par AG — au plus quelques appels).
  const ags = (agsRes.ok ? agsRes.data : []).filter((a) => a.statut === "CLOTUREE").slice(0, 6);
  const details = await Promise.all(ags.map((a) => apiFetch<AssembleeGenerale>(`/ag/${a.id}`)));
  const resolutions: OptionRef[] = details.flatMap((r, idx) =>
    r.ok
      ? (r.data.resolutions ?? [])
          .filter((res) => res.resultat === "ADOPTEE")
          .map((res) => ({ id: res.id, libelle: `${formatDate(ags[idx]!.dateAg, locale)} · ${res.texte.slice(0, 80)}` }))
      : []
  );
  const tvaDefaut = coproRes?.ok ? ((coproRes.data as { tvaParDefaut?: string | null }).tvaParDefaut ?? null) : null;
  return { budgetActif: actif, postes, prestataires, resolutions, tvaDefaut: tvaDefaut ? String(Number(tvaDefaut)) : null };
});
