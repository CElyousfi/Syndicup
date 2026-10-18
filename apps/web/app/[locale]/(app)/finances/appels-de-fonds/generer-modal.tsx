"use client";

import { useRouter } from "next/navigation";
import { ActionModal } from "../../../../../components/ui/action-modal";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { MoneyInput } from "../../../../../components/ui/money-input";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button, ButtonLink } from "../../../../../components/ui/button";
import { Banner } from "../../../../../components/ui/banner";
import { fieldError } from "../../../../../lib/forms";
import { formKey, formValue } from "../../../../../lib/form-values";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { TypeAppelDeFonds } from "../../../../../lib/api/types";
import { genererAppelDeFonds } from "../actions";
import { IconCoins } from "../../../../../components/ui/icons";

/** D2 — génération batch : la répartition au prorata des tantièmes est expliquée, pas cachée. */
export function GenererAppelModal({
  dict,
  locale,
  ouvertInitialement = false,
  budgetActifManquant,
}: {
  dict: Dict;
  locale: Locale;
  ouvertInitialement?: boolean;
  budgetActifManquant: boolean;
}) {
  const router = useRouter();
  const f = dict.finances;

  const moisProchain = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const lienBudget = (
    <ButtonLink href={`/${locale}/finances/budgets`} variant="secondary" size="sm">
      {f.creerBudgetDabord}
    </ButtonLink>
  );

  return (
    <ActionModal
      action={genererAppelDeFonds}
      title={f.genererAppel}
      closeLabel={dict.common.close}
      defaultOpen={ouvertInitialement}
      // Succès → toast puis détail du nouvel appel.
      success={{ message: dict.formulaires.succes.appelGenere, closeAndToast: true }}
      onSuccess={(s) => {
        const { id } = s.data as { id: string };
        router.push(`/${locale}/finances/appels-de-fonds/${id}`);
      }}
      trigger={(open) => (
        <Button onClick={open}>
          <IconCoins width={16} height={16} />
          {f.genererAppel}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />

          {budgetActifManquant ? <Banner variant="warn" title={f.budgetActifRequis} action={lienBudget} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.periode} htmlFor="periode" hint={f.periodeAide} required error={fieldError(state, "periode")}>
              <Input id="periode" name="periode" type="month" dir="ltr" defaultValue={formValue(state, "periode", moisProchain)} required className="tnum text-start" />
            </Field>
            <Field label={f.typeAppel} htmlFor="type" required error={fieldError(state, "type")}>
              <Select key={formKey(state, "type")} id="type" name="type" defaultValue={formValue(state, "type", "CHARGES_COURANTES")} required>
                {(Object.keys(dict.enums.typeAppel) as TypeAppelDeFonds[]).map((t) => (
                  <option key={t} value={t}>
                    {dict.enums.typeAppel[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${f.montantTotal} (${dict.common.mad})`} htmlFor="montant_total" required hint={dict.formulaires.montantAide} error={fieldError(state, "montant_total")}>
              <MoneyInput id="montant_total" name="montant_total" required invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "montant_total")} />
            </Field>
            <Field label={f.echeance} htmlFor="date_echeance" required error={fieldError(state, "date_echeance")}>
              <Input id="date_echeance" name="date_echeance" type="date" dir="ltr" required defaultValue={formValue(state, "date_echeance")} className="tnum text-start" />
            </Field>
          </div>

          <Banner variant="info">{f.montantReparti}</Banner>

          <FormAlert state={state} legalGateTitle={f.budgetActifRequis} legalGateAction={lienBudget} />

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{f.genererAppel}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
  );
}
