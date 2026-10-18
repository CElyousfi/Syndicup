"use client";

import { ActionModal } from "../ui/action-modal";
import { Field, Textarea } from "../ui/field";
import { FormAlert, SubmitButton } from "../ui/form";
import { Button } from "../ui/button";
import { Banner } from "../ui/banner";
import { fieldError } from "../../lib/forms";
import { formValue } from "../../lib/form-values";
import type { Dict, Locale } from "../../lib/i18n";
import { contesterLigne } from "../../app/[locale]/(app)/finances/actions";

/** D6 côté résident — contester une ligne de son solde. Le montant reste dû (mention légale). */
export function ContesterModal({
  dict,
  locale,
  appelDeFondsLotId,
}: {
  dict: Dict;
  locale: Locale;
  appelDeFondsLotId: string;
}) {
  // Contestation déposée = action majeure : écran de succès plein (Wise), la modale se referme.
  return (
    <ActionModal
      action={contesterLigne}
      title={dict.finances.contesterTitre}
      closeLabel={dict.common.close}
      success={{ message: dict.finances.contestationEnvoyee, corps: dict.finances.contesterMention, illustration: "ok-general" }}
      trigger={(open) => (
        <Button variant="ghost" size="sm" onClick={open}>
          {dict.finances.contester}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="appel_de_fonds_lot_id" value={appelDeFondsLotId} />
          <Field label={dict.finances.contesterMotif} htmlFor="motif" required error={fieldError(state, "motif")}>
            <Textarea id="motif" name="motif" required minLength={3} maxLength={2000} defaultValue={formValue(state, "motif")} />
          </Field>
          <Banner variant="info">{dict.finances.contesterMention}</Banner>
          <FormAlert state={state} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dict.common.close}
            </Button>
            <SubmitButton>{dict.finances.contester}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
  );
}
