"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "../../lib/toast";
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
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled}>
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}

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
}: {
  state: FormState;
  legalGateTitle?: string;
  legalGateAction?: ReactNode;
  successRender?: (message?: string) => ReactNode;
}) {
  // Un succès porteur d'un message est aussi annoncé en toast — visible même si la modale se ferme.
  const succes = state.status === "success" ? state.message : undefined;
  useEffect(() => {
    if (succes) toast({ titre: succes, tone: "ok", duree: 4000 });
  }, [succes]);
  if (state.status === "success") {
    if (successRender) return <>{successRender(state.message)}</>;
    if (!state.message) return null;
    return <Banner variant="ok">{state.message}</Banner>;
  }
  if (state.status !== "error") return null;
  if (state.legalGate) {
    return (
      <Banner variant="legal" title={legalGateTitle} action={legalGateAction}>
        {state.message}
      </Banner>
    );
  }
  // Les erreurs par champ sont affichées sous les champs — pas de doublon global.
  if (state.code === "VALIDATION_ERROR" && state.fields && Object.keys(state.fields).length > 0) {
    return null;
  }
  return (
    <Banner variant="danger">
      {state.message}
      {state.requestId ? (
        <span className="mt-1 block font-mono text-[11px] text-faint" dir="ltr">
          {state.requestId}
        </span>
      ) : null}
    </Banner>
  );
}
