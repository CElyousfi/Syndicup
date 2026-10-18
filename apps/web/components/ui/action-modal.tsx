"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { IconCheck } from "./icons";
import { IDLE, type FormState } from "../../lib/forms";
import { toast } from "../../lib/toast";
import { celebrate, type SuccessInput } from "../../lib/success";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export interface ActionModalContext {
  state: FormState;
  formAction: (fd: FormData) => void;
  pending: boolean;
  close: () => void;
}

export interface ActionModalSuccess {
  /** Message du succès (le message renvoyé par l'action, s'il existe, l'emporte). */
  message: string;
  /** Prochaines étapes proposées sous le message (ex. « Voir la dépense »). */
  next?: ReactNode | ((close: () => void, state: Extract<FormState, { status: "success" }>) => ReactNode);
  /** Action MAJEURE : écran de succès plein (Wise) puis fermeture — au lieu du panneau. */
  illustration?: string;
  /** Moment signature joué par l'écran plein (paiement, envoi, vote, justifiée). */
  moment?: SuccessInput["moment"];
  /** Corps de l'écran plein. */
  corps?: string | ((state: Extract<FormState, { status: "success" }>) => string | undefined);
  /** Lien « Voir » de l'écran plein (avec `illustration`). */
  href?: string;
  hrefLabel?: string;
  /** Succès mineur : toast puis fermeture, sans panneau. */
  closeAndToast?: boolean;
}

/**
 * Modale d'action — une `<Modal>` et son `useActionState`, REMIS À ZÉRO À CHAQUE OUVERTURE
 * (l'état vit dans un enfant clé par ouverture) : rouvrir une modale ne montre plus jamais le
 * succès — ni l'erreur — de la fois précédente. Le succès s'affiche dans UN panneau partagé
 * (message + prochaines étapes + « Fermer »), ou en toast / écran plein selon `success`.
 */
export function ActionModal({
  action,
  title,
  subtitle,
  wide,
  closeLabel,
  trigger,
  defaultOpen = false,
  success,
  onSuccess,
  children,
}: {
  action: Action;
  title: ReactNode;
  subtitle?: ReactNode;
  wide?: boolean;
  closeLabel: string;
  /** Ouverte au premier rendu (lien profond « ?nouveau=1 »…). */
  defaultOpen?: boolean;
  /** Déclencheur : reçoit la fonction d'ouverture. */
  trigger: (open: () => void) => ReactNode;
  success: ActionModalSuccess;
  /** Appelé une fois par succès (après la réponse 2xx). */
  onSuccess?: (state: Extract<FormState, { status: "success" }>) => void;
  children: (ctx: ActionModalContext) => ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [session, setSession] = useState(0);
  const ouvrir = () => {
    setSession((s) => s + 1);
    setOpen(true);
  };
  return (
    <>
      {trigger(ouvrir)}
      <ActionModalBody
        key={session}
        open={open}
        close={() => setOpen(false)}
        action={action}
        title={title}
        subtitle={subtitle}
        wide={wide}
        closeLabel={closeLabel}
        success={success}
        onSuccess={onSuccess}
      >
        {children}
      </ActionModalBody>
    </>
  );
}

function ActionModalBody({
  open,
  close,
  action,
  title,
  subtitle,
  wide,
  closeLabel,
  success,
  onSuccess,
  children,
}: {
  open: boolean;
  close: () => void;
  action: Action;
  title: ReactNode;
  subtitle?: ReactNode;
  wide?: boolean;
  closeLabel: string;
  success: ActionModalSuccess;
  onSuccess?: (state: Extract<FormState, { status: "success" }>) => void;
  children: (ctx: ActionModalContext) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const message = state.status === "success" ? state.message || success.message : success.message;
  const fermerAuSucces = Boolean(success.illustration || success.closeAndToast);

  // Un seul effet par succès (l'objet `state` change à chaque réponse).
  const traite = useRef<FormState | null>(null);
  useEffect(() => {
    if (state.status !== "success" || traite.current === state) return;
    traite.current = state;
    onSuccess?.(state);
    if (success.illustration) {
      const corps = typeof success.corps === "function" ? success.corps(state) : success.corps;
      celebrate({ titre: message, corps, illustration: success.illustration, moment: success.moment, href: success.href, hrefLabel: success.hrefLabel });
      close();
    } else if (success.closeAndToast) {
      toast({ titre: message, tone: "ok", duree: 4000 });
      close();
    }
  }, [state, message, success.illustration, success.moment, success.corps, success.closeAndToast, success.href, success.hrefLabel, onSuccess, close]);

  const montrerPanneau = state.status === "success" && !fermerAuSucces;
  // Succès annoncé ici (toast / écran plein) : le formulaire qui se referme ne l'annonce pas une
  // seconde fois via son <FormAlert>.
  const etatFormulaire = state.status === "success" && fermerAuSucces ? IDLE : state;
  return (
    <Modal open={open} onClose={close} title={title} subtitle={subtitle} wide={wide} closeLabel={closeLabel}>
      {montrerPanneau ? (
        <SuccessPanel
          message={message}
          closeLabel={closeLabel}
          onClose={close}
          next={typeof success.next === "function" && state.status === "success" ? success.next(close, state) : typeof success.next === "function" ? null : success.next}
        />
      ) : (
        children({ state: etatFormulaire, formAction, pending, close })
      )}
    </Modal>
  );
}

/**
 * Panneau de succès partagé des modales : coche, message, prochaines étapes, « Fermer ».
 * Annoncé aux lecteurs d'écran (role="status").
 */
export function SuccessPanel({
  message,
  closeLabel,
  onClose,
  next,
}: {
  message: ReactNode;
  closeLabel: string;
  onClose: () => void;
  next?: ReactNode;
}) {
  return (
    <div className="space-y-5" role="status">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-cta text-ink">
          <IconCheck width={16} height={16} />
        </span>
        <p className="text-[15px] font-semibold leading-snug text-ink">{message}</p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {closeLabel}
        </Button>
        {next}
      </div>
    </div>
  );
}
