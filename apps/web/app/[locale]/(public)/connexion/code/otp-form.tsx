"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { IDLE } from "../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import { formatTelephone } from "../../../../../lib/format";
import { verifierOtp, renvoyerOtp } from "../actions";

const LONGUEUR = 6;
const DELAI_RENVOI_S = 30;

export function OtpForm({
  dict,
  locale,
  telephone,
  next,
}: {
  dict: Dict;
  locale: Locale;
  telephone: string;
  next?: string;
}) {
  const [state, action] = useActionState(verifierOtp, IDLE);
  const [resendState, resendAction] = useActionState(renvoyerOtp, IDLE);
  const [digits, setDigits] = useState<string[]>(Array(LONGUEUR).fill(""));
  const [countdown, setCountdown] = useState(DELAI_RENVOI_S);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Nouveau code envoyé → redémarrer le compte à rebours.
  useEffect(() => {
    if (resendState.status === "success") setCountdown(DELAI_RENVOI_S);
  }, [resendState]);

  const code = digits.join("");

  // Code refusé : la grille tremble, les cases se vident et le curseur revient au début.
  const [echecs, setEchecs] = useState(0);
  useEffect(() => {
    if (state.status === "error" && state.code === "UNAUTHENTICATED") {
      setEchecs((n) => n + 1);
      setDigits(Array(LONGUEUR).fill(""));
    }
  }, [state]);
  // Après le remontage de la grille (clé = nombre d'échecs) : focus sur la première case.
  useEffect(() => {
    if (echecs > 0) refs.current[0]?.focus();
  }, [echecs]);

  const setDigit = (i: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => {
        const n = [...d];
        n[i] = "";
        return n;
      });
      return;
    }
    // Collage d'un code complet dans n'importe quelle case.
    if (clean.length > 1) {
      const pasted = clean.slice(0, LONGUEUR).split("");
      setDigits((d) => {
        const n = [...d];
        for (let j = 0; j < pasted.length; j++) n[j] = pasted[j]!;
        return n;
      });
      const target = Math.min(pasted.length, LONGUEUR - 1);
      refs.current[target]?.focus();
      if (pasted.length === LONGUEUR) queueMicrotask(() => formRef.current?.requestSubmit());
      return;
    }
    setDigits((d) => {
      const n = [...d];
      n[i] = clean;
      const complet = n.every((x) => x !== "");
      if (complet) queueMicrotask(() => formRef.current?.requestSubmit());
      return n;
    });
    if (i < LONGUEUR - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div>
      <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{dict.auth.otpTitle}</h1>
      <p className="mt-2 text-[15px] text-soft">
        {fill(dict.auth.otpSubtitle, { telephone: formatTelephone(telephone) })}
      </p>

      <form ref={formRef} action={action} className="mt-8 space-y-6" suppressHydrationWarning>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="telephone" value={telephone} />
        <input type="hidden" name="code" value={code} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <OtpGrid echecs={echecs}>
          {digits.map((d, i) => (
            // alive:allow case OTP à un chiffre (saisie/collage/navigation clavier spécialisés), déjà vivante via .otp-box[data-filled] ; Input imposerait hauteur et padding de champ
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={fill(dict.a11y.otpDigit, { n: i + 1 })}
              data-filled={d ? "" : undefined}
              className="otp-box tnum h-16 w-full min-w-0 rounded-field border-2 border-transparent bg-tile text-center text-[24px] font-bold text-ink transition-[border-color,background-color] focus:border-ink focus:bg-surface focus:outline-none"
              maxLength={LONGUEUR}
            />
          ))}
        </OtpGrid>

        {state.status === "error" ? (
          state.code === "UNAUTHENTICATED" ? (
            <p key={echecs} className="animate-in-up text-[13px] text-danger" role="alert">{dict.auth.otpInvalid}</p>
          ) : (
            <FormAlert state={state} />
          )
        ) : null}

        <SubmitButton size="lg" className="w-full" disabled={code.length !== LONGUEUR}>
          {dict.auth.signIn}
        </SubmitButton>
      </form>

      <form action={resendAction} className="mt-6 text-center">
        <input type="hidden" name="telephone" value={telephone} />
        {countdown > 0 ? (
          <p className="tnum text-[14px] text-soft">{fill(dict.auth.otpResendIn, { s: countdown })}</p>
        ) : (
          // alive:allow lien textuel « renvoyer le code » (style .link) : SubmitButton n'a pas de variante lien et la page publique doit rester légère
          <button type="submit" className="link text-[14px]">
            {dict.auth.otpResend}
          </button>
        )}
        {resendState.status === "error" ? (
          <p className="mt-1 text-[13px] text-danger">{dict.auth.rateLimitedGeneric}</p>
        ) : null}
      </form>

      <p className="mt-6 text-center">
        <Link
          href={`/${locale}/connexion`}
          className="text-[14px] font-semibold text-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {dict.auth.otpChangeNumber}
        </Link>
      </p>
    </div>
  );
}

/**
 * Grille des 6 cases (toujours LTR : un code se lit de gauche à droite). Pendant la
 * vérification, une vague parcourt les cases ; à chaque échec, la grille tremble.
 */
function OtpGrid({ echecs, children }: { echecs: number; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <div
      key={echecs}
      className={`otp-wave grid grid-cols-6 gap-2 ${echecs > 0 ? "animate-shake" : ""}`}
      data-pending={pending ? "" : undefined}
      dir="ltr"
    >
      {children}
    </div>
  );
}
