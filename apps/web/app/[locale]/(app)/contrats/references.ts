/** Données de référence d'un formulaire de contrat : réutilise celles des dépenses (postes, fournisseurs, résolutions ADOPTEE) + seuil d'engagement AG. */
import { cache } from "react";
import { apiFetch } from "../../../../lib/api/client";
import type { Copropriete } from "../../../../lib/api/types";
import type { Dict, Locale } from "../../../../lib/i18n";
import { referencesDepense } from "../finances/depenses/references";

export const referencesContrat = cache(async (dict: Dict, locale: Locale, coproprieteId: string | null) => {
  const [refs, coproRes] = await Promise.all([
    referencesDepense(dict, locale, coproprieteId, String(new Date().getFullYear())),
    coproprieteId ? apiFetch<Copropriete & { seuilContratAg?: string | null }>(`/coproprietes/${coproprieteId}`) : Promise.resolve(null),
  ]);
  const seuilAg = coproRes?.ok ? ((coproRes.data as { seuilContratAg?: string | null }).seuilContratAg ?? null) : null;
  return { ...refs, seuilAg };
});
