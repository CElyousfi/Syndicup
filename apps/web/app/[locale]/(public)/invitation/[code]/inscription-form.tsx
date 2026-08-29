"use client";

/**
 * Inscription par invitation — un seul formulaire après le scan : email + mot de passe +
 * identité + langue → compte créé, rattaché à la copropriété qui a invité, session ouverte.
 */
import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, Input } from "../../../../../components/ui/field";
import { Segmented } from "../../../../../components/ui/tabs";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { inscrireParInvitation } from "../../../../../lib/actions/session-actions";

export function InscriptionForm({
  dict,
  locale,
  code,
}: {
  dict: Dict;
  locale: Locale;
  code: string;
}) {
  const [state, action] = useActionState(inscrireParInvitation, IDLE);
  const [langue, setLangue] = useState<"FR" | "AR">(locale === "ar" ? "AR" : "FR");
  const a = dict.auth;

  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="langue_preferee" value={langue} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.profil.prenom} htmlFor="ins_prenom" required error={fieldError(state, "prenom")}>
          <Input id="ins_prenom" name="prenom" required maxLength={100} autoComplete="given-name" className="h-12" />
        </Field>
        <Field label={dict.profil.nom} htmlFor="ins_nom" required error={fieldError(state, "nom")}>
          <Input id="ins_nom" name="nom" required maxLength={100} autoComplete="family-name" className="h-12" />
        </Field>
      </div>
      <Field label={a.emailLabel} htmlFor="ins_email" hint={a.inviteEmailAide} required error={fieldError(state, "email")}>
        <Input id="ins_email" name="email" type="email" dir="ltr" required autoComplete="email" className="h-12 text-start" />
      </Field>
      <Field
        label={a.passwordLabel}
        htmlFor="ins_mdp"
        hint={a.inviteMotDePasseAide}
        required
        error={fieldError(state, "mot_de_passe")}
      >
        <Input id="ins_mdp" name="mot_de_passe" type="password" dir="ltr" required minLength={8} autoComplete="new-password" className="h-12 text-start" />
      </Field>
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

      <FormAlert state={state} />

      <SubmitButton size="lg" className="w-full">
        {a.inviteCreerCompte}
      </SubmitButton>
      <p className="text-center text-[13px] text-soft">
        {a.inviteDejaCompte}{" "}
        <Link
          href={`/${locale}/connexion?next=${encodeURIComponent(`/invitation/${code}`)}`}
          className="font-medium text-action hover:underline"
        >
          {a.signIn}
        </Link>
      </p>
    </form>
  );
}
