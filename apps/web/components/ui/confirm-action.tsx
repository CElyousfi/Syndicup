"use client";

import type { ReactNode } from "react";
import { ActionModal, type ActionModalSuccess } from "./action-modal";
import { IrreversibleNotice } from "./irreversible-notice";
import { Button, type ButtonVariant } from "./button";
import { FormAlert, SubmitButton } from "./form";
import type { FormState } from "../../lib/forms";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * Action à conséquence, confirmée — le même geste partout : un déclencheur, une question
 * nominative, la conséquence en une phrase, puis un bouton au VERBE PRÉCIS (« Annuler la
 * déclaration », « Révoquer la procuration », jamais « OK »).
 *
 *  - `tone="danger"` (défaut) : bouton rouge — retrait, annulation, révocation ;
 *  - `tone="primary"` : geste positif mais engageant (convoquer une AG, ouvrir la séance) ;
 *  - `irreversible` : la conséquence s'affiche dans <IrreversibleNotice> — obligatoire pour les
 *    écritures probantes / append-only (CLAUDE.md §1.2) et tout ce qui ne se défait pas.
 *
 * Le refus métier (409, 422 gaté légalement…) s'affiche DANS la modale ; le succès se signale
 * en toast et referme (ou panneau / écran plein selon `success`). L'état repart de zéro à
 * chaque ouverture (ActionModal).
 */
export function ConfirmAction({
  action,
  fields,
  triggerLabel,
  triggerVariant = "dangerGhost",
  triggerSize = "sm",
  triggerIcon,
  triggerClassName = "",
  compact = false,
  title,
  question,
  consequence,
  irreversible = false,
  tone = "danger",
  confirmLabel,
  dismissLabel,
  closeLabel,
  success,
  onSuccess,
  legalGateTitle,
  legalGateAction,
  children,
}: {
  action: Action;
  /** Champs cachés envoyés à l'action (locale, identifiants…). */
  fields: Record<string, string>;
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: "sm" | "md" | "lg";
  triggerIcon?: ReactNode;
  triggerClassName?: string;
  /** Icône seule (tableaux denses) — le libellé reste accessible (title / aria-label). */
  compact?: boolean;
  title: ReactNode;
  /** Question nominative en gras (« Retirer le logo de la résidence ? »). */
  question?: ReactNode;
  /** Ce qui va se passer, en une phrase. */
  consequence: ReactNode;
  irreversible?: boolean;
  tone?: "danger" | "primary";
  /** Verbe précis du bouton de confirmation. */
  confirmLabel: string;
  /** Renoncer (défaut : « Fermer » — jamais « Annuler » à côté d'un « Annuler la … »). */
  dismissLabel?: string;
  closeLabel: string;
  /** Défaut : toast du message puis fermeture. */
  success: string | ActionModalSuccess;
  onSuccess?: (state: Extract<FormState, { status: "success" }>) => void;
  legalGateTitle?: string;
  legalGateAction?: ReactNode;
  /** Champs supplémentaires (motif…), placés avant la conséquence. */
  children?: ReactNode;
}) {
  const succes: ActionModalSuccess = typeof success === "string" ? { message: success, closeAndToast: true } : success;
  return (
    <ActionModal
      action={action}
      title={title}
      closeLabel={closeLabel}
      success={succes}
      onSuccess={onSuccess}
      trigger={(open) => (
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          className={triggerClassName}
          onClick={open}
          title={compact ? triggerLabel : undefined}
          aria-label={compact ? triggerLabel : undefined}
        >
          {triggerIcon}
          {compact ? null : triggerLabel}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {question ? <p className="text-[16px] font-bold leading-snug text-ink">{question}</p> : null}
          {children}
          {irreversible ? (
            <IrreversibleNotice>{consequence}</IrreversibleNotice>
          ) : (
            <p className="text-[14px] leading-relaxed text-body">{consequence}</p>
          )}
          <FormAlert state={state} legalGateTitle={legalGateTitle} legalGateAction={legalGateAction} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dismissLabel ?? closeLabel}
            </Button>
            <SubmitButton variant={tone === "danger" ? "danger" : "primary"}>{confirmLabel}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
  );
}
