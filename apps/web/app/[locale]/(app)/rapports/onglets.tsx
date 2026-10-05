import { LinkTabs } from "../../../../components/ui/link-tabs";
import type { Dict, Locale } from "../../../../lib/i18n";

export type OngletRapports = "tableau" | "grandLivre" | "gestion" | "impayes" | "exports";
const HREFS: Record<OngletRapports, string> = { tableau: "/rapports", grandLivre: "/rapports/grand-livre", gestion: "/rapports/gestion", impayes: "/rapports/impayes", exports: "/rapports/exports" };

export function RapportsTabs({ dict, locale, active, exercice }: { dict: Dict; locale: Locale; active: OngletRapports; exercice?: string }) {
  const q = exercice ? `?exercice=${exercice}` : "";
  return <LinkTabs className="mb-5" tabs={(Object.keys(HREFS) as OngletRapports[]).map((o) => ({ href: `/${locale}${HREFS[o]}${o === "gestion" || o === "exports" ? "" : q}`, label: dict.rapports.onglets[o], active: o === active }))} />;
}

/** Sélecteur d'exercice (liens) — l'exercice courant et les quatre précédents, en pills (Wise : actif lime). */
export function ExerciceLinks({ base, exercice, locale }: { base: string; exercice: string; locale: Locale }) {
  const courant = new Date().getFullYear();
  const annees = Array.from({ length: 5 }, (_, i) => String(courant - i));
  if (!annees.includes(exercice)) annees.push(exercice);
  return (
    <div className="flex flex-wrap gap-1.5">
      {annees.map((a) => (
        <a key={a} href={`/${locale}${base}?exercice=${a}`} aria-current={a === exercice ? "page" : undefined} className={`tnum inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[14px] font-semibold transition-colors ${a === exercice ? "border-cta bg-cta text-ink" : "border-hairline-strong bg-surface text-ink-strong hover:bg-wash"}`}>{a}</a>
      ))}
    </div>
  );
}
