import Link from "next/link";
import type { ReactNode } from "react";
import { TabIndicator } from "./motion/tab-indicator";

/** Onglets de navigation (fiche lot, détail AG…) — rendus serveur, état dans l'URL.
 *  Le soulignement actif glisse d'un onglet à l'autre (îlot client <TabIndicator>). */
export function LinkTabs({
  tabs,
  className = "",
}: {
  tabs: Array<{ href: string; label: ReactNode; active: boolean; count?: number }>;
  className?: string;
}) {
  return (
    <nav className={`relative flex gap-1 overflow-x-auto border-b border-hairline scroll-thin ${className}`}>
      {tabs.map((tab, i) => (
        <Link
          key={i}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`relative whitespace-nowrap px-3.5 pb-3 pt-1 text-sm font-medium transition-colors ${
            tab.active ? "text-ink" : "text-soft hover:text-ink-strong"
          }`}
        >
          {tab.label}
          {typeof tab.count === "number" ? (
            <span className="ms-1.5 rounded-full bg-ground px-1.5 py-0.5 text-[11px] text-soft">
              {tab.count}
            </span>
          ) : null}
          {tab.active ? (
            <span className="tab-static absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-action" />
          ) : null}
        </Link>
      ))}
      {tabs.some((t) => t.active) ? <TabIndicator index={tabs.findIndex((t) => t.active)} /> : null}
    </nav>
  );
}
