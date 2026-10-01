"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { IconX } from "./icons";

/** Durée de la sortie animée (doit couvrir la transition de `dialog.su-modal[data-closing]`). */
const SORTIE_MS = 240;

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

  // Fermeture animée partout : la boîte joue sa sortie (`data-closing`, motion.css) PUIS se
  // ferme. Sans ce relais, Firefox et Safari la retirent de la couche supérieure d'un coup.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      dialog.removeAttribute("data-closing");
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      return;
    }
    dialog.setAttribute("data-closing", "");
    const t = window.setTimeout(() => {
      dialog.removeAttribute("data-closing");
      dialog.close();
    }, SORTIE_MS);
    return () => window.clearTimeout(t);
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
      // Échap : on passe par l'état du parent pour que la sortie soit animée.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={onBackdrop}
      className={`su-modal m-auto w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-card bg-surface p-0 text-ink-strong shadow-pop`}
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
          className="su-btn flex size-9 shrink-0 items-center justify-center rounded-full bg-ground text-soft hover:rotate-90 hover:text-ink md:size-8 md:bg-transparent md:hover:bg-ground"
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
