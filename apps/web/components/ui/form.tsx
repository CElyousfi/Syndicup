"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "../../lib/toast";
import { celebrate } from "../../lib/success";
import type { ReactNode } from "react";
import type { FormErrorState, FormState } from "../../lib/forms";
import { Button, type ButtonVariant } from "./button";
import { Banner } from "./banner";
import { ActionLink, ReferenceChip, RefreshButton } from "./error-parts";

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
  // Libellé, spinner et coche superposés dans une même cellule : la largeur ne bouge jamais.
  // Vivant : <FormAlert> pose `data-done` (coche tracée en CSS) ou `data-shake` après la réponse.
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      data-pending={pending ? "" : undefined}
      aria-busy={pending || undefined}
    >
      <span className="su-submit-stack">
        <span className="su-submit-label">{children}</span>
        <span className="su-submit-spinner" aria-hidden>
          <Spinner />
        </span>
        <span className="su-submit-done" aria-hidden />
      </span>
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
  celebrate: celebration,
  compact = false,
}: {
  state: FormState;
  /** Sous un bouton de ligne (valider, révoquer…) : sans titre, largeur bornée. */
  compact?: boolean;
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
  // Vivant : chaque nouveau résultat est annoncé au formulaire (bouton d'envoi : coche /
  // secousse) et au toucher (Android) — module chargé à la demande (lib/feel/lazy.ts).
  const ancre = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (state.status !== "idle") void import("../../lib/feel/lazy").then((m) => m.annoncer(ancre.current, state));
  }, [state]);
  return (
    <>
      <span ref={ancre} hidden />
      {compact ? (
        state.status === "error" ? (
          <div className="max-w-xs text-start">{corpsAlerte(state, legalGateTitle, legalGateAction, successRender, true)}</div>
        ) : null
      ) : (
        corpsAlerte(state, legalGateTitle, legalGateAction, successRender)
      )}
    </>
  );
}

function corpsAlerte(
  state: FormState,
  legalGateTitle?: string,
  legalGateAction?: ReactNode,
  successRender?: (message?: string) => ReactNode,
  compact = false
): ReactNode {
  if (state.status === "success") {
    if (successRender) return successRender(state.message);
    return state.message ? <Banner variant="ok">{state.message}</Banner> : null;
  }
  if (state.status !== "error") return null;
  if (state.legalGate) {
    return (
      <Banner variant="legal" title={legalGateTitle ?? state.title} action={legalGateAction}>
        {state.message}
      </Banner>
    );
  }
  // Les erreurs par champ sont affichées sous les champs — pas de doublon global.
  if (!compact && state.code === "VALIDATION_ERROR" && state.fields && Object.keys(state.fields).length > 0) return null;
  return <ErrorBanner state={state} compact={compact} />;
}

/**
 * Bannière d'échec : ce qui s'est passé (titre + message localisés côté serveur), la prochaine
 * étape (Réessayer / Se reconnecter / Actualiser / Contacter le syndic) et la référence courte,
 * copiable. Session expirée = ton neutre (ce n'est pas une faute), lien qui ramène ici.
 */
export function ErrorBanner({ state, compact = false }: { state: FormErrorState; compact?: boolean }) {
  const action = errorAction(state);
  const neutre = state.code === "UNAUTHENTICATED" || state.code === "NETWORK" || state.code === "RATE_LIMITED";
  return (
    <Banner
      variant={neutre ? "warn" : "danger"}
      title={compact ? undefined : state.title}
      action={action || state.reference ? (
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {state.reference ? (
            <ReferenceChip label={state.reference} value={state.requestId ?? state.reference} copyLabel={state.copyLabel} copiedLabel={state.copiedLabel} />
          ) : null}
        </div>
      ) : undefined}
    >
      {state.message}
      {state.action === "contact" && state.actionLabel ? <span className="mt-1 block text-soft">{state.actionLabel}</span> : null}
    </Banner>
  );
}

function errorAction(state: FormErrorState): ReactNode {
  if (!state.actionLabel) return null;
  switch (state.action) {
    case "relogin":
      return <ActionLink href={state.actionHref ?? "/connexion"} label={state.actionLabel} variant="primary" />;
    case "refresh":
      return <RefreshButton label={state.actionLabel} />;
    case "retry":
      // « Réessayer » relit d'abord l'état réel de la page (la saisie reste dans le formulaire) :
      // chaque appel porte une NOUVELLE clé d'idempotence, un renvoi automatique après une coupure
      // réseau pourrait donc doubler une écriture déjà traitée. L'utilisateur renvoie lui-même.
      return <RefreshButton label={state.actionLabel} />;
    default:
      return null;
  }
}
