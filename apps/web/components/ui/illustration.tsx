"use client";

import { useRef, useState, type ReactNode } from "react";
import { useLottieArt } from "../../lib/feel/lottie-art";

/**
 * Illustration de marque (public/illustrations/<nom>.png + <nom>.json, mêmes fichiers que le
 * mobile). Vivante : quand elle apparaît, elle se construit (intro ≈ 1 s), puis respire
 * doucement quelques secondes avant de se poser (lib/feel/lottie-art).
 *
 *  - Premier rendu (serveur, hydratation) : l'image de repos, identique à la dernière image de
 *    l'intro — aucun saut quand l'animation prend le relais.
 *  - Montée côté client (navigation, modale, écran de succès) : l'image reste cachée le temps
 *    de jouer l'intro (700 ms au plus, sinon l'image de repos s'affiche).
 *  - Mouvement coupé (alive_v1, « Réduites », préférence système) : image de repos seule.
 *  - Fichier absent : le repli dessiné — jamais d'icône d'image cassée.
 */
export function Illustration({
  name,
  size = 160,
  fallback,
  className = "",
  idle = true,
}: {
  name: string;
  size?: number;
  fallback?: ReactNode;
  className?: string;
  /** Respiration après l'intro (désactivée pour les pictogrammes en grille). */
  idle?: boolean;
}) {
  const [png, setPng] = useState<"loading" | "ok" | "absent">("loading");
  const box = useRef<HTMLSpanElement>(null);
  const phase = useLottieArt(box, name, { idle: idle && !name.startsWith("quick-") });
  const showPng = png === "ok" && phase === "rest";
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {png === "absent" || (png === "loading" && phase === "rest") ? (
        <span className="absolute inset-0 flex items-center justify-center">{fallback}</span>
      ) : null}
      {png !== "absent" ? (
        <img
          src={`/illustrations/${name}.png`}
          alt=""
          width={size}
          height={size}
          ref={(img) => {
            // Image déjà en cache avant l'hydratation : onLoad ne repasse pas.
            if (img?.complete && img.naturalWidth > 0 && png === "loading") setPng("ok");
          }}
          onLoad={() => setPng("ok")}
          onError={() => setPng("absent")}
          className={`relative size-full object-contain transition-opacity duration-300 ${showPng ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}
      <span ref={box} aria-hidden className={`pointer-events-none absolute inset-0 ${phase === "live" ? "" : "invisible"}`} />
    </span>
  );
}
