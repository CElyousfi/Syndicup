"use client";

import { Field, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { repondreContestation } from "../actions";
import { ActionModal } from "../../../../../components/ui/action-modal";
import { formKey, formValue } from "../../../../../lib/form-values";

export function RepondreModal({
  dict,
  locale,
  contestationId,
  motif,
}: {
  dict: Dict;
  locale: Locale;
  contestationId: string;
  motif: string;
}) {
  const f = dict.finances;

  return (
    <ActionModal
        action={repondreContestation}
        title={f.repondre}
        closeLabel={dict.common.close}
        success={{ message: f.reponseEnvoyee }}
        trigger={(open) => <Button variant="secondary" size="sm" onClick={open}>
        {f.repondre}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="contestation_id" value={contestationId} />
            <blockquote className="rounded-[18px] border-s-[3px] border-link bg-tile px-4 py-3 text-[14px] leading-relaxed text-body">
              {motif}
            </blockquote>
            <Field label={f.reponseStatut} htmlFor="statut" required>
              <Select key={formKey(state, "statut")} id="statut" name="statut" defaultValue={formValue(state, "statut", "REPONDUE")} required>
                {(["REPONDUE", "MEDIEE", "TRIBUNAL"] as const).map((s) => (
                  <option key={s} value={s}>
                    {dict.enums.statutContestation[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.votreReponse} htmlFor="reponse_syndic" required>
              <Textarea id="reponse_syndic" name="reponse_syndic" required minLength={3} defaultValue={formValue(state, "reponse_syndic")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.close}
              </Button>
              <SubmitButton>{dict.common.send}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}
