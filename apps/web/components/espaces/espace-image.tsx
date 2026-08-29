/**
 * Illustration d'un espace commun — image choisie par mots-clés du nom/type (le champ
 * `type` est libre côté produit). Toujours décorative (alt vide) : l'information reste
 * portée par le texte de la carte. Repli : la cour de la résidence.
 */
import Image from "next/image";

const IMAGES: Array<{ motifs: RegExp; src: string }> = [
  { motifs: /piscine|pool|natation|مسبح/i, src: "/images/espace-piscine.jpg" },
  { motifs: /salle|f[eê]te|r[eé]union|r[eé]ception|قاعة/i, src: "/images/espace-salle.jpg" },
  { motifs: /jardin|espace vert|parc|cour|حديقة/i, src: "/images/residence-courtyard.jpg" },
  { motifs: /terrasse|toit|rooftop|سطح/i, src: "/images/residence-courtyard.jpg" },
];

export function espaceImageSrc(nom: string, type: string): string {
  const texte = `${nom} ${type}`;
  return IMAGES.find((i) => i.motifs.test(texte))?.src ?? "/images/residence-entrance.jpg";
}

export function EspaceImage({
  nom,
  type,
  className = "",
}: {
  nom: string;
  type: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={espaceImageSrc(nom, type)}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 33vw"
        className="object-cover transition-transform duration-500 hover:scale-105"
      />
    </div>
  );
}
