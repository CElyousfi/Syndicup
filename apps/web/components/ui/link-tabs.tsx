import Link from "next/link";
import type { ReactNode } from "react";

/** Onglets de navigation (fiche lot, détail AG…) — rendus serveur, état dans l'URL. */
export function LinkTabs({
  tabs,
  className = "",
}: {
  tabs: Array<{ href: string; label: ReactNode; active: boolean; count?: number }>;
  className?: string;
}) {
  return (
    <nav className={`flex gap-1 overflow-x-auto border-b border-hairline scroll-thin ${className}`}>
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
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-action" />
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
