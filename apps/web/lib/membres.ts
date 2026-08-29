/**
 * Annuaire léger des membres connus du tenant — reconstruit depuis les rattachements des lots
 * (l'API n'expose pas de liste d'utilisateurs). Sert aux sélecteurs (payeur, mandataire,
 * propriétaire à rattacher…). Les personnes jamais rattachées restent saisissables par UUID.
 */
import { getLots } from "./finances-data";
import { nomComplet } from "./format";

export interface MembreOption {
  id: string;
  nom: string;
  /** Lots où la personne apparaît (contexte d'affichage). */
  lots: string[];
}

export async function annuaireMembres(): Promise<MembreOption[]> {
  const lots = await getLots();
  const parId = new Map<string, MembreOption>();
  for (const lot of lots) {
    const rattaches = [...(lot.proprietaires ?? []), ...(lot.occupants ?? [])];
    for (const r of rattaches) {
      const nom = nomComplet(r.utilisateur) ?? r.utilisateurId.slice(0, 8);
      const existant = parId.get(r.utilisateurId);
      if (existant) {
        if (!existant.lots.includes(lot.numero)) existant.lots.push(lot.numero);
      } else {
        parId.set(r.utilisateurId, { id: r.utilisateurId, nom, lots: [lot.numero] });
      }
    }
  }
  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}
