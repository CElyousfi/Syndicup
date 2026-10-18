"use client";

import { useActionState } from "react";
import { ActionModal } from "../../../../components/ui/action-modal";
import { ConfirmAction } from "../../../../components/ui/confirm-action";
import { IrreversibleNotice } from "../../../../components/ui/irreversible-notice";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { MoneyInput } from "../../../../components/ui/money-input";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button, ButtonLink } from "../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../lib/forms";
import { formKey, formValue } from "../../../../lib/form-values";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { ContratDetail, ContratEcheance, TypeEcheance } from "../../../../lib/api/types";
import { formatDate, formatMAD } from "../../../../lib/format";
import { IconPlus } from "../../../../components/ui/icons";
import { activerContrat, suspendreContrat, resilierContrat, regenererEcheances, ajouterEcheance, modifierEcheance, genererDepense } from "./actions";

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.close}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}

type Props = { dict: Dict; locale: Locale; contrat: ContratDetail };

export function ActiverModal({ dict, locale, contrat }: Props) {
  const c = dict.contrats;
  return (
    <ActionModal
      action={activerContrat}
      title={c.activerTitre}
      subtitle={contrat.libelle}
      closeLabel={dict.common.close}
      success={{ message: c.active }}
      trigger={(open) => <Button onClick={open}>{c.activer}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
          <p className="text-sm text-body">{c.activerCorps}</p>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={c.activer} />
        </form>
      )}
    </ActionModal>
  );
}

export function SuspendreModal({ dict, locale, contrat }: Props) {
  const c = dict.contrats;
  return (
    <ActionModal
      action={suspendreContrat}
      title={c.suspendreTitre}
      subtitle={contrat.libelle}
      closeLabel={dict.common.close}
      success={{ message: c.suspendu, closeAndToast: true }}
      trigger={(open) => <Button variant="secondary" onClick={open}>{c.suspendre}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
          <p className="text-sm text-body">{c.suspendreCorps}</p>
          <Field label={c.motif} htmlFor="motif" optionalLabel={dict.common.optional} error={fieldError(state, "motif")}><Textarea id="motif" name="motif" rows={2} maxLength={1000} defaultValue={formValue(state, "motif")} /></Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={c.suspendre} />
        </form>
      )}
    </ActionModal>
  );
}

export function ResilierModal({ dict, locale, contrat }: Props) {
  const c = dict.contrats;
  return (
    <ActionModal
      action={resilierContrat}
      title={c.resilierTitre}
      subtitle={contrat.libelle}
      closeLabel={dict.common.close}
      success={{ message: c.resilie, closeAndToast: true }}
      trigger={(open) => <Button variant="dangerGhost" onClick={open}>{c.resilier}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
          <IrreversibleNotice>{c.resilierCorps}</IrreversibleNotice>
          <Field label={c.motif} htmlFor="motif_res" required error={fieldError(state, "motif")}><Textarea id="motif_res" name="motif" rows={3} required maxLength={1000} defaultValue={formValue(state, "motif")} /></Field>
          <Field label={c.dateResiliation} htmlFor="date_resiliation" optionalLabel={dict.common.optional} error={fieldError(state, "date_resiliation")}><Input id="date_resiliation" name="date_resiliation" type="date" dir="ltr" className="tnum text-start" defaultValue={formValue(state, "date_resiliation")} /></Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={c.resilierTitre} danger />
        </form>
      )}
    </ActionModal>
  );
}

export function RegenererBouton({ dict, locale, contrat }: Props) {
  const [state, action] = useActionState(regenererEcheances, IDLE);
  const c = dict.contrats;
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
      <SubmitButton variant="secondary" size="sm">{c.regenerer}</SubmitButton>
      {state.status === "success" ? <span className="text-[12px] text-ok">{c.regenere}</span> : null}
      {state.status === "error" ? <FormAlert state={state} /> : null}
    </form>
  );
}

export function AjouterEcheanceModal({ dict, locale, contrat }: Props) {
  const c = dict.contrats;
  const types: TypeEcheance[] = ["VISITE_TECHNIQUE", "CONTROLE_REGLEMENTAIRE", "PAIEMENT", "RENOUVELLEMENT", "AUTRE"];
  return (
    <ActionModal
      action={ajouterEcheance}
      title={c.ajouterEcheanceTitre}
      subtitle={contrat.libelle}
      closeLabel={dict.common.close}
      success={{ message: c.echeanceAjoutee }}
      trigger={(open) => <Button variant="secondary" size="sm" onClick={open}><IconPlus width={14} height={14} />{c.ajouterEcheance}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
          <Field label={c.typeEcheance} htmlFor="type_ech" required error={fieldError(state, "type")}><Select key={formKey(state, "type")} id="type_ech" name="type" required defaultValue={formValue(state, "type", "VISITE_TECHNIQUE")}>{types.map((t) => <option key={t} value={t}>{dict.enumsContrats.typeEcheance[t]}</option>)}</Select></Field>
          <Field label={c.dateEcheance} htmlFor="date_echeance" required error={fieldError(state, "date_echeance")}><Input id="date_echeance" name="date_echeance" type="date" required dir="ltr" className="tnum text-start" defaultValue={formValue(state, "date_echeance")} /></Field>
          <Field label={`${c.montant} (${dict.common.mad})`} htmlFor="montant_ech" optionalLabel={dict.common.optional} error={fieldError(state, "montant")}><MoneyInput id="montant_ech" name="montant" invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "montant")} /></Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={c.ajouterEcheance} />
        </form>
      )}
    </ActionModal>
  );
}

