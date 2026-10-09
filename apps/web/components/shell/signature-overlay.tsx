"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SIGNATURE_EVENT, type SignatureInput } from "../../lib/signature";
import { haptic } from "../../lib/feel/haptics";
import { playSound } from "../../lib/feel/sounds";
import { Amount } from "../ui/amount";
import s from "./signature.module.css";

export interface SignatureLabels {
  conforme: string;
  annexesGenerees: string;
  annexe: string;
  envoye: string;
  voteEnregistre: string;
  paiementEnregistre: string;
  justifiee: string;
  bienvenue: string;
}

const DUREE_MS = 1200;

const Check = ({ size = 16, stroke = "var(--color-ok)", width = 2.4 }: { size?: number; stroke?: string; width?: number }) => (
  <svg viewBox="0 0 18 18" width={size} height={size} aria-hidden>
    <path d="M4.2 9.4 7.6 12.6 13.8 5.8" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Hôte des moments signature (lib/signature.ts) — posé dans la coque connectée. Chaque moment
 * dure ≤ 1,2 s, se passe d'un clic, ne retient aucune navigation, et déclenche son haptique / son
 * au sommet de la chorégraphie (réglages Sensations respectés).
 */
export function SignatureOverlay({ labels, locale }: { labels: SignatureLabels; locale: string }) {
  const [moment, setMoment] = useState<(SignatureInput & { id: number }) | null>(null);
  const [sortie, setSortie] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const onSignature = (e: Event) => {
      const detail = (e as CustomEvent<SignatureInput>).detail;
      clear();
      setSortie(false);
      setMoment({ ...detail, id: Date.now() });
      const sommet = detail.kind === "annexes" ? 760 : detail.kind === "sent" ? 520 : 680;
      timers.current.push(
        window.setTimeout(() => sommetMoment(detail.kind), sommet),
        window.setTimeout(() => setSortie(true), DUREE_MS),
        window.setTimeout(() => setMoment(null), DUREE_MS + 280)
      );
    };
    window.addEventListener(SIGNATURE_EVENT, onSignature);
    return () => {
      window.removeEventListener(SIGNATURE_EVENT, onSignature);
      clear();
    };
  }, []);

  if (!moment) return null;
  const fermer = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setSortie(true);
    timers.current = [window.setTimeout(() => setMoment(null), 280)];
  };

  return (
    <div key={moment.id} className={s.scrim} data-out={sortie ? "" : undefined} onClick={fermer} aria-hidden>
      <MomentContent moment={moment} labels={labels} locale={locale} />
    </div>
  );
}

/** Vibration + son au sommet d'un moment (réglages Sensations respectés). */
export function sommetMoment(kind: SignatureInput["kind"], { vibrer = true }: { vibrer?: boolean } = {}) {
  if (!vibrer) {
    // Écran de succès : la vibration de succès est déjà partie avec la réponse (FormAlert).
    const son = ({ annexes: "signature", sent: "sent", payment: "success", justified: "confirm" } as const)[kind as "annexes"];
    if (son) void playSound(son);
    return;
  }
  if (kind === "annexes") {
    haptic("heavy");
    void playSound("signature");
  } else if (kind === "sent") {
    haptic("success");
    void playSound("sent");
  } else if (kind === "payment") {
    haptic("success");
    void playSound("success");
  } else if (kind === "justified") {
    haptic("success");
    void playSound("confirm");
  } else {
    haptic("success");
  }
}

