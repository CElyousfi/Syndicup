"use client";

/**
 * Écran d'échec d'une page (frontières d'erreur) — calme, localisé, jamais une impasse :
 * « Réessayer » (reset de la frontière + relecture serveur), « Retour à l'accueil », et la
 * référence (digest) copiable pour le support. Recharge une fois, silencieusement, un onglet
 * resté ouvert sur un ancien déploiement (actions serveur / chunks disparus).
 */
import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./button";
import { IconCircle, CAlert } from "./color-icons";
import { Illustration } from "./illustration";
import { ReferenceChip } from "./error-parts";
import { boundaryFr, errorActionsFr, referenceFr } from "../../lib/i18n/errors-fr";
import { boundaryAr, errorActionsAr, referenceAr } from "../../lib/i18n/errors-ar";

/** Textes importés pièce par pièce : jamais le dictionnaire complet dans le bundle client. */
const TEXTES = {
  fr: { b: boundaryFr, a: errorActionsFr, r: referenceFr },
  ar: { b: boundaryAr, a: errorActionsAr, r: referenceAr },
} as const;

export function useStaleDeployReload(error: Error & { digest?: string }) {
  useEffect(() => {
    const m = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const perime =
      /UnrecognizedActionError|Server Action .* was not found|ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(m);
    if (!perime) return;
    const cle = "syndicup:reload-perime";
    try {
      const dernier = Number(sessionStorage.getItem(cle) ?? 0);
      if (Date.now() - dernier < 30_000) return; // jamais de boucle de rechargement
      sessionStorage.setItem(cle, String(Date.now()));
    } catch (e) {
      console.warn(JSON.stringify({ niveau: "warn", message: "sessionStorage indisponible", erreur: String(e) }));
    }
    window.location.reload();
  }, [error]);
}

export function ErrorScreen({
  error,
  reset,
  locale,
  fullScreen = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  locale: "fr" | "ar";
  /** Hors coque (frontière racine) : occupe tout l'écran. */
  fullScreen?: boolean;
}) {
  useStaleDeployReload(error);
  const router = useRouter();
  const [pending, start] = useTransition();
  const t = TEXTES[locale];
  const digest = error.digest;
  const ref = digest ? digest.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8) : null;
  useEffect(() => {
    console.error(JSON.stringify({ niveau: "error", message: "frontiere d'erreur", digest: digest ?? null, nom: error?.name ?? null }));
  }, [digest, error]);

  return (
    <div className={fullScreen ? "flex min-h-screen items-center justify-center bg-surface px-4" : "page-root flex justify-center"}>
      <div className="w-full max-w-md animate-in-up py-12 text-center" role="alert">
        <Illustration
          name="offline"
          size={170}
          className="mx-auto"
          fallback={
            <IconCircle tone="sand" size={72}>
              <CAlert width={32} height={32} />
            </IconCircle>
          }
        />
        <h1 className="mt-6 text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-ink">{t.b.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-soft">{t.b.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() =>
              start(() => {
                // Relire les données serveur PUIS ré-essayer le rendu de la frontière.
                router.refresh();
                reset();
              })
            }
          >
            {t.a.retry}
          </Button>
          <Link
            href={`/${locale}/tableau-de-bord`}
            className="su-btn inline-flex h-12 items-center justify-center rounded-btn border-[1.5px] border-link px-7 text-[15px] font-semibold text-link hover:bg-action-wash"
          >
            {t.a.backHome}
          </Link>
        </div>
        {ref && digest ? (
          <div className="mt-5 flex justify-center">
            <ReferenceChip label={t.r.reference.replace("{ref}", ref)} value={digest} copyLabel={t.r.referenceCopy} copiedLabel={t.r.referenceCopied} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
