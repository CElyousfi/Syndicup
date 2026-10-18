"use client";

/**
 * Données en direct qui ne se mettent plus à jour : une pastille calme (ton du bandeau de
 * connexion, components/shell/ambient.tsx) « Connexion perdue — dernière mise à jour il y a
 * 30 s · Réessayer ». Elle disparaît d'elle-même au prochain succès. Rien ne bouge en boucle :
 * seul le compteur d'âge avance (toutes les 5 s, texte uniquement).
 *
 *  - `useStale()` : à brancher sur une boucle de sondage — `ok()` après chaque succès,
 *    `fail()` après chaque échec ;
 *  - `<StaleIndicator>` : la pastille, en ligne (`floating=false`) ou flottante en haut.
 */
import { useCallback, useEffect, useState } from "react";

export interface StaleLabels {
  lost: string;
  lastUpdate: string;
  never: string;
  seconds: string;
  minutes: string;
  retry: string;
}

export function useStale() {
  const [failing, setFailing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const ok = useCallback(() => {
    setFailing(false);
    setLastUpdated(Date.now());
  }, []);
  const fail = useCallback(() => setFailing(true), []);
  return { failing, lastUpdated, ok, fail };
}

function age(ms: number, l: StaleLabels): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? l.seconds.replace("{n}", String(s)) : l.minutes.replace("{n}", String(Math.round(s / 60)));
}

export function StaleIndicator({
  failing,
  lastUpdated,
  labels,
  onRetry,
  floating = false,
  className = "",
}: {
  failing: boolean;
  lastUpdated: number | null;
  labels: StaleLabels;
  onRetry?: () => void;
  /** Flottante en haut de l'écran (coque) ; sinon en ligne, à côté du contenu concerné. */
  floating?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!failing) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, [failing]);

  const texte = lastUpdated ? labels.lastUpdate.replace("{temps}", age(now - lastUpdated, labels)) : labels.never;
  const contenu = (
    <>
      <span className="su-net-dot" aria-hidden />
      <span>
        {labels.lost} — {texte}
      </span>
      {onRetry ? (
        <>
          <span aria-hidden>·</span>
          <button type="button" onClick={onRetry} className="su-btn pointer-events-auto underline underline-offset-2">
            {labels.retry}
          </button>
        </>
      ) : null}
    </>
  );

  if (floating) {
    return (
      <div className={`su-net ${className}`} data-state={failing ? "off" : "ok"} role="status" aria-live="polite">
        <div className="su-net-inner">{failing ? contenu : null}</div>
      </div>
    );
  }
  if (!failing) return null;
  return (
    <div role="status" aria-live="polite" className={`inline-flex flex-wrap items-center gap-2 rounded-full bg-warn-tint px-4 py-2 text-[13px] font-semibold text-warn ${className}`}>
      {contenu}
    </div>
  );
}
