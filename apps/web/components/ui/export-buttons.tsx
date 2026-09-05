/**
 * Boutons d'export CSV / Excel (M18) — liens vers le relais /api/export qui délègue à l'API
 * (génération + journalisation export_log dans le périmètre RLS de l'appelant). Composant
 * serveur : aucune logique, uniquement des liens.
 */
import { IconDownload } from "./icons";

export function ExportButtons({
  ressource,
  filtres = {},
  labels,
  size = "md",
  className = "",
}: {
  ressource: "lots" | "paiements" | "incidents" | "depenses" | "grand-livre" | "impayes" | "proprietaires";
  filtres?: Record<string, string | undefined>;
  labels: { csv: string; xlsx: string; title?: string };
  size?: "sm" | "md";
  className?: string;
}) {
  const href = (format: "csv" | "xlsx") => {
    const qs = new URLSearchParams({ ressource, format });
    for (const [k, v] of Object.entries(filtres)) if (v) qs.set(k, v);
    return `/api/export?${qs.toString()}`;
  };
  const base = size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-10 px-3.5 text-[13px]";
  return (
    <div className={`inline-flex overflow-hidden rounded-btn border border-hairline-strong bg-surface ${className}`} title={labels.title}>
      <a href={href("csv")} className={`inline-flex items-center gap-1.5 ${base} font-medium text-ink-strong transition-colors hover:bg-hover`}>
        <IconDownload width={14} height={14} />
        {labels.csv}
      </a>
      <a href={href("xlsx")} className={`inline-flex items-center gap-1.5 border-s border-hairline-strong ${base} font-medium text-ink-strong transition-colors hover:bg-hover`}>
        {labels.xlsx}
      </a>
    </div>
  );
}
