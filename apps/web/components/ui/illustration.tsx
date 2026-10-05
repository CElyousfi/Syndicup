"use client";

import { useState, type ReactNode } from "react";

/**
 * Emplacement d'illustration 2D (public/illustrations/<nom>.png, mêmes fichiers que le mobile).
 * L'image reste invisible tant qu'elle n'est pas chargée : si le fichier n'existe pas encore,
 * le repli dessiné s'affiche — jamais d'icône d'image cassée.
 */
export function Illustration({
  name,
  size = 160,
  fallback,
  className = "",
}: {
  name: string;
  size?: number;
  fallback?: ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "absent">("loading");
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {state !== "ok" ? <span className="absolute inset-0 flex items-center justify-center">{fallback}</span> : null}
      {state !== "absent" ? (
        <img
          src={`/illustrations/${name}.png`}
          alt=""
          width={size}
          height={size}
          onLoad={() => setState("ok")}
          onError={() => setState("absent")}
          className={`relative size-full object-contain transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}
    </span>
  );
}
