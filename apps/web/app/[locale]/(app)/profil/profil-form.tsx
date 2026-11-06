"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE, fieldError } from "../../../../lib/forms";
import { LANG_FLAGS, LANG_NAMES, LOCALES, type Dict, type Locale } from "../../../../lib/i18n/core";
import { modifierProfil } from "./actions";
import { formKey, formValue } from "../../../../lib/form-values";

export function ProfilForm({
  dict,
  locale,
  nom,
  prenom,
}: {
  dict: Dict;
  locale: Locale;
  nom: string;
  prenom: string;
}) {
  const [state, action] = useActionState(modifierProfil, IDLE);
  const pr = dict.profil;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={pr.prenom} htmlFor="prenom" error={fieldError(state, "prenom")}>
          <Input id="prenom" name="prenom" defaultValue={formValue(state, "prenom", prenom)} maxLength={100} />
        </Field>
        <Field label={pr.nom} htmlFor="nom" error={fieldError(state, "nom")}>
          <Input id="nom" name="nom" defaultValue={formValue(state, "nom", nom)} maxLength={100} />
        </Field>
      </div>
      {/* Toutes les langues de l'interface ; documents officiels et envois du serveur : FR ou AR. */}
      <Field label={pr.langue} htmlFor="langue_interface" hint={`${pr.langueAide} ${pr.langueDocuments}`}>
        <Select key={formKey(state, "langue_interface")} id="langue_interface" name="langue_interface" defaultValue={formValue(state, "langue_interface", locale)}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {`${LANG_FLAGS[l]} ${LANG_NAMES[l]}`}
            </option>
          ))}
        </Select>
      </Field>
      <FormAlert state={state} successRender={() => <p className="text-[13px] font-medium text-ok">{pr.enregistre}</p>} />
      <div className="flex justify-end">
        <SubmitButton>{dict.common.save}</SubmitButton>
      </div>
    </form>
  );
}
