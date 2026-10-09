"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Badges de statut — pills pleines (rayon 999) : fond couleur franche, texte blanc
 * (ou encre sur fond clair) — jamais de texte coloré sur teinte. Les statuts sont
 * OMNIPRÉSENTS dans le produit et doivent se lire d'un coup d'œil. Variantes :
 *  ok/warn/danger pleins · info (tosca profond) · ink (encre, chiffres mono — escalade N1→N6) ·
 *  neutral (voile d'encre, lisible sur blanc et sur tuile greige, texte encre) · outline (liseré discret, texte encre).
 */
export type BadgeVariant = "ok" | "warn" | "danger" | "info" | "ink" | "neutral" | "outline";

const STYLES: Record<BadgeVariant, string> = {
  ok: "bg-ok text-white",
  warn: "bg-warn text-white",
  danger: "bg-danger text-white",
  info: "bg-tosca-deep text-white",
  ink: "bg-ink text-white font-mono tracking-tight",
  neutral: "bg-wash-strong text-ink",
  outline: "border border-hairline-strong text-ink bg-surface",
};

export function Badge({
  variant = "neutral",
  children,
  className = "",
  pulse = false,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}) {
  // Vivant : quand le statut CHANGE (actualisation live), la pastille éclot en ressort et le
  // point « en cours » pulse UNE fois — jamais de boucle (motion.css `.pulse-halo`).
  const sig = `${variant}|${typeof children === "string" || typeof children === "number" ? children : ""}`;
  const prev = useRef(sig);
  const [pop, setPop] = useState(0);
  useEffect(() => {
    if (prev.current === sig) return;
    prev.current = sig;
    setPop((n) => n + 1);
  }, [sig]);
  return (
    <span
      key={pop}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STYLES[variant]} ${pop ? "badge-pop" : ""} ${className}`}
    >
      {pulse ? <span className="pulse-halo size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
