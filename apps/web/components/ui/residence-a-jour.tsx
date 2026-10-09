"use client";

import { useEffect, useState } from "react";
import { unePremiereFois } from "../../lib/signature";
import { hapticLazy } from "../../lib/feel/haptic-lazy";

/**
 * Moment signature 6 — la résidence est 100 % à jour : anneau plein et halo RETENU, joué une seule
 * fois par mois et par résidence sur cet appareil ; ensuite l'anneau reste plein, immobile.
 */
export function ResidenceAJour({ coproId, label }: { coproId: string; label: string }) {
  const [halo, setHalo] = useState(false);
  useEffect(() => {
    const d = new Date();
    const periode = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (document.documentElement.dataset.alive !== "0" && unePremiereFois(`residence-a-jour:${coproId}:${periode}`)) {
      setHalo(true);
      hapticLazy("success");
    }
  }, [coproId]);
  return (
    <div className="card mb-5 flex items-center gap-4 p-5">
      <span className={`relative grid size-12 shrink-0 place-items-center rounded-full ${halo ? "ring-glow" : ""}`}>
        <svg viewBox="0 0 48 48" className="size-12 -rotate-90 rtl:scale-x-[-1]" aria-hidden>
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-wash-strong)" strokeWidth="5" />
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-ok)" strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray="1" className="ring-draw" />
        </svg>
        <svg viewBox="0 0 24 24" className="absolute size-5 text-ok" aria-hidden fill="currentColor">
          <path d="m23 12-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69zm-12.91 4.72-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48z" />
        </svg>
      </span>
      <p className="text-[16px] font-semibold text-ink">{label}</p>
    </div>
  );
}
