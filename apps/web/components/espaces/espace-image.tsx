/**
 * Illustration d'un espace commun — photo propre à l'espace si le syndic l'a personnalisée
 * (`espace:<id>`), sinon l'emplacement déduit des mots-clés du nom/type (le champ `type` est
 * libre côté produit), lui-même personnalisable. Toujours décorative (alt vide) : l'information
 * reste portée par le texte de la carte. Repli : l'entrée de la résidence.
 */
import type { ClePhoto } from "../../lib/photos";

const CLES: Array<{ motifs: RegExp; cle: ClePhoto }> = [
  { motifs: /piscine|pool|natation|مسبح/i, cle: "piscine" },
  { motifs: /salle|f[eê]te|r[eé]union|r[eé]ception|قاعة/i, cle: "salle" },
  { motifs: /jardin|espace vert|parc|cour|حديقة/i, cle: "cour" },
  { motifs: /terrasse|toit|rooftop|سطح/i, cle: "cour" },
];

/** Emplacement photo par défaut d'un espace (mots-clés du nom/type). */
export function espaceImageCle(nom: string, type: string): ClePhoto {
  const texte = `${nom} ${type}`;
  return CLES.find((i) => i.motifs.test(texte))?.cle ?? "entree";
}

export function EspaceImage({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={src} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
    </div>
  );
}
