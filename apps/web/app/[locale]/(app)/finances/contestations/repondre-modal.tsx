"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../../components/ui/modal";
import { Field, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { IDLE } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { repondreContestation } from "../actions";

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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(repondreContestation, IDLE);
  const f = dict.finances;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {f.repondre}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={f.repondre} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{f.reponseEnvoyee}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="contestation_id" value={contestationId} />
            <blockquote className="rounded-xl border-s-2 border-hairline-strong bg-ground px-4 py-3 text-[13px] italic leading-relaxed text-body">
              {motif}
            </blockquote>
            <Field label={f.reponseStatut} htmlFor="statut" required>
              <Select id="statut" name="statut" defaultValue="REPONDUE" required>
                {(["REPONDUE", "MEDIEE", "TRIBUNAL"] as const).map((s) => (
                  <option key={s} value={s}>
                    {dict.enums.statutContestation[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.votreReponse} htmlFor="reponse_syndic" required>
              <Textarea id="reponse_syndic" name="reponse_syndic" required minLength={3} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2 pt-1">
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
