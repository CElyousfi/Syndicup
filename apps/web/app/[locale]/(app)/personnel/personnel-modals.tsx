"use client";

import { ActionModal } from "../../../../components/ui/action-modal";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { fieldError } from "../../../../lib/forms";
import { formKey, formValue } from "../../../../lib/form-values";
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
  const pe = dict.personnel;
  // Création de fiche = action majeure : écran de succès plein (Wise), la modale se ferme.
  return (
    <ActionModal
      action={creerPersonnel}
      title={pe.nouvelleFiche}
      closeLabel={dict.common.close}
      success={{ message: pe.ficheCreee, illustration: "ok-general" }}
      trigger={(open) => (
        <Button onClick={open}>
          <IconPlus width={16} height={16} />
          {pe.nouvelleFiche}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <Field label={dict.lots.utilisateur} htmlFor="pe_utilisateur" hint={pe.utilisateurAide} required error={fieldError(state, "utilisateur_id")}>
            <Input
              id="pe_utilisateur"
              name="utilisateur_id"
              dir="ltr"
              required
              pattern="[0-9a-fA-F-]{36}"
              className="font-mono text-[13px] text-start"
              placeholder="00000000-0000-0000-0000-000000000000"
              defaultValue={formValue(state, "utilisateur_id")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={pe.statut} htmlFor="pe_statut" required error={fieldError(state, "statut")}>
              <Select key={formKey(state, "statut")} id="pe_statut" name="statut" defaultValue={formValue(state, "statut", "PRESENT")} required>
                {(["PRESENT", "ABSENT", "REMPLACE"] as StatutPersonnel[]).map((s) => (
                  <option key={s} value={s}>
                    {dict.enums.statutPersonnel[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={pe.logement} htmlFor="pe_loge" hint={pe.logementAide} error={fieldError(state, "logement_lot_id")}>
              <Select key={formKey(state, "logement_lot_id")} id="pe_loge" name="logement_lot_id" defaultValue={formValue(state, "logement_lot_id")}>
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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{pe.nouvelleFiche}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
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
  const pe = dict.personnel;
  return (
    <ActionModal
      action={changerStatutPersonnel}
      title={pe.changerStatut}
      closeLabel={dict.common.close}
      success={{ message: pe.statutChange, closeAndToast: true }}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          {pe.changerStatut}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="personnel_id" value={personnelId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={pe.statut} htmlFor="cp_statut" required error={fieldError(state, "statut")}>
              <Select key={formKey(state, "statut")} id="cp_statut" name="statut" defaultValue={formValue(state, "statut", statutActuel)} required>
                {(["PRESENT", "ABSENT", "REMPLACE"] as StatutPersonnel[]).map((s) => (
                  <option key={s} value={s}>
                    {dict.enums.statutPersonnel[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={pe.logement} htmlFor="cp_loge" error={fieldError(state, "logement_lot_id")}>
              <Select key={formKey(state, "logement_lot_id")} id="cp_loge" name="logement_lot_id" defaultValue={formValue(state, "logement_lot_id", logementActuel ?? "")}>
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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{dict.common.save}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
  );
}
