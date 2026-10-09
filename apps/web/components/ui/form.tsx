"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "../../lib/toast";
import { celebrate } from "../../lib/success";
import { haptic } from "../../lib/feel/haptics";
import type { ReactNode } from "react";
import type { FormState } from "../../lib/forms";
import { Button, type ButtonVariant } from "./button";
import { Banner } from "./banner";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  // Vivant : le résultat de l'action (annoncé par <FormAlert> via l'événement `su:form-result`
  // sur le formulaire) se lit dans le bouton — coche tracée sur succès, secousse sur erreur.
  const ref = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<"done" | "error" | null>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    let t: number | undefined;
    const onResult = (e: Event) => {
      const status = (e as CustomEvent<{ status: string }>).detail.status;
      if (document.documentElement.dataset.alive === "0") return;
      setResult(status === "success" ? "done" : status === "error" ? "error" : null);
      window.clearTimeout(t);
      t = window.setTimeout(() => setResult(null), status === "success" ? 1100 : 520);
    };
    form.addEventListener(FORM_RESULT_EVENT, onResult);
    return () => {
      form.removeEventListener(FORM_RESULT_EVENT, onResult);
      window.clearTimeout(t);
    };
  }, []);
  // Libellé, spinner et coche superposés dans une même cellule : la largeur ne bouge jamais.
  return (
    <Button
      ref={ref}
      type="submit"
      variant={variant}
      size={size}
      className={`${result === "error" ? "animate-shake" : ""} ${className}`}
      disabled={pending || disabled}
      data-pending={pending ? "" : undefined}
      data-done={result === "done" && !pending ? "" : undefined}
      aria-busy={pending || undefined}
    >
      <span className="su-submit-stack">
        <span className="su-submit-label">{children}</span>
        <span className="su-submit-spinner" aria-hidden>
          <Spinner />
        </span>
        <span className="su-submit-done" aria-hidden>
          <svg viewBox="0 0 18 18" className="size-[18px]">
            <path d="M4.2 9.4 7.6 12.6 13.8 5.8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </Button>
  );
}

/** Résultat d'une Server Action, diffusé par <FormAlert> sur son <form> (SubmitButton l'écoute). */
export const FORM_RESULT_EVENT = "su:form-result";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`size-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Restitution des erreurs d'une Server Action. L'état « gaté légalement » (422 sur paramètre
 * légal absent) est une bannière informative, jamais une erreur rouge (brief §6.3).
 */
export function FormAlert({
  state,
  legalGateTitle,
  legalGateAction,
  successRender,
  celebrate: celebration,
}: {
  state: FormState;
  legalGateTitle?: string;
  legalGateAction?: ReactNode;
  successRender?: (message?: string) => ReactNode;
  /** Action MAJEURE : le succès s'annonce en écran plein (Wise) au lieu d'un toast —
   *  `illustration` : ok-paiement, ok-incident, ok-vote, ok-reservation, ok-invitation,
   *  ok-visiteur, ok-general. */
  celebrate?: { illustration: string; corps?: string };
}) {
  // Un succès porteur d'un message est aussi annoncé (toast, ou écran de succès pour une action
  // majeure) — visible même si la modale se ferme.
  const succes = state.status === "success" ? state.message : undefined;
  const illustration = celebration?.illustration;
  const corps = celebration?.corps;
  useEffect(() => {
    if (!succes) return;
    if (illustration) celebrate({ titre: succes, corps, illustration });
    else toast({ titre: succes, tone: "ok", duree: 4000 });
  }, [succes, illustration, corps]);
  // Vivant : chaque nouveau résultat est annoncé au formulaire (SubmitButton : coche / secousse)
  // et au toucher (Android) — succès confirmé par le serveur, ou refus.
  const ancre = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (state.status !== "success" && state.status !== "error") return;
    const form = ancre.current?.closest("form");
    form?.dispatchEvent(new CustomEvent(FORM_RESULT_EVENT, { detail: { status: state.status } }));
    if (state.status === "error") haptic(state.code === "VALIDATION_ERROR" || state.legalGate ? "warning" : "error");
    else haptic("success");
  }, [state]);
  const marque = <span ref={ancre} hidden />;
  if (state.status === "success") {
    if (successRender) return <>{marque}{successRender(state.message)}</>;
    if (!state.message) return marque;
    return <>{marque}<Banner variant="ok">{state.message}</Banner></>;
  }
  if (state.status !== "error") return marque;
  if (state.legalGate) {
    return (
      <>
        {marque}
        <Banner variant="legal" title={legalGateTitle} action={legalGateAction}>
          {state.message}
        </Banner>
      </>
    );
  }
  // Les erreurs par champ sont affichées sous les champs — pas de doublon global.
  if (state.code === "VALIDATION_ERROR" && state.fields && Object.keys(state.fields).length > 0) {
    return marque;
  }
  return (
    <>
    {marque}
    <Banner variant="danger">
      {state.message}
      {state.requestId ? (
        <span className="mt-1 block font-mono text-[11px] text-faint" dir="ltr">
          {state.requestId}
        </span>
      ) : null}
    </Banner>
    </>
  );
}
