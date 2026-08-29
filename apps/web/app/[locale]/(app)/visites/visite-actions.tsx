"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { enregistrerVisite, repondreVisite } from "./actions";
import { IconDoor } from "../../../../components/ui/icons";

/** H2 — l'action primaire du gardien : énorme, deux champs, zéro friction. */
export function EnregistrerVisiteModal({
  dict,
  locale,
  lots,
  ouvertInitialement = false,
  grand = false,
}: {
  dict: Dict;
  locale: Locale;
  lots: Array<{ id: string; numero: string }>;
  ouvertInitialement?: boolean;
  grand?: boolean;
}) {
  const [open, setOpen] = useState(ouvertInitialement);
  const [state, action] = useActionState(enregistrerVisite, IDLE);
  const v = dict.visites;

  return (
    <>
      <Button size={grand ? "lg" : "md"} onClick={() => setOpen(true)}>
        <IconDoor width={18} height={18} />
        {v.enregistrer}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={v.enregistrer} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <Banner variant="ok">{v.enregistree}</Banner>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <Field
              label={v.visiteurNom}
              htmlFor="visiteur_nom"
              required
              error={fieldError(state, "visiteur_nom")}
            >
              <Input id="visiteur_nom" name="visiteur_nom" required maxLength={200} autoFocus />
            </Field>
            <Field label={v.lotVisite} htmlFor="v_lot" required>
              <Select id="v_lot" name="lot_id" required>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.numero}
                  </option>
                ))}
              </Select>
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{v.enregistrer}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/** H3 — réponse du résident : une seule réponse possible, transmise au gardien. */
export function RepondreVisiteForm({
  dict,
  locale,
  visiteId,
}: {
  dict: Dict;
  locale: Locale;
  visiteId: string;
}) {
  const [state, action] = useActionState(repondreVisite, IDLE);
  const v = dict.visites;

  if (state.status === "success") {
    return <p className="text-[13px] font-medium text-ok">{v.reponseDonnee}</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="visite_id" value={visiteId} />
          <input type="hidden" name="statut" value="AUTORISE" />
          <SubmitButton size="sm">{v.autoriser}</SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="visite_id" value={visiteId} />
          <input type="hidden" name="statut" value="REFUSE" />
          <SubmitButton size="sm" variant="danger">
            {v.refuser}
          </SubmitButton>
        </form>
      </div>
      {state.status === "error" ? (
        <p className="text-[12px] text-danger">
          {state.code === "UNPROCESSABLE_ENTITY" ? v.dejaRepondu : state.message}
        </p>
      ) : (
        <p className="text-[11px] text-faint">{v.reponseUnique}</p>
      )}
    </div>
  );
}
