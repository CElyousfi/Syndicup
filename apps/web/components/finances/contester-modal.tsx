"use client";

import { useActionState, useState } from "react";
import { Modal } from "../ui/modal";
import { Field, Textarea } from "../ui/field";
import { FormAlert, SubmitButton } from "../ui/form";
import { Button } from "../ui/button";
import { Banner } from "../ui/banner";
import { IDLE } from "../../lib/forms";
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(contesterLigne, IDLE);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {dict.finances.contester}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={dict.finances.contesterTitre}
        closeLabel={dict.common.close}
      >
        {state.status === "success" ? (
          <div className="space-y-4">
            <Banner variant="ok">{dict.finances.contestationEnvoyee}</Banner>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="appel_de_fonds_lot_id" value={appelDeFondsLotId} />
            <Field label={dict.finances.contesterMotif} htmlFor="motif" required>
              <Textarea id="motif" name="motif" required minLength={3} maxLength={2000} />
            </Field>
            <Banner variant="info">{dict.finances.contesterMention}</Banner>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.send}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
