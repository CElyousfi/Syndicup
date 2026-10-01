"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

/**
 * <img> qui apparaît en fondu (et léger dézoom) une fois réellement chargé, au lieu de se
 * peindre ligne à ligne. Une image déjà en cache (chargée avant l'hydratation) est montrée
 * immédiatement — jamais d'image bloquée invisible.
 */
export function FadeImg({ className = "", alt = "", onLoad, ...props }: ComponentProps<"img">) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <img
      ref={ref}
      alt={alt}
      decoding="async"
      {...props}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={() => setLoaded(true)}
      data-loaded={loaded ? "" : undefined}
      className={`fade-img ${className}`}
    />
  );
}