/** Chorégraphie d'un moment, sans calque — aussi jouée DANS l'écran de succès. */
export function MomentContent({ moment, labels, locale, clair = false }: { moment: SignatureInput; labels: SignatureLabels; locale: string; clair?: boolean }) {
  let contenu: React.ReactNode = null;
  const legende = clair ? { color: "var(--color-ink)" } : undefined;
  if (moment.kind === "annexes") {
    const titres = moment.titles ?? Array.from({ length: 12 }, (_, i) => `${labels.annexe} ${i + 1}`);
    contenu = (
      <div>
        <div className={s.card}>
          <div className={s.grid}>
            {titres.map((t, i) => (
              <div key={i} className={s.doc} style={{ "--i": i } as CSSProperties}>
                <Check />
                <span className="line-clamp-2">{t}</span>
              </div>
            ))}
          </div>
          <div className={s.seal} style={{ inset: 0, margin: "auto", width: 112, height: 112, fontSize: 18 } as CSSProperties}>
            {labels.conforme}
          </div>
        </div>
        <p className={s.caption} style={legende}>{labels.annexesGenerees}</p>
      </div>
    );
  } else if (moment.kind === "payment") {
    contenu = (
      <div className={s.card} style={{ paddingBottom: 64 }}>
        <p className="mb-4 text-center text-[15px] font-semibold text-ink">{labels.paiementEnregistre}</p>
        {/* Solde qui roule ; sans solde, le montant « atterrit » dans le reçu. */}
        <div className={s.balance}>
          {moment.balanceAfter || moment.balanceBefore ? (
            <SoldeQuiRoule avant={moment.balanceBefore} apres={moment.balanceAfter} locale={locale} />
          ) : (
            <span className={s.landed}>
              <Amount value={moment.amount} locale={locale} />
            </span>
          )}
        </div>
        <div className={s.chip}>
          <Amount value={moment.amount} locale={locale} />
        </div>
        <div className={s.seal} style={{ insetInlineEnd: -16, top: -30, width: 72, height: 72, fontSize: 30, "--at": "700ms" } as CSSProperties}>
          ✓
        </div>
      </div>
    );
  } else if (moment.kind === "sent") {
    contenu = (
      <div className="relative grid h-40 w-72 place-items-center">
        <div className={s.letter}>
          <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden fill="currentColor">
            <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zm2.3-.5 6.7 5.2L18.7 6z" />
          </svg>
        </div>
        <div className="absolute grid place-items-center">
          <div className={s.check} style={{ position: "relative" }}>
            <Check size={40} stroke="var(--color-ink)" width={2.6} />
          </div>
          <p className={s.caption} style={{ animationDelay: "560ms", ...legende }}>{moment.label ?? labels.envoye}</p>
        </div>
      </div>
    );
  } else if (moment.kind === "vote") {
    contenu = (
      <div className={s.urn}>
        <div className={s.ballot}>
          <svg viewBox="0 0 24 24" width="38" height="38" aria-hidden fill="currentColor">
            <path d="M18 13h-.68l-2 2h1.91L19 17H5l1.78-2h2.05l-2-2H6l-3 3v4c0 1.1.89 2 1.99 2H19a2 2 0 0 0 2-2v-4zm-1-5.05-4.95 4.95-3.54-3.54 4.95-4.95zm-4.24-5.66L6.39 8.66a.996.996 0 0 0 0 1.41l4.95 4.95c.39.39 1.02.39 1.41 0l6.36-6.36a.996.996 0 0 0 0-1.41L14.16 2.3a.975.975 0 0 0-1.4-.01" />
          </svg>
        </div>
        <div className={s.box}>{moment.label ?? labels.voteEnregistre}</div>
      </div>
    );
  } else if (moment.kind === "justified") {
    contenu = (
      <div className={s.card}>
        <div className="flex items-center gap-4">
          <div className={s.receipt} style={moment.receiptUrl ? { backgroundImage: `url(${JSON.stringify(moment.receiptUrl)})` } : undefined} />
          <div className="min-w-0">
            {moment.title ? <p className="line-clamp-2 text-[15px] font-semibold text-ink">{moment.title}</p> : null}
            <span className={s.badge}>{labels.justifiee}</span>
          </div>
        </div>
      </div>
    );
  } else if (moment.kind === "welcome") {
    contenu = (
      <div className="grid place-items-center gap-4">
        <div className={s.check} style={{ position: "relative", width: 96, height: 96, borderRadius: 28, background: "var(--color-brand)" }}>
          <svg viewBox="0 0 32 32" width="48" height="48" aria-hidden>
            <path d="M8 19 16 11l8 8M8 25l8-8 8 8" fill="none" stroke="var(--color-lime)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className={s.caption} style={{ fontSize: 22, animationDelay: "420ms", ...legende }}>{labels.bienvenue}</p>
      </div>
    );
  }

  return <>{contenu}</>;
}
/** Solde : affiche l'ancien puis, au moment où le montant « tombe », le nouveau (qui roule). */
function SoldeQuiRoule({ avant, apres, locale }: { avant?: string; apres?: string; locale: string }) {
  const [v, setV] = useState(avant ?? apres);
  useEffect(() => {
    const t = window.setTimeout(() => setV(apres ?? avant), 640);
    return () => window.clearTimeout(t);
  }, [avant, apres]);
  return <Amount value={v} locale={locale} />;
}
