"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { reinitialiserMotDePasse } from "../connexion/actions";

export function ResetForm({ dict, locale, tokenHash }: { dict: Dict; locale: Locale; tokenHash: string }) {
  const [state, action] = useActionState(reinitialiserMotDePasse, IDLE);
  const lienInvalide = !tokenHash || (state.status === "error" && state.code === "UNAUTHENTICATED");

  if (lienInvalide) {
    return (
      <div role="alert">
        <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{dict.auth.resetTitle}</h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-body">{dict.auth.resetInvalidLink}</p>
        <Link href={`/${locale}/mot-de-passe-oublie`} className="link mt-7 inline-block text-[14px]">
          {dict.auth.forgotTitle}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{dict.auth.resetTitle}</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-soft">{dict.auth.resetSubtitle}</p>
      <form action={action} className="mt-7 space-y-5" suppressHydrationWarning>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token_hash" value={tokenHash} />
        <Field label={dict.auth.newPasswordLabel} htmlFor="mot_de_passe" error={fieldError(state, "mot_de_passe")} required>
          <Input id="mot_de_passe" name="mot_de_passe" type="password" dir="ltr" autoComplete="new-password" className="h-12 text-start" minLength={8} autoFocus required />
        </Field>
        <Field label={dict.auth.confirmPasswordLabel} htmlFor="confirmation" error={fieldError(state, "confirmation")} required>
          <Input id="confirmation" name="confirmation" type="password" dir="ltr" autoComplete="new-password" className="h-12 text-start" minLength={8} required />
        </Field>
        {state.status === "error" && state.code !== "VALIDATION_ERROR" ? <FormAlert state={state} /> : null}
        <SubmitButton size="lg" className="w-full">
          {dict.auth.resetSubmit}
        </SubmitButton>
      </form>
    </div>
  );
}
