"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Segmented } from "../../../../components/ui/tabs";
import { Field, Input } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import { demanderOtp, connexionEmail } from "./actions";
import { QrScannerButton } from "../../../../components/auth/qr-scanner";

export function LoginForm({
  dict,
  locale,
  next,
}: {
  dict: Dict;
  locale: Locale;
  next?: string;
}) {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [otpState, otpAction] = useActionState(demanderOtp, IDLE);
  const [emailState, emailAction] = useActionState(connexionEmail, IDLE);

  const rateLimited = (s: typeof otpState) =>
    s.status === "error" && s.code === "RATE_LIMITED"
      ? s.retryAfter
        ? fill(dict.auth.rateLimited, { s: s.retryAfter })
        : dict.auth.rateLimitedGeneric
      : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{dict.auth.loginTitle}</h1>
      <p className="mt-1 text-sm text-soft">{dict.auth.loginSubtitle}</p>

      <div className="card mt-6 p-5 sm:p-6">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "phone", label: dict.auth.tabPhone },
            { value: "email", label: dict.auth.tabEmail },
          ]}
        />

      {mode === "phone" ? (
        <form action={otpAction} className="mt-5 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Field
            label={dict.auth.phoneLabel}
            htmlFor="telephone"
            hint={dict.auth.phoneHint}
            error={fieldError(otpState, "telephone") ?? rateLimited(otpState)}
            required
          >
            <Input
              id="telephone"
              name="telephone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+212 6 00 00 00 00"
              className="h-12 text-start"
              required
            />
          </Field>
          {otpState.status === "error" &&
          otpState.code !== "VALIDATION_ERROR" &&
          otpState.code !== "RATE_LIMITED" ? (
            <FormAlert state={otpState} />
          ) : null}
          <SubmitButton size="lg" className="w-full">
            {dict.auth.sendCode}
          </SubmitButton>
        </form>
      ) : (
        <form action={emailAction} className="mt-5 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Field label={dict.auth.emailLabel} htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="nom@exemple.ma"
              className="h-12 text-start"
              required
            />
          </Field>
          <Field
            label={dict.auth.passwordLabel}
            htmlFor="mot_de_passe"
            error={
              emailState.status === "error" && emailState.code === "UNAUTHENTICATED"
                ? dict.auth.invalidCredentials
                : rateLimited(emailState)
            }
            required
          >
            <Input
              id="mot_de_passe"
              name="mot_de_passe"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              className="h-12 text-start"
              required
              minLength={8}
            />
          </Field>
          {emailState.status === "error" &&
          emailState.code !== "UNAUTHENTICATED" &&
          emailState.code !== "RATE_LIMITED" &&
          emailState.code !== "VALIDATION_ERROR" ? (
            <FormAlert state={emailState} />
          ) : null}
          <SubmitButton size="lg" className="w-full">
            {dict.auth.signIn}
          </SubmitButton>
        </form>
      )}
      </div>

      {/* Invité : scanner le QR de son invitation directement ici, ou saisir le code. */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <QrScannerButton
          locale={locale}
          labels={{
            scan: dict.auth.scanQr,
            hint: dict.auth.scanHint,
            denied: dict.auth.scanDenied,
            invalid: dict.auth.scanInvalid,
            insecure: dict.auth.scanInsecure,
            close: dict.common.close,
          }}
          className="w-full sm:w-auto"
        />
        <Link href={`/${locale}/invitation`} className="text-[13px] font-medium text-action hover:underline">
          {dict.auth.inviteEnterCode}
        </Link>
      </div>
    </div>
  );
}
