"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button, ButtonLink } from "../../../../../components/ui/button";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
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
  const [open, setOpen] = useState(ouvertInitialement);
  const [state, action] = useActionState(genererAppelDeFonds, IDLE);
  const router = useRouter();
  const f = dict.finances;

  // Succès → aller directement au détail du nouvel appel.
  useEffect(() => {
    if (state.status === "success") {
      const { id } = state.data as { id: string };
      router.push(`/${locale}/finances/appels-de-fonds/${id}`);
    }
  }, [state, router, locale]);

  const moisProchain = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconCoins width={16} height={16} />
        {f.genererAppel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={f.genererAppel} closeLabel={dict.common.close}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />

          {budgetActifManquant ? (
            <Banner
              variant="warn"
              title={f.budgetActifRequis}
              action={
                <ButtonLink href={`/${locale}/finances/budgets`} variant="secondary" size="sm">
                  {f.creerBudgetDabord}
                </ButtonLink>
              }
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={f.periode}
              htmlFor="periode"
              hint={f.periodeAide}
              required
              error={fieldError(state, "periode")}
            >
              <Input
                id="periode"
                name="periode"
                type="month"
                dir="ltr"
                defaultValue={moisProchain}
                required
                className="tnum text-start"
              />
            </Field>
            <Field label={f.typeAppel} htmlFor="type" required>
              <Select id="type" name="type" defaultValue="CHARGES_COURANTES" required>
                {(Object.keys(dict.enums.typeAppel) as TypeAppelDeFonds[]).map((t) => (
                  <option key={t} value={t}>
                    {dict.enums.typeAppel[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={`${f.montantTotal} (${dict.common.mad})`}
              htmlFor="montant_total"
              required
              error={fieldError(state, "montant_total")}
            >
              <Input
                id="montant_total"
                name="montant_total"
                inputMode="decimal"
                dir="ltr"
                pattern="\d{1,12}([.]\d{1,2})?"
                required
                className="tnum text-start"
              />
            </Field>
            <Field label={f.echeance} htmlFor="date_echeance" required>
              <Input id="date_echeance" name="date_echeance" type="date" required />
            </Field>
          </div>

          <Banner variant="info">{f.montantReparti}</Banner>

          <FormAlert
            state={state}
            legalGateTitle={f.budgetActifRequis}
            legalGateAction={
              <ButtonLink href={`/${locale}/finances/budgets`} variant="secondary" size="sm">
                {f.creerBudgetDabord}
              </ButtonLink>
            }
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{f.genererAppel}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
