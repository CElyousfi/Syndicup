"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "../../../../components/ui/field";
import { Checkbox } from "../../../../components/ui/toggle";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import { connexionEmail } from "./actions";
import { QrScannerButton } from "../../../../components/auth/qr-scanner";

/**
 * Connexion : e-mail + mot de passe, un seul chemin (l'OTP SMS a été retiré — oct. 2026).
 * « Rester connecté » prolonge le cookie de rafraîchissement à 90 jours au lieu de la session.
 */
export function LoginForm({ dict, locale, next }: { dict: Dict; locale: Locale; next?: string }) {
  const [state, action] = useActionState(connexionEmail, IDLE);

  const rateLimited =
    state.status === "error" && state.code === "RATE_LIMITED"
      ? state.retryAfter
        ? fill(dict.auth.rateLimited, { s: state.retryAfter })
        : dict.auth.rateLimitedGeneric
      : null;
  // 400 du serveur (e-mail mal formé, mot de passe trop court) : affiché SOUS le champ concerné,
  // dans la langue de l'écran — jamais masqué (les messages Zod du serveur sont en anglais).
  const invalide = state.status === "error" && state.code === "VALIDATION_ERROR" ? state.fields ?? {} : {};
  const erreurEmail = "email" in invalide ? dict.errors.local.emailInvalide : undefined;
  const erreurMdp = "mot_de_passe" in invalide ? dict.auth.passwordTooShort : undefined;
  const erreurGlobale =
    state.status === "error" && state.code === "VALIDATION_ERROR" && !erreurEmail && !erreurMdp
      ? dict.errors.codes.VALIDATION_ERROR.body
      : undefined;
  // E-mail renvoyé par le serveur après un échec (React réinitialise le formulaire) ; le mot de
  // passe, lui, n'est jamais renvoyé.
  const emailSaisi = state.status === "error" && typeof state.values?.email === "string" ? state.values.email : undefined;

  return (
    <div>
      <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{dict.auth.loginTitle}</h1>
      <p className="mt-2 text-[15px] text-soft">{dict.auth.loginSubtitle}</p>

      <form action={action} className="mt-7 space-y-5" suppressHydrationWarning>
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label={dict.auth.emailLabel} htmlFor="email" required error={erreurEmail ?? erreurGlobale}>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nom@exemple.ma"
            className="h-12 text-start"
            defaultValue={emailSaisi}
            autoFocus
            required
          />
        </Field>
        <Field
          label={dict.auth.passwordLabel}
          htmlFor="mot_de_passe"
          error={state.status === "error" && state.code === "UNAUTHENTICATED" ? dict.auth.invalidCredentials : rateLimited ?? erreurMdp}
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

        <div className="flex items-center justify-between gap-4">
          <Checkbox name="rester" value="1" defaultChecked label={dict.auth.rememberMe} className="text-[14px] text-body" />
          <Link href={`/${locale}/mot-de-passe-oublie`} className="link text-[14px]">
            {dict.auth.forgotPassword}
          </Link>
        </div>

        {state.status === "error" && state.code !== "UNAUTHENTICATED" && state.code !== "RATE_LIMITED" && state.code !== "VALIDATION_ERROR" ? (
          <FormAlert state={state} />
        ) : null}
        <SubmitButton size="lg" className="w-full">
          {dict.auth.signIn}
        </SubmitButton>
      </form>

      {/* Invité : scanner le QR de son invitation directement ici, ou saisir le code. */}
      <div className="mt-6 flex flex-col items-stretch gap-4">
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
          size="lg"
          className="w-full"
        />
        <Link href={`/${locale}/invitation`} className="link self-center text-[14px]">
          {dict.auth.inviteEnterCode}
        </Link>
      </div>
    </div>
  );
}
