/**
 * Photos de la résidence (M20) — emplacements personnalisables par le syndic, image du produit
 * par défaut sinon. Pure fonction : utilisable en Server Components comme côté client.
 *   accueil  → carte héro des tableaux de bord
 *   entree   → lots, gardien, invitation
 *   cour     → documents, choix de copropriété
 *   salle    → assemblées générales, espace « salle »
 *   piscine  → espace « piscine »
 *   espace:<id> → photo propre à un espace commun
 */
import type { Copropriete } from "./api/types";

export const CLES_PHOTO = ["accueil", "entree", "cour", "salle", "piscine"] as const;
export type ClePhoto = (typeof CLES_PHOTO)[number];

export const PHOTOS_DEFAUT: Record<ClePhoto, string> = {
  accueil: "/images/residence-hero.jpg",
  entree: "/images/residence-entrance.jpg",
  cour: "/images/residence-courtyard.jpg",
  salle: "/images/espace-salle.jpg",
  piscine: "/images/espace-piscine.jpg",
};

type CoproPhotos = Pick<Copropriete, "id" | "photosJson"> | null | undefined;

/** Chemin storage personnalisé pour un emplacement, ou null. */
export function photoPersonnalisee(copro: CoproPhotos, cle: string): string | null {
  const chemin = copro?.photosJson?.[cle];
  return typeof chemin === "string" && chemin.length > 0 ? chemin : null;
}

/** URL à afficher : proxy même-origine si personnalisée, sinon l'image par défaut (ou `fallback`). */
export function photoSrc(copro: CoproPhotos, cle: string, fallback?: string): string {
  const chemin = photoPersonnalisee(copro, cle);
  if (chemin && copro) {
    return `/api/copro-photo?id=${copro.id}&cle=${encodeURIComponent(cle)}&v=${encodeURIComponent(chemin)}`;
  }
  return fallback ?? PHOTOS_DEFAUT[(cle in PHOTOS_DEFAUT ? cle : "entree") as ClePhoto];
}
