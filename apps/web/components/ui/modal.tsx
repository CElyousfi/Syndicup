"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { IconX } from "./icons";

/**
 * Modale accessible sur <dialog> natif : Échap, clic sur le fond, focus piégé par le navigateur.
 * Contrôlée par le parent (open/onClose) pour se marier avec useActionState.
 * Sur mobile (< md) elle devient une feuille qui monte du bas — poignée, coins hauts arrondis,
 * pleine largeur, contenu défilant, zone sûre respectée (voir `.su-modal` dans globals.css).
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
  closeLabel = "Fermer",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onBackdrop = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === ref.current) onClose();
    },
    [onClose]
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={onBackdrop}
      className={`su-modal m-auto w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-card bg-surface p-0 text-ink-strong shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[3px] open:animate-in-up`}
    >
      <div className="sheet-handle md:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4 md:px-6">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-ink md:text-[15px]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] text-soft">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ground text-soft transition-colors hover:text-ink md:size-8 md:bg-transparent md:hover:bg-ground"
        >
          <IconX width={18} height={18} />
        </button>
      </div>
      <div className="su-modal-body px-5 py-5 md:px-6">{children}</div>
    </dialog>
  );
}

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
