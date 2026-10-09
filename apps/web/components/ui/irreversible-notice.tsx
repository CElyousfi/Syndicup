import type { ReactNode } from "react";
/**
 * Bloc de confirmation d'action irréversible — obligatoire sur transfert, clôture d'AG,
 * activation de budget, anonymisation (brief §2.4). S'utilise DANS un <form action={…}> :
 * le parent gère l'ouverture ; ce bloc rappelle l'irréversibilité et porte les boutons.
 */
export function IrreversibleNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-danger/25 bg-danger-tint px-4 py-3 text-[13px] leading-relaxed text-ink-strong">
      {children}
    </div>
  );
}
