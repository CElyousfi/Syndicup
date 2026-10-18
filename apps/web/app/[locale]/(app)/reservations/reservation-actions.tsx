"use client";

import { useActionState } from "react";
import { Field, Textarea } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { annulerReservation, rejeterReservation, validerReservation } from "../espaces-communs/actions";
import { ActionModal } from "../../../../components/ui/action-modal";
import { formValue } from "../../../../lib/form-values";

export function ValiderForm({
  dict,
  locale,
  reservationId,
}: {
  dict: Dict;
  locale: Locale;
  reservationId: string;
}) {
  const [state, action] = useActionState(validerReservation, IDLE);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="reservation_id" value={reservationId} />
      <SubmitButton size="sm">{dict.espaces.valider}</SubmitButton>
      <FormAlert state={state} compact />
    </form>
  );
}

export function RejeterModal({
  dict,
  locale,
  reservationId,
}: {
  dict: Dict;
  locale: Locale;
  reservationId: string;
}) {
  const e = dict.espaces;
  return (
    <ActionModal
        action={rejeterReservation}
        title={e.rejeter}
        closeLabel={dict.common.close}
        success={{ message: e.reservationRejetee }}
        trigger={(open) => <Button variant="dangerGhost" size="sm" onClick={open}>
        {e.rejeter}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="reservation_id" value={reservationId} />
            <Field label={e.motifRejet} htmlFor="motif" hint={e.motifRejetAide} required>
              <Textarea id="motif" name="motif" required minLength={3} rows={3} defaultValue={formValue(state, "motif")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger">{e.rejeter}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}

export function AnnulerModal({
  dict,
  locale,
  reservationId,
}: {
  dict: Dict;
  locale: Locale;
  reservationId: string;
}) {
  const e = dict.espaces;
  return (
    <ActionModal
        action={annulerReservation}
        title={e.annulerReservation}
        closeLabel={dict.common.close}
        success={{ message: e.reservationAnnulee }}
        trigger={(open) => <Button variant="dangerGhost" size="sm" onClick={open}>
        {dict.common.cancel}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="reservation_id" value={reservationId} />
            <p className="text-sm text-body">{e.annulerReservationCorps}</p>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.back}
              </Button>
              <SubmitButton variant="danger">{e.annulerReservation}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}
