"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Textarea } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import {
  annulerReservation,
  rejeterReservation,
  validerReservation,
} from "../espaces-communs/actions";

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
      {state.status === "error" ? (
        <p className="text-[12px] text-danger">{state.message}</p>
      ) : null}
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(rejeterReservation, IDLE);
  const e = dict.espaces;
  return (
    <>
      <Button variant="dangerGhost" size="sm" onClick={() => setOpen(true)}>
        {e.rejeter}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={e.rejeter} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{e.reservationRejetee}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="reservation_id" value={reservationId} />
            <Field label={e.motifRejet} htmlFor="motif" hint={e.motifRejetAide} required>
              <Textarea id="motif" name="motif" required minLength={3} rows={3} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger">{e.rejeter}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(annulerReservation, IDLE);
  const e = dict.espaces;
  return (
    <>
      <Button variant="dangerGhost" size="sm" onClick={() => setOpen(true)}>
        {dict.common.cancel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={e.annulerReservation} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{e.reservationAnnulee}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="reservation_id" value={reservationId} />
            <p className="text-sm text-body">{e.annulerReservationCorps}</p>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.back}
              </Button>
              <SubmitButton variant="danger">{e.annulerReservation}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
