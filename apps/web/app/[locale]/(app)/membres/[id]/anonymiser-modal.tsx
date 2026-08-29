"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../../components/ui/modal";
import { Checkbox } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { IDLE } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { anonymiserCompte } from "../../profil/actions";

/** J3 — anonymisation CNDP : double confirmation, texte légal explicite. */
export function AnonymiserModal({
  dict,
  locale,
  utilisateurId,
  desactive,
}: {
  dict: Dict;
  locale: Locale;
  utilisateurId: string;
  desactive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [state, action] = useActionState(anonymiserCompte, IDLE);
  const m = dict.membres;

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)} disabled={!desactive} title={desactive ? undefined : m.anonymiserRefus}>
        {m.anonymiser}
      </Button>
      {!desactive ? <p className="mt-2 text-[12px] text-faint">{m.anonymiserRefus}</p> : null}
      <Modal open={open} onClose={() => setOpen(false)} title={m.anonymiser} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-ink">{m.anonymise}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="utilisateur_id" value={utilisateurId} />
            <IrreversibleNotice>
              {m.anonymiserCorps}
              <span className="mt-1 block font-semibold">{dict.common.irreversible}</span>
            </IrreversibleNotice>
            <Checkbox
              checked={confirme}
              onChange={(e) => setConfirme(e.target.checked)}
              label={m.anonymiserConfirme}
            />
            <FormAlert state={state} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger" disabled={!confirme}>
                {m.anonymiser}
              </SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
