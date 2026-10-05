/**
 * Boutons d'export CSV / Excel (M18) — liens vers le relais /api/export qui délègue à l'API
 * (génération + journalisation export_log dans le périmètre RLS de l'appelant). Composant
 * serveur : aucune logique, uniquement des liens. Wise : pill contour vert marque scindée
 * (CSV · Excel), comme un bouton secondaire.
 */
import { IconDownload } from "./icons";

export function ExportButtons({
  ressource,
  filtres = {},
  labels,
  size = "md",
  className = "",
}: {
  ressource: "lots" | "paiements" | "incidents" | "depenses" | "grand-livre" | "impayes" | "proprietaires" | "contrats" | "personnel" | "conges" | "annonces" | "taches" | "emplacements" | "portefeuille";
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
  const base = size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-11 px-4 text-[14px]";
  return (
    <div className={`inline-flex shrink-0 overflow-hidden rounded-btn border-[1.5px] border-link ${className}`} title={labels.title}>
      <a href={href("csv")} className={`inline-flex items-center justify-center gap-1.5 ${base} font-semibold text-link transition-colors hover:bg-action-wash`}>
        <IconDownload width={15} height={15} />
        {labels.csv}
      </a>
      <span aria-hidden className="my-2 w-[1.5px] bg-link/30" />
      <a href={href("xlsx")} className={`inline-flex items-center justify-center gap-1.5 ${base} font-semibold text-link transition-colors hover:bg-action-wash`}>
        {labels.xlsx}
      </a>
    </div>
  );
}
