"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { StatutPersonnel } from "../../../../lib/api/types";
import { changerStatutPersonnel, creerPersonnel } from "../visites/actions";
import { IconPlus } from "../../../../components/ui/icons";

export function CreerFicheModal({
  dict,
  locale,
  loges,
}: {
  dict: Dict;
  locale: Locale;
  loges: Array<{ id: string; numero: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerPersonnel, IDLE);
  const pe = dict.personnel;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {pe.nouvelleFiche}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.nouvelleFiche} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{pe.ficheCreee}</p>
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
              label={dict.lots.utilisateur}
              htmlFor="pe_utilisateur"
              hint={pe.utilisateurAide}
              required
            >
              <Input
                id="pe_utilisateur"
                name="utilisateur_id"
                dir="ltr"
                required
                pattern="[0-9a-fA-F-]{36}"
                className="font-mono text-[13px] text-start"
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={pe.statut} htmlFor="pe_statut" required>
                <Select id="pe_statut" name="statut" defaultValue="PRESENT" required>
                  {(["PRESENT", "ABSENT", "REMPLACE"] as StatutPersonnel[]).map((s) => (
                    <option key={s} value={s}>
                      {dict.enums.statutPersonnel[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={pe.logement} htmlFor="pe_loge" hint={pe.logementAide}>
                <Select id="pe_loge" name="logement_lot_id" defaultValue="">
                  <option value="">{pe.aucuneLoge}</option>
                  {loges.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.numero}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.create}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ChangerPresenceModal({
  dict,
  locale,
  personnelId,
  statutActuel,
  logementActuel,
  loges,
}: {
  dict: Dict;
  locale: Locale;
  personnelId: string;
  statutActuel: StatutPersonnel;
  logementActuel: string | null;
  loges: Array<{ id: string; numero: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(changerStatutPersonnel, IDLE);
  const pe = dict.personnel;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {pe.changerStatut}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.changerStatut} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{pe.statutChange}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="personnel_id" value={personnelId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={pe.statut} htmlFor="cp_statut" required>
                <Select id="cp_statut" name="statut" defaultValue={statutActuel} required>
                  {(["PRESENT", "ABSENT", "REMPLACE"] as StatutPersonnel[]).map((s) => (
                    <option key={s} value={s}>
                      {dict.enums.statutPersonnel[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={pe.logement} htmlFor="cp_loge">
                <Select id="cp_loge" name="logement_lot_id" defaultValue={logementActuel ?? ""}>
                  <option value="">{pe.aucuneLoge}</option>
                  {loges.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.numero}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.save}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
