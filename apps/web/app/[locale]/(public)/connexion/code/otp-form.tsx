"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{dict.auth.otpTitle}</h1>
      <p className="mt-1 text-sm text-soft">
        {fill(dict.auth.otpSubtitle, { telephone: formatTelephone(telephone) })}
      </p>

      <form ref={formRef} action={action} className="card mt-6 space-y-5 p-5 sm:p-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="telephone" value={telephone} />
        <input type="hidden" name="code" value={code} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div className="grid grid-cols-6 gap-1.5 sm:gap-2" dir="ltr">
          {digits.map((d, i) => (
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
              className="tnum h-14 w-full min-w-0 rounded-field border border-hairline-strong bg-surface text-center text-xl font-semibold text-ink transition-[border-color,box-shadow] focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15"
              maxLength={LONGUEUR}
            />
          ))}
        </div>

        {state.status === "error" ? (
          state.code === "UNAUTHENTICATED" ? (
            <p className="text-[13px] text-danger">{dict.auth.otpInvalid}</p>
          ) : (
            <FormAlert state={state} />
          )
        ) : null}

        <SubmitButton size="lg" className="w-full" disabled={code.length !== LONGUEUR}>
          {dict.auth.signIn}
        </SubmitButton>
      </form>

      <form action={resendAction} className="mt-5 text-center">
        <input type="hidden" name="telephone" value={telephone} />
        {countdown > 0 ? (
          <p className="text-[13px] text-faint">{fill(dict.auth.otpResendIn, { s: countdown })}</p>
        ) : (
          <button type="submit" className="text-[13px] font-medium text-action hover:underline">
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
          className="text-[13px] font-medium text-soft hover:text-ink-strong"
        >
          {dict.auth.otpChangeNumber}
        </Link>
      </p>
    </div>
  );
}
