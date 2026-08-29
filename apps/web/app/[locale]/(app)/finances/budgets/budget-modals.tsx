"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import type { BudgetAg } from "../../../../../lib/api/types";
import { creerBudget, modifierBudget, activerBudget } from "../actions";
import { IconPlus } from "../../../../../components/ui/icons";

interface AgOption {
  id: string;
  libelle: string;
}

export function CreerBudgetModal({
  dict,
  locale,
  ags,
  exerciceSuggere,
}: {
  dict: Dict;
  locale: Locale;
  ags: AgOption[];
  exerciceSuggere: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerBudget, IDLE);
  const f = dict.finances;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {f.creerBudget}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={f.creerBudget} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <SuccesFermeture dict={dict} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={f.exercice} htmlFor="exercice" required error={fieldError(state, "exercice")}>
                <Input
                  id="exercice"
                  name="exercice"
                  dir="ltr"
                  pattern="\d{4}"
                  defaultValue={exerciceSuggere}
                  required
                  className="tnum text-start"
                />
              </Field>
              <Field
                label={`${f.montantVote} (${dict.common.mad})`}
                htmlFor="montant_total"
                hint={f.montantAide}
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
            </div>
            <Field label={f.agLiee} htmlFor="ag_id" optionalLabel={dict.common.optional}>
              <Select id="ag_id" name="ag_id" defaultValue="">
                <option value="">{dict.common.none}</option>
                {ags.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.libelle}
                  </option>
                ))}
              </Select>
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={dict.common.create} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function ModifierBudgetModal({
  dict,
  locale,
  budget,
  ags,
}: {
  dict: Dict;
  locale: Locale;
  budget: BudgetAg;
  ags: AgOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(modifierBudget, IDLE);
  const f = dict.finances;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {dict.common.modify}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={f.modifierBudget} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <SuccesFermeture dict={dict} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="budget_id" value={budget.id} />
            <Field label={`${f.montantVote} (${dict.common.mad})`} htmlFor="m_montant_total" required>
              <Input
                id="m_montant_total"
                name="montant_total"
                inputMode="decimal"
                dir="ltr"
                pattern="\d{1,12}([.]\d{1,2})?"
                defaultValue={budget.montantTotal}
                required
                className="tnum text-start"
              />
            </Field>
            <Field label={f.agLiee} htmlFor="m_ag_id" optionalLabel={dict.common.optional}>
              <Select id="m_ag_id" name="ag_id" defaultValue={budget.agId ?? ""}>
                <option value="">{dict.common.none}</option>
                {ags.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.libelle}
                  </option>
                ))}
              </Select>
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={dict.common.save} />
          </form>
        )}
      </Modal>
    </>
  );
}

/** Activation — ConfirmDialog : un budget ACTIF du même exercice passera REMPLACE. */
export function ActiverBudgetModal({
  dict,
  locale,
  budget,
}: {
  dict: Dict;
  locale: Locale;
  budget: BudgetAg;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(activerBudget, IDLE);
  const f = dict.finances;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {f.activerBudget}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={fill(f.activerBudgetTitre, { exercice: budget.exercice })}
        closeLabel={dict.common.close}
      >
        {state.status === "success" ? (
          <SuccesFermeture dict={dict} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="budget_id" value={budget.id} />
            <IrreversibleNotice>
              {fill(f.activerBudgetCorps, { exercice: budget.exercice })}
            </IrreversibleNotice>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={f.activerBudget} danger />
          </form>
        )}
      </Modal>
    </>
  );
}

function SuccesFermeture({ dict, onClose }: { dict: Dict; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-strong">{dict.common.updated}</p>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {dict.common.close}
        </Button>
      </div>
    </div>
  );
}

function Pied({
  dict,
  onCancel,
  label,
  danger = false,
}: {
  dict: Dict;
  onCancel: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="secondary" onClick={onCancel}>
        {dict.common.cancel}
      </Button>
      <SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton>
    </div>
  );
}
