"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import { motDePasseOublie } from "../connexion/actions";

export function ForgotForm({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [state, action] = useActionState(motDePasseOublie, IDLE);
  const envoye = state.status === "success" ? ((state.data as { email?: string } | undefined)?.email ?? "") : null;

  if (envoye !== null) {
    return (
      <div role="status" aria-live="polite">
        <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{dict.auth.forgotSentTitle}</h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-body">{fill(dict.auth.forgotSentBody, { email: envoye })}</p>
        <Link href={`/${locale}/connexion`} className="link mt-7 inline-block text-[14px]">
          {dict.auth.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{dict.auth.forgotTitle}</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-soft">{dict.auth.forgotSubtitle}</p>
      <form action={action} className="mt-7 space-y-5" suppressHydrationWarning>
        <input type="hidden" name="locale" value={locale} />
        <Field label={dict.auth.emailLabel} htmlFor="email" required>
          <Input id="email" name="email" type="email" dir="ltr" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="nom@exemple.ma" className="h-12 text-start" autoFocus required />
        </Field>
        {state.status === "error" ? <FormAlert state={state} /> : null}
        <SubmitButton size="lg" className="w-full">
          {dict.auth.forgotSubmit}
        </SubmitButton>
      </form>
      <Link href={`/${locale}/connexion`} className="link mt-6 inline-block text-[14px]">
        {dict.auth.backToLogin}
      </Link>
    </div>
  );
}
