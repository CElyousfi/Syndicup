/**
 * Chargement en échec — carte calme, jamais confondue avec un état vide : « Impossible de
 * charger … pour l'instant », pourquoi (localisé d'après le code), « Réessayer » (relit la page
 * serveur, sans rien rejouer) et la référence courte copiable pour le support.
 *
 *  - `variant="page"` (défaut) : illustration « offline » (sans Dari), pour une liste entière ;
 *  - `variant="inline"` : une ligne dans une section (tuile de tableau de bord, encart).
 *
 * Composant SERVEUR (texte localisé au rendu) ; seuls le bouton et la référence sont clients.
 */
import { describeError } from "../../lib/errors";
import { fill, getDict, type Locale } from "../../lib/i18n";
import type { LoadFailure } from "../../lib/api/unwrap";
import { Illustration } from "./illustration";
import { SuArt } from "./su-art";
import { IconCircle, CAlert, CShield } from "./color-icons";
import { ReferenceChip, RefreshButton } from "./error-parts";

export function LoadError({
  error,
  locale,
  title,
  variant = "page",
  className = "",
}: {
  error: LoadFailure;
  locale: Locale;
  /** Remplace le titre générique (ex. « Solde indisponible »). */
  title?: string;
  variant?: "page" | "inline";
  className?: string;
}) {
  const e = getDict(locale).errors;
  // Filet de sécurité : un 403 est un refus PAR CONCEPTION (la ressource ne concerne pas ce
  // rôle, apps/api/lib/auth/permissions.ts), jamais une panne — pas de « Réessayer » éternel.
  // En ligne : rien (l'appelant devrait masquer la section, cf. isRefused) ; en page : un
  // message calme « Pas d'accès ».
  if (error.status === 403) {
    if (variant === "inline") return null;
    return (
      <div role="status" className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
        <SuArt
          id="D04"
          size={140}
          className="mb-5"
          fallback={
            <IconCircle tone="sand" size={64} className="mb-5">
              <CShield width={28} height={28} />
            </IconCircle>
          }
        />
        <h3 className="text-[19px] font-bold tracking-tight text-ink">{e.forbidden.title}</h3>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-soft">{e.forbidden.body}</p>
      </div>
    );
  }
  const d = describeError(
    { code: error.code, message: error.message, status: error.status, retryAfter: error.retryAfter, requestId: error.requestId },
    locale
  );
  // Pour un chargement, l'action est toujours de relire : réessayer (ou actualiser).
  const actionLabel = d.action === "refresh" ? e.actions.refresh : e.actions.retry;
  const reference = d.reference ? (
    <ReferenceChip
      label={fill(e.reference, { ref: d.reference })}
      value={error.requestId ?? d.reference}
      copyLabel={e.referenceCopy}
      copiedLabel={e.referenceCopied}
    />
  ) : null;
  // Session expirée : le lien de reconnexion est porté par la coque (middleware) ; ici on
  // garde le ton neutre et on propose de relire, ce qui redirige si nécessaire.
  const corps = d.code === "NETWORK" || d.code === "UNAUTHENTICATED" || d.code === "RATE_LIMITED" ? d.body : e.load.body;

  if (variant === "inline") {
    return (
      <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] bg-warn-tint px-4 py-3 text-[13px] text-ink-strong ${className}`}>
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{title ?? e.load.section}</span>{" "}
          <span className="text-body">{d.code === "NETWORK" || d.code === "RATE_LIMITED" ? d.body : ""}</span>
        </span>
        <span className="flex items-center gap-2">
          <RefreshButton label={actionLabel} />
          {reference}
        </span>
      </div>
    );
  }

  return (
    <div role="status" className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <Illustration
        name="offline"
        size={140}
        className="mb-5"
        fallback={
          <IconCircle tone="sand" size={64}>
            <CAlert width={28} height={28} />
          </IconCircle>
        }
      />
      <h3 className="text-[19px] font-bold tracking-tight text-ink">{title ?? e.load.title}</h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-soft">{corps}</p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <RefreshButton label={actionLabel} size="md" variant="primary" />
        {reference}
      </div>
    </div>
  );
}
