"use client";

import { Badge } from "../../../../../../components/ui/badge";
import type { Dict } from "../../../../../../lib/i18n";
import type { AgResolution } from "../../../../../../lib/api/types";
import { resolutionVariant } from "../../../../../../lib/status";

/**
 * Salle de séance (Wise, salle de marque verte) — la résolution courante en lettres d'affiche
 * lime, l'ordre du jour en segments (courante = blanc, finalisée = lime), navigation ronde.
 * Équivalent web de la carte de tête de `ag_seance_screen.dart`.
 */
export function SalleSeance({
  dict,
  resolutions,
  index,
  onPrev,
  onNext,
  onSelect,
}: {
  dict: Dict;
  resolutions: AgResolution[];
  index: number;
  onPrev?: () => void;
  onNext?: () => void;
  onSelect?: (i: number) => void;
}) {
  const a = dict.ag;
  const r = resolutions[index];
  if (!r) return null;
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-brand p-6 text-white sm:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="warn" pulse>
          {dict.enums.statutAg.EN_COURS}
        </Badge>
        <Badge variant={r.resultat === "EN_ATTENTE" ? "outline" : resolutionVariant[r.resultat]}>
          {dict.enums.resultatResolution[r.resultat]}
        </Badge>
      </div>

      <p className="font-poster mt-6 text-[40px] text-lime sm:text-[56px] [:root[lang=ar]_&]:text-[32px] sm:[:root[lang=ar]_&]:text-[44px]">
        {a.resolution} <span className="tnum">{r.ordre}</span>
      </p>

      <p className="mt-4 max-w-3xl text-[17px] font-semibold leading-relaxed text-white sm:text-[20px]">
        {r.texte}
      </p>
      <p className="mt-2 text-[13px] text-white/75 sm:text-[14px]">
        {dict.enums.typeMajorite[r.typeMajorite]} — {dict.enums.typeMajoriteAide[r.typeMajorite]}
      </p>

      {/* Ordre du jour : un segment par résolution. */}
      <div className="mt-7 flex gap-1" aria-hidden>
        {resolutions.map((x, k) => {
          const cls =
            k === index ? "bg-white" : x.resultat !== "EN_ATTENTE" ? "bg-lime" : "bg-white/20";
          return onSelect ? (
            <button
              key={x.id}
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(k)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${cls}`}
            />
          ) : (
            <span key={x.id} className={`h-1.5 flex-1 rounded-full transition-colors ${cls}`} />
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <NavRond label={a.resolutionPrecedente} onClick={onPrev} sens="prev" />
        <span className="tnum flex-1 text-center text-[15px] font-semibold text-white" dir="ltr">
          {index + 1} / {resolutions.length}
        </span>
        <NavRond label={a.resolutionSuivante} onClick={onNext} sens="next" />
      </div>
    </section>
  );
}

function NavRond({ label, onClick, sens }: { label: string; onClick?: () => void; sens: "prev" | "next" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      title={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:bg-white/5 disabled:text-white/30"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="icon-flip"
        aria-hidden
      >
        {sens === "prev" ? <path d="M19 12H5M11 5l-7 7 7 7" /> : <path d="M5 12h14M13 5l7 7-7 7" />}
      </svg>
    </button>
  );
}
