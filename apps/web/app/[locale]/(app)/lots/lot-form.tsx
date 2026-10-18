"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { Lot, StatutLot, TypeLot } from "../../../../lib/api/types";
import { creerLot, modifierLot } from "./actions";
import { formKey, formValue } from "../../../../lib/form-values";

export function LotForm({
  dict,
  locale,
  lot,
  lotsParents,
}: {
  dict: Dict;
  locale: Locale;
  /** Présent en mode édition. */
  lot?: Lot;
  lotsParents: Array<{ id: string; numero: string }>;
}) {
  const [state, action] = useActionState(lot ? modifierLot : creerLot, IDLE);

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-7">
      <input type="hidden" name="locale" value={locale} />
      {lot ? <input type="hidden" name="lot_id" value={lot.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={dict.lots.type} htmlFor="type_lot" required>
          <Select key={formKey(state, "type_lot")} id="type_lot" name="type_lot" defaultValue={formValue(state, "type_lot", lot?.typeLot ?? "APPARTEMENT")} required>
            {(Object.keys(dict.enums.typeLot) as TypeLot[]).map((t) => (
              <option key={t} value={t}>
                {dict.enums.typeLot[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={dict.lots.numero}
          htmlFor="numero"
          required
          error={fieldError(state, "numero")}
        >
          <Input id="numero" name="numero" defaultValue={formValue(state, "numero", lot?.numero ?? "")} required maxLength={20} />
        </Field>
        <Field label={dict.lots.batiment} htmlFor="batiment" hint={dict.lots.batimentAide} optionalLabel={dict.common.optional}>
          <Input id="batiment" name="batiment" defaultValue={formValue(state, "batiment", lot?.batiment ?? "")} maxLength={40} />
        </Field>
        <Field label={dict.lots.etage} htmlFor="etage" optionalLabel={dict.common.optional}>
          <Input
            id="etage"
            name="etage"
            type="number"
            defaultValue={formValue(state, "etage", lot?.etage ?? "")}
            min={-5}
            max={200}
          />
        </Field>
        <Field
          label={dict.lots.tantiemes}
          htmlFor="tantiemes"
          required
          error={fieldError(state, "tantiemes")}
        >
          <Input
            id="tantiemes"
            name="tantiemes"
            inputMode="decimal"
            dir="ltr"
            pattern="\d{1,12}([.,]\d{1,2})?"
            defaultValue={formValue(state, "tantiemes", lot?.tantiemes ?? "")}
            required
            className="tnum text-start"
          />
        </Field>
        <Field
          label={`${dict.lots.superficie} (m²)`}
          htmlFor="superficie"
          optionalLabel={dict.common.optional}
          error={fieldError(state, "superficie")}
        >
          <Input
            id="superficie"
            name="superficie"
            inputMode="decimal"
            dir="ltr"
            pattern="\d{1,8}([.,]\d{1,2})?"
            defaultValue={formValue(state, "superficie", lot?.superficie ?? "")}
            className="tnum text-start"
          />
        </Field>
        <Field label={dict.lots.typeUsage} htmlFor="type_usage" optionalLabel={dict.common.optional}>
          <Select key={formKey(state, "type_usage")} id="type_usage" name="type_usage" defaultValue={formValue(state, "type_usage", lot?.typeUsage ?? "")}>
            <option value="">{dict.common.none}</option>
            {(Object.keys(dict.lots.usages) as Array<keyof Dict["lots"]["usages"]>).map((u) => (
              <option key={u} value={u}>
                {dict.lots.usages[u]}
              </option>
            ))}
          </Select>
        </Field>
        {lot ? (
          <Field label={dict.lots.statut} htmlFor="statut">
            <Select key={formKey(state, "statut")} id="statut" name="statut" defaultValue={formValue(state, "statut", lot.statut)}>
              {(Object.keys(dict.enums.statutLot) as StatutLot[]).map((s) => (
                <option key={s} value={s}>
                  {dict.enums.statutLot[s]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field
          label={dict.lots.lotParent}
          htmlFor="lot_parent_id"
          hint={dict.lots.lotParentAide}
          optionalLabel={dict.common.optional}
        >
          <Select key={formKey(state, "lot_parent_id")} id="lot_parent_id" name="lot_parent_id" defaultValue={formValue(state, "lot_parent_id", lot?.lotParentId ?? "")}>
            <option value="">{dict.common.none}</option>
            {lotsParents
              .filter((lp) => lp.id !== lot?.id)
              .map((lp) => (
                <option key={lp.id} value={lp.id}>
                  {lp.numero}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      <FormAlert state={state} />

      <div className="flex justify-end gap-2 border-t border-wash-strong pt-5">
        <SubmitButton>{lot ? dict.common.save : dict.common.create}</SubmitButton>
      </div>
    </form>
  );
}