/** Actions d'une ligne d'échéance : créer la dépense, marquer réalisée, annuler (confirmée). */
export function EcheanceActions({ dict, locale, contrat, echeance }: Props & { echeance: ContratEcheance }) {
  const [stateM, actionM] = useActionState(modifierEcheance, IDLE);
  const c = dict.contrats;
  const f = dict.formulaires.confirmer;
  if (echeance.statut === "REALISEE" || echeance.statut === "ANNULEE") return null;
  if (stateM.status === "success") return <span className="text-[12px] text-ok">{c.echeanceMaj}</span>;
  const montantDefaut = echeance.montant ?? contrat.montantPeriode ?? "";
  return (
    <div className="flex min-w-[190px] flex-col items-end gap-1.5">
      {(echeance.statut === "A_VENIR" || echeance.statut === "MANQUEE") && echeance.type === "PAIEMENT" ? (
        <ActionModal
          action={genererDepense}
          title={c.genererDepenseTitre}
          subtitle={`${contrat.libelle} · ${formatDate(echeance.dateEcheance, locale)}`}
          closeLabel={dict.common.close}
          success={{
            message: c.depenseGeneree,
            next: (close, s) => {
              const id = (s.data as { depense_id?: string } | undefined)?.depense_id;
              return id ? <ButtonLink href={`/${locale}/finances/depenses/${id}`} onClick={close}>{c.voirDepense}</ButtonLink> : null;
            },
          }}
          trigger={(open) => <Button size="sm" onClick={open}>{c.genererDepense}</Button>}
        >
          {({ state: stateD, formAction, close }) => (
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} /><input type="hidden" name="echeance_id" value={echeance.id} />
              <p className="text-sm text-body">{c.genererDepenseCorps}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${dict.depenses.montantTtc} (${dict.common.mad})`} htmlFor="montant_ttc" required error={fieldError(stateD, "montant_ttc")}><MoneyInput id="montant_ttc" name="montant_ttc" required invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(stateD, "montant_ttc", montantDefaut)} /></Field>
                <Field label={dict.depenses.date} htmlFor="date_depense" required error={fieldError(stateD, "date_depense")}><Input id="date_depense" name="date_depense" type="date" required dir="ltr" defaultValue={formValue(stateD, "date_depense", echeance.dateEcheance.slice(0, 10))} className="tnum text-start" /></Field>
              </div>
              <Field label={dict.depenses.source} htmlFor="source" required error={fieldError(stateD, "source")}><Select key={formKey(stateD, "source")} id="source" name="source" defaultValue={formValue(stateD, "source", "COMPTE_COURANT")}><option value="COMPTE_COURANT">{dict.enumsDepenses.sourceFinancement.COMPTE_COURANT}</option><option value="FONDS_RESERVE">{dict.enumsDepenses.sourceFinancement.FONDS_RESERVE}</option></Select></Field>
              <FormAlert state={stateD} />
              <Pied dict={dict} onCancel={close} label={c.genererDepense} />
            </form>
          )}
        </ActionModal>
      ) : null}
      <form action={actionM} className="inline">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} /><input type="hidden" name="echeance_id" value={echeance.id} /><input type="hidden" name="statut" value="REALISEE" />
        <SubmitButton variant="secondary" size="sm">{c.marquerRealisee}</SubmitButton>
      </form>
      {echeance.statut === "A_VENIR" || echeance.statut === "MANQUEE" ? (
        <ConfirmAction
          action={modifierEcheance}
          fields={{ locale, contrat_id: contrat.id, echeance_id: echeance.id, statut: "ANNULEE" }}
          triggerLabel={c.annulerEcheance}
          title={f.echeanceAnnulerTitre}
          question={fill(f.echeanceAnnulerQuestion, { date: formatDate(echeance.dateEcheance, locale) })}
          consequence={f.echeanceAnnulerConsequence}
          confirmLabel={f.echeanceAnnulerConfirmer}
          closeLabel={dict.common.close}
          success={c.echeanceMaj}
        />
      ) : null}
      {stateM.status === "error" ? <FormAlert state={stateM} /> : null}
      {/* alive:allow texte réservé aux lecteurs d'écran (sr-only), jamais visible donc jamais animé */}
      <span className="sr-only">{formatMAD(echeance.montant, locale)}</span>
    </div>
  );
}
