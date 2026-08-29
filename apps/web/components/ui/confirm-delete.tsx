"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import type React from "react";
import { Modal, IrreversibleNotice } from "./modal";
import { Button } from "./button";
import { FormAlert, SubmitButton } from "./form";
import { IDLE, type FormState } from "../../lib/forms";
import { fill, type Dict, type Locale } from "../../lib/i18n";
import { toast } from "../../lib/toast";

function IconTrash(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

/**
 * Suppression / annulation avec confirmation — le même geste partout dans l'app : un bouton
 * discret, une question nominative, l'avertissement d'irréversibilité, puis l'action serveur.
 * Les refus métier (409 : « a un historique ») s'affichent dans la modale, jamais en 500.
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
  variant?: "dangerGhost" | "secondary" | "danger";
  size?: "sm" | "md";
  icon?: boolean;
  /** Icône seule (tableaux denses) — le libellé reste accessible via title/aria-label. */
  compact?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, IDLE);
  const g = dict.gestion;
  const libelle = label ?? g.supprimer;

  useEffect(() => {
    if (state.status === "success") {
      toast({ titre: g.supprime, tone: "ok", duree: 3500 });
      const t = setTimeout(() => setOpen(false), 700);
      return () => clearTimeout(t);
    }
  }, [state, g.supprime]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        title={libelle}
        aria-label={libelle}
      >
        {icon || compact ? <IconTrash width={15} height={15} /> : null}
        {compact ? null : libelle}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={titre ?? libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <p className="text-sm font-medium text-ok">{g.supprime}</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            {Object.entries(champs).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <p className="text-[15px] font-semibold text-ink">{fill(g.supprimerQuestion, { nom })}</p>
            {children}
            <IrreversibleNotice>{aide ?? g.supprimerIrreversible}</IrreversibleNotice>
            <FormAlert state={state} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger">{label ?? g.supprimerConfirmer}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
