import { LinkTabs } from "../../../../components/ui/link-tabs";
import type { Dict, Locale } from "../../../../lib/i18n";

export type OngletRapports = "tableau" | "grandLivre" | "gestion" | "impayes" | "exports";
const HREFS: Record<OngletRapports, string> = { tableau: "/rapports", grandLivre: "/rapports/grand-livre", gestion: "/rapports/gestion", impayes: "/rapports/impayes", exports: "/rapports/exports" };

export function RapportsTabs({ dict, locale, active, exercice }: { dict: Dict; locale: Locale; active: OngletRapports; exercice?: string }) {
  const q = exercice ? `?exercice=${exercice}` : "";
  return <LinkTabs className="mb-5" tabs={(Object.keys(HREFS) as OngletRapports[]).map((o) => ({ href: `/${locale}${HREFS[o]}${o === "gestion" || o === "exports" ? "" : q}`, label: dict.rapports.onglets[o], active: o === active }))} />;
}

/** Sélecteur d'exercice (liens) — l'exercice courant et les quatre précédents. */
export function ExerciceLinks({ base, exercice, locale }: { base: string; exercice: string; locale: Locale }) {
  const courant = new Date().getFullYear();
  const annees = Array.from({ length: 5 }, (_, i) => String(courant - i));
  if (!annees.includes(exercice)) annees.push(exercice);
  return (
    <div className="inline-flex overflow-hidden rounded-btn border border-hairline-strong bg-surface">
      {annees.map((a) => (
        <a key={a} href={`/${locale}${base}?exercice=${a}`} className={`tnum px-3 py-1.5 text-[13px] font-medium transition-colors ${a === exercice ? "bg-ink text-white" : "text-ink-strong hover:bg-hover"}`}>{a}</a>
      ))}
    </div>
  );
}
