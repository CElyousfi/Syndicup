"use client";

/**
 * Dari — la mascotte de l'assistant SyndicUp (une maison-bulle avec son casque), animée.
 *
 * Boucles dessinées en AVIF transparent (repli WebP), image fixe en mouvement réduit — que
 * la préférence vienne du système ou du réglage « Animations réduites » de l'app
 * (`html[data-motion="reduced"]`). Mêmes fichiers que le site vitrine.
 */
import { useEffect, useState } from "react";

export type DariClip = "idle" | "wave" | "think" | "type" | "talk" | "head";

/** Planches : 388 × 360 pour le personnage entier, 296 × 272 pour la tête. */
const CLIP_SIZE: Record<DariClip, [number, number]> = {
  idle: [388, 360],
  wave: [388, 360],
  think: [388, 360],
  type: [388, 360],
  talk: [388, 360],
  head: [296, 272],
};

const src = (clip: DariClip, ext: "avif" | "webp" | "png") =>
  `/brand/dari/motion/dari-${clip}${ext === "png" ? "-poster.png" : `.${ext}`}`;

/** Charge d'avance les boucles d'un état à venir, pour qu'un changement ne clignote pas. */
export function preloadDari(clips: DariClip[]) {
  if (typeof window === "undefined") return;
  for (const c of clips) {
    const img = new window.Image();
    img.decoding = "async";
    img.src = src(c, "avif");
  }
}

function useReducedApp(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const lire = () => setReduit(root.dataset.motion === "reduced");
    lire();
    const obs = new MutationObserver(lire);
    obs.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    return () => obs.disconnect();
  }, []);
  return reduit;
}

export function DariMotion({
  clip,
  size = 120,
  eager = false,
  className = "",
  label,
}: {
  clip: DariClip;
  /** Largeur affichée, en pixels. */
  size?: number;
  eager?: boolean;
  className?: string;
  /** Texte alternatif ; sans libellé, Dari est décoratif. */
  label?: string;
}) {
  const [w, h] = CLIP_SIZE[clip];
  const fixe = useReducedApp();
  return (
    <span
      className={`relative inline-block shrink-0 select-none ${className}`}
      style={{ width: size, aspectRatio: `${w} / ${h}` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <picture key={`${clip}-${fixe}`} className="dari-swap absolute inset-0 block">
        {fixe ? null : <source media="(prefers-reduced-motion: reduce)" srcSet={src(clip, "png")} />}
        {fixe ? null : <source type="image/avif" srcSet={src(clip, "avif")} />}
        {/* alive:allow image animée transparente (AVIF/WebP + poster) — FadeImg ne gère pas <picture> */}
        <img
          src={fixe ? src(clip, "png") : src(clip, "webp")}
          alt=""
          width={w}
          height={h}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className="block h-full w-full"
        />
      </picture>
    </span>
  );
}

/** Dari en médaillon rond (tête), sur le vert de la marque — avatar des réponses. */
export function DariAvatar({ size = 32 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-brand"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <DariMotion clip="head" size={size * 0.92} className="translate-y-[12%]" />
    </span>
  );
}
