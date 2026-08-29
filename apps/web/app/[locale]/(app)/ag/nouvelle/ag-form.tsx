"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { TypeAg } from "../../../../../lib/api/types";
import { creerAg } from "../actions";

export function AgForm({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [state, action] = useActionState(creerAg, IDLE);

  return (
    <form action={action} className="card max-w-xl space-y-5 p-5 sm:p-7">
      <input type="hidden" name="locale" value={locale} />
      <Field label={dict.ag.type} htmlFor="type" required>
        <Select id="type" name="type" defaultValue="ORDINAIRE" required>
          {(Object.keys(dict.enums.typeAg) as TypeAg[]).map((t) => (
            <option key={t} value={t}>
              {dict.enums.typeAg[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={dict.ag.date} htmlFor="date_ag" required error={fieldError(state, "date_ag")}>
        <Input id="date_ag" name="date_ag" type="datetime-local" required />
      </Field>
      <p className="text-[13px] leading-relaxed text-soft">{dict.ag.aucuneResolutionAide}</p>
      <FormAlert state={state} />
      <div className="flex justify-end border-t border-hairline pt-5">
        <SubmitButton className="w-full sm:w-auto">{dict.common.create}</SubmitButton>
      </div>
    </form>
  );
}
