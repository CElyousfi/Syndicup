"use client";

/**
 * Acceptation d'une invitation : l'invité renseigne ses informations (prénom, nom, langue)
 * et accepte en un geste. Le code est à usage unique — le serveur refuse toute réutilisation.
 */
import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, Input } from "../../../../../components/ui/field";
import { Segmented } from "../../../../../components/ui/tabs";
import { SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { accepterInvitation } from "../../../../../lib/actions/session-actions";

export function AcceptForm({
  dict,
  locale,
  code,
}: {
  dict: Dict;
  locale: Locale;
  code: string;
}) {
  const [state, action] = useActionState(accepterInvitation, IDLE);
  const [langue, setLangue] = useState<"FR" | "AR">(locale === "ar" ? "AR" : "FR");

  const messageErreur =
    state.status === "error"
      ? state.code === "NOT_FOUND"
        ? dict.auth.inviteExpired
        : state.code === "CONFLICT" && /inscrit|utilis/i.test(state.message)
          ? dict.auth.inviteAlreadyUsed
          : state.message
      : null;

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="langue_preferee" value={langue} />

      <div>
        <p className="text-[13px] font-semibold text-ink">{dict.auth.inviteVosInfos}</p>
        <p className="mt-0.5 text-[13px] text-soft">{dict.auth.inviteVosInfosAide}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.profil.prenom} htmlFor="inv_prenom" required error={fieldError(state, "prenom")}>
          <Input id="inv_prenom" name="prenom" required maxLength={100} autoComplete="given-name" className="h-12" />
        </Field>
        <Field label={dict.profil.nom} htmlFor="inv_nom" required error={fieldError(state, "nom")}>
          <Input id="inv_nom" name="nom" required maxLength={100} autoComplete="family-name" className="h-12" />
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-ink-strong">{dict.profil.langue}</p>
        <Segmented
          value={langue}
          onChange={setLangue}
          options={[
            { value: "FR", label: dict.common.french },
            { value: "AR", label: dict.common.arabic },
          ]}
        />
      </div>

      {messageErreur ? (
        <Banner variant={state.status === "error" && state.code === "CONFLICT" ? "info" : "danger"}>
          {messageErreur}
          {state.status === "error" && state.code === "CONFLICT" ? (
            <Link href={`/${locale}/connexion`} className="mt-1 block font-medium text-action hover:underline">
              {dict.auth.signIn}
            </Link>
          ) : null}
        </Banner>
      ) : null}
      <SubmitButton size="lg" className="w-full">
        {dict.auth.inviteAccept}
      </SubmitButton>
    </form>
  );
}
