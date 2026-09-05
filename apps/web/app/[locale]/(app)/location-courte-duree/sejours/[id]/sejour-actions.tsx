"use client";

import { useActionState, useState } from "react";
import { IrreversibleNotice, Modal } from "../../../../../../components/ui/modal";
import { Field, Textarea } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { Banner } from "../../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import { annulerSejour } from "../../actions";

/** Annulation d'un séjour PREVU — confirmation explicite, motif facultatif, gardien notifié. */
export function AnnulerSejourModal({
  dict,
  locale,
  sejourId,
  voyageurNom,
}: {
  dict: Dict;
  locale: Locale;
  sejourId: string;
  voyageurNom: string;
}) {
  const l = dict.lcd;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(annulerSejour, IDLE);

  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>
        {l.annuler}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={l.annuler} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <Banner variant="ok">{l.annule}</Banner>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sejour_id" value={sejourId} />
            <p className="text-[15px] font-semibold text-ink">{fill(l.annulerQuestion, { nom: voyageurNom })}</p>
            <Field label={l.motifAnnulation} htmlFor="a_motif" optionalLabel={dict.common.optional} error={fieldError(state, "motif")}>
              <Textarea id="a_motif" name="motif" rows={3} maxLength={500} />
            </Field>
            <IrreversibleNotice>{l.annulerAide}</IrreversibleNotice>
            <FormAlert state={state} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger">{l.annuler}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
