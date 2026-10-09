"use client";

import { useRef, useState } from "react";
import { useLottieArt } from "../../lib/feel/lottie-art";

/**
 * Affiche animée (public/illustrations/poster-*.png + .json, 1600×1000, art à droite) cadrée
 * « cover » sur son extrémité — miroitée en arabe pour libérer le côté du texte. Le cadrage de
 * l'animation (xMaxYMid slice) est exactement celui de l'image (object-cover object-right).
 * Le conteneur porte la taille et la position (className) ; il doit être positionné.
 */
export function PosterArt({ name, className = "", ratio = false }: { name: string; className?: string; ratio?: boolean }) {
  const [ok, setOk] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const phase = useLottieArt(box, name, { fit: "cover-end" });
  return (
    <span aria-hidden className={`overflow-hidden ${ratio ? "aspect-[8/5]" : ""} ${className}`}>
      <img
        src={`/illustrations/${name}.png`}
        alt=""
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0 && !ok) setOk(true);
        }}
        onLoad={() => setOk(true)}
        className={`absolute inset-0 size-full object-cover object-right transition-opacity rtl:-scale-x-100 duration-300 ${ok && phase === "rest" ? "opacity-100" : "opacity-0"}`}
      />
      <span ref={box} className={`pointer-events-none absolute inset-0 rtl:-scale-x-100 ${phase === "live" ? "" : "invisible"}`} />
    </span>
  );
}
