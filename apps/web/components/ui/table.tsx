"use client";

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

/** Conteneur DataTable (Wise : la liste repose à plat sur la toile, en-tête en bandeau greige) ;
 *  défilement horizontal interne (jamais la page). Dans une tuile greige, les lignes restent
 *  lisibles : séparateurs et survol sont des voiles d'encre. */
export function TableCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`su-table-wrap min-w-0 overflow-hidden ${className}`}>
      <div className="overflow-x-auto scroll-thin">{children}</div>
    </div>
  );
}

/**
 * Table : desktop = vraie table ; mobile (< md) = liste de cartes, chaque cellule devenant
 * une ligne « libellé · valeur » (libellés recopiés depuis l'en-tête dans `data-label`).
 * Le premier champ fait office de titre, la cellule d'actions garde ses boutons à l'extrémité.
 */
export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const annoter = () => {
      const labels = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(
        (th) => th.textContent?.trim() ?? ""
      );
      table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
        let col = 0;
        Array.from(tr.cells).forEach((td) => {
          td.dataset.label = labels[col] ?? "";
          if (td.classList.contains("text-end")) td.dataset.end = "";
          col += td.colSpan || 1;
        });
      });
    };
    annoter();
    const mo = new MutationObserver(annoter);
    mo.observe(table, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return (
    <table ref={ref} className={`su-table stagger-rows w-full text-sm ${className}`}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="text-[12px] font-semibold text-soft">
        {children}
      </tr>
    </thead>
  );
}

export function TH({
  children,
  align = "start",
  className = "",
}: {
  children?: ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
}) {
  const alignCls = align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start";
  return <th className={`bg-tile px-4 py-3 font-semibold ${alignCls} ${className}`}>{children}</th>;
}

export function TR({
  children,
  className = "",
  ...props
}: ComponentProps<"tr"> & { children: ReactNode }) {
  return (
    <tr
      className={`border-b border-wash-strong last:border-b-0 transition-colors hover:bg-wash ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = "start",
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
  colSpan?: number;
}) {
  const alignCls = align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start";
  return (
    <td colSpan={colSpan} className={`px-4 py-3.5 align-middle ${alignCls} ${className}`}>
      {children}
    </td>
  );
}
