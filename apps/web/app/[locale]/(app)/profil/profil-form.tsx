"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { modifierProfil } from "./actions";

export function ProfilForm({
  dict,
  locale,
  nom,
  prenom,
  langue,
}: {
  dict: Dict;
  locale: Locale;
  nom: string;
  prenom: string;
  langue: "FR" | "AR";
}) {
  const [state, action] = useActionState(modifierProfil, IDLE);
  const pr = dict.profil;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={pr.prenom} htmlFor="prenom" error={fieldError(state, "prenom")}>
          <Input id="prenom" name="prenom" defaultValue={prenom} maxLength={100} />
        </Field>
        <Field label={pr.nom} htmlFor="nom" error={fieldError(state, "nom")}>
          <Input id="nom" name="nom" defaultValue={nom} maxLength={100} />
        </Field>
      </div>
      <Field label={pr.langue} htmlFor="langue_preferee" hint={pr.langueAide}>
        <Select id="langue_preferee" name="langue_preferee" defaultValue={langue}>
          <option value="FR">{dict.common.french}</option>
          <option value="AR">{dict.common.arabic}</option>
        </Select>
      </Field>
      <FormAlert state={state} successRender={() => <p className="text-[13px] font-medium text-ok">{pr.enregistre}</p>} />
      <div className="flex justify-end">
        <SubmitButton>{dict.common.save}</SubmitButton>
      </div>
    </form>
  );
}
