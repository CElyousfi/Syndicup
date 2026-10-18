"use client";

import type { ReactNode } from "react";
import type React from "react";
import { ConfirmAction } from "./confirm-action";
import type { FormState } from "../../lib/forms";
import { fill, type Dict, type Locale } from "../../lib/i18n";

function IconTrash(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

/**
 * Suppression avec confirmation — cas particulier de <ConfirmAction> : un bouton discret, une
 * question nominative, l'avertissement d'irréversibilité, puis l'action serveur. Les refus
 * métier (409 : « a un historique ») s'affichent dans la modale, jamais en 500.
 */
export function ConfirmDelete({
  dict,
  locale,
  action,
  champs,
  nom,
  titre,
  aide,
  label,
  confirmLabel,
  succes,
  variant = "dangerGhost",
  size = "sm",
  icon = true,
  compact = false,
  children,
}: {
  dict: Dict;
  locale: Locale;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  champs: Record<string, string>;
  nom: string;
  titre?: string;
  aide?: string;
  label?: string;
  /** Verbe du bouton de confirmation (défaut : le libellé, ou « Supprimer définitivement »). */
  confirmLabel?: string;
  /** Message du succès (défaut : « Supprimé. »). */
  succes?: string;
  variant?: "dangerGhost" | "secondary" | "danger";
  size?: "sm" | "md";
  icon?: boolean;
  /** Icône seule (tableaux denses) — le libellé reste accessible via title/aria-label. */
  compact?: boolean;
  children?: ReactNode;
}) {
  const g = dict.gestion;
  const libelle = label ?? g.supprimer;
  return (
    <ConfirmAction
      action={action}
      fields={{ locale, ...champs }}
      triggerLabel={libelle}
      triggerVariant={variant}
      triggerSize={size}
      triggerIcon={icon || compact ? <IconTrash width={15} height={15} /> : null}
      compact={compact}
      title={titre ?? libelle}
      question={fill(g.supprimerQuestion, { nom })}
      consequence={aide ?? g.supprimerIrreversible}
      irreversible
      confirmLabel={confirmLabel ?? label ?? g.supprimerConfirmer}
      closeLabel={dict.common.close}
      success={succes ?? g.supprime}
    >
      {children}
    </ConfirmAction>
  );
}
