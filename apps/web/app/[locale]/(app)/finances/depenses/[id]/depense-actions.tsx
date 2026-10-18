"use client";

import { useActionState, useState } from "react";
import { ActionModal } from "../../../../../../components/ui/action-modal";
import { IrreversibleNotice } from "../../../../../../components/ui/irreversible-notice";
import { Field, Input, Select, Textarea } from "../../../../../../components/ui/field";
import { MoneyInput } from "../../../../../../components/ui/money-input";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import { formValue } from "../../../../../../lib/form-values";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import type { DepenseDetail, StatutFacture } from "../../../../../../lib/api/types";
import { formatMAD } from "../../../../../../lib/format";
import { IconCamera, IconPlus } from "../../../../../../components/ui/icons";
import { soumettreDepense, approuverDepense, rejeterDepense, payerDepense, annulerDepense, ajouterFacture, changerStatutFacture } from "../actions";

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onCancel}>{dict.common.close}</Button>
      <SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton>
    </div>
  );
}

type Props = { dict: Dict; locale: Locale; depense: DepenseDetail };

export function SoumettreModal({ dict, locale, depense }: Props) {
  const d = dict.depenses;
  return (
    <ActionModal
      action={soumettreDepense}
      title={d.soumettreTitre}
      subtitle={depense.libelle}
      closeLabel={dict.common.close}
      success={{ message: d.soumise }}
      trigger={(open) => <Button onClick={open}>{d.soumettre}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="depense_id" value={depense.id} />
          <p className="text-sm text-body">{d.soumettreCorps}</p>
          {depense.seuil_non_configure ? <p className="text-[13px] text-soft">{d.seuilNonConfigureCorps}</p> : null}
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={d.soumettre} />
        </form>
      )}
    </ActionModal>
  );
}

export function DeciderModals({ dict, locale, depense }: Props) {
  const d = dict.depenses;
  const montant = formatMAD(depense.montantTtc, locale);
  return (
    <>
      <ActionModal
        action={approuverDepense}
        title={d.approuverTitre}
        subtitle={depense.libelle}
        closeLabel={dict.common.close}
        success={{ message: d.approuvee }}
        trigger={(open) => <Button onClick={open}>{d.approuver}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <p className="text-sm text-body">{fill(d.approuverCorps, { libelle: depense.libelle, montant })}</p>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={d.approuver} />
          </form>
        )}
      </ActionModal>
      {/* Rejet : décision horodatée au journal de la dépense — motif + avertissement. */}
      <ActionModal
        action={rejeterDepense}
        title={d.rejeterTitre}
        subtitle={depense.libelle}
        closeLabel={dict.common.close}
        success={{ message: d.rejetee, closeAndToast: true }}
        trigger={(open) => <Button variant="dangerGhost" onClick={open}>{d.rejeter}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <Field label={d.rejeterMotif} htmlFor="motif_rejet" hint={d.rejeterMotifAide} required error={fieldError(state, "motif")}>
              <Textarea id="motif_rejet" name="motif" rows={3} required maxLength={1000} defaultValue={formValue(state, "motif")} />
            </Field>
            <IrreversibleNotice>{dict.formulaires.confirmer.depenseRejeterConsequence}</IrreversibleNotice>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={d.rejeterTitre} danger />
          </form>
        )}
      </ActionModal>
    </>
  );
}

export function PayerModal({ dict, locale, depense }: Props) {
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  const [methode, setMethode] = useState<"VIREMENT" | "CHEQUE" | "ESPECES">("VIREMENT");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  // Dépense payée = paiement enregistré : écran de succès plein (Wise), la modale se referme.
  return (
    <ActionModal
      action={payerDepense}
      title={d.payerTitre}
      subtitle={`${depense.libelle} · ${formatMAD(depense.montantTtc, locale)}`}
      closeLabel={dict.common.close}
      success={{
        message: d.payee,
        corps: (s) => ((s.data as { source?: string } | undefined)?.source === "FONDS_RESERVE" ? d.payeeReserve : undefined),
        illustration: "ok-paiement",
        moment: "justified",
      }}
      trigger={(open) => <Button onClick={open}>{d.payer}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="depense_id" value={depense.id} />
          <p className="text-sm text-body">{d.payerCorps}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.methode} htmlFor="methode" required>
              <Select id="methode" name="methode" required value={methode} onChange={(ev) => setMethode(ev.target.value as typeof methode)}>
                {(Object.keys(e.methodePaiementDepense) as Array<keyof typeof e.methodePaiementDepense>).map((m) => (
                  <option key={m} value={m}>{e.methodePaiementDepense[m]}</option>
                ))}
              </Select>
            </Field>
            <Field label={d.datePaiement} htmlFor="date_paiement" required error={fieldError(state, "date_paiement")}>
              <Input id="date_paiement" name="date_paiement" type="date" required dir="ltr" defaultValue={formValue(state, "date_paiement", aujourdhui)} className="tnum text-start" />
            </Field>
          </div>
          <Field label={d.reference} htmlFor="reference" hint={d.referenceAide} required={methode !== "ESPECES"} optionalLabel={methode === "ESPECES" ? dict.common.optional : undefined} error={fieldError(state, "reference")}>
            <Input id="reference" name="reference" dir="ltr" required={methode !== "ESPECES"} maxLength={120} className="text-start" defaultValue={formValue(state, "reference")} />
          </Field>
          <Field label={d.justificatif} htmlFor="justificatif" hint={d.justificatifAide} optionalLabel={dict.common.optional} error={fieldError(state, "justificatif")}>
            <div className="flex flex-wrap gap-2">
              <label className="su-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-btn border-[1.5px] border-link px-4 text-[13px] font-semibold text-link transition-colors hover:bg-action-wash has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action">
                <IconCamera width={16} height={16} />
                {d.prendrePhoto}
                <input type="file" name="justificatif" accept="image/*" capture="environment" className="sr-only" />
              </label>
              <label className="su-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-btn border-[1.5px] border-link px-4 text-[13px] font-semibold text-link transition-colors hover:bg-action-wash has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action">
                <IconPlus width={16} height={16} />
                {d.choisirFichier}
                <input id="justificatif" type="file" name="justificatif" accept="image/*,application/pdf" className="sr-only" />
              </label>
            </div>
          </Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={d.payer} />
        </form>
      )}
    </ActionModal>
  );
}

export function AnnulerModal({ dict, locale, depense }: Props) {
  const d = dict.depenses;
  return (
    <ActionModal
      action={annulerDepense}
      title={d.annulerTitre}
      subtitle={depense.libelle}
      closeLabel={dict.common.close}
      success={{ message: d.annulee, closeAndToast: true }}
      trigger={(open) => <Button variant="dangerGhost" onClick={open}>{d.annuler}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="depense_id" value={depense.id} />
          <IrreversibleNotice>{d.annulerCorps}</IrreversibleNotice>
          <Field label={d.annulerMotif} htmlFor="motif_annulation" error={fieldError(state, "motif")}>
            <Textarea id="motif_annulation" name="motif" rows={2} maxLength={1000} defaultValue={formValue(state, "motif")} />
          </Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={d.annuler} danger />
        </form>
      )}
    </ActionModal>
  );
}

export function AjouterFactureModal({ dict, locale, depense }: Props) {
  const d = dict.depenses;
  return (
    <ActionModal
      action={ajouterFacture}
      title={d.ajouterFacture}
      subtitle={depense.libelle}
      closeLabel={dict.common.close}
      success={{ message: d.factureAjoutee }}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          <IconPlus width={16} height={16} />
          {d.ajouterFacture}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="depense_id" value={depense.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.numeroFacture} htmlFor="f_numero" optionalLabel={dict.common.optional} error={fieldError(state, "numero")}>
              <Input id="f_numero" name="numero" dir="ltr" maxLength={80} className="text-start" defaultValue={formValue(state, "numero")} />
            </Field>
            <Field label={`${d.montantTtc} (${dict.common.mad})`} htmlFor="f_montant" required error={fieldError(state, "montant_ttc")}>
              <MoneyInput id="f_montant" name="montant_ttc" required invalidMessage={dict.formulaires.montantInvalide} ambiguousMessage={dict.formulaires.montantAmbigu} orLabel={dict.formulaires.ou} defaultValue={formValue(state, "montant_ttc", depense.montantTtc)} />
            </Field>
            <Field label={d.dateFacture} htmlFor="f_date" required error={fieldError(state, "date_facture")}>
              <Input id="f_date" name="date_facture" type="date" required dir="ltr" defaultValue={formValue(state, "date_facture", depense.dateDepense.slice(0, 10))} className="tnum text-start" />
            </Field>
            <Field label={d.dateEcheance} htmlFor="f_echeance" optionalLabel={dict.common.optional} error={fieldError(state, "date_echeance")}>
              <Input id="f_echeance" name="date_echeance" type="date" dir="ltr" className="tnum text-start" defaultValue={formValue(state, "date_echeance")} />
            </Field>
          </div>
          <Field label={d.fichierFacture} htmlFor="f_fichier" required error={fieldError(state, "fichier")}>
            <Input id="f_fichier" name="fichier" type="file" required accept="image/*,application/pdf" className="file:me-3 file:rounded-btn file:border-0 file:bg-action-tint file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-action" />
          </Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={d.ajouterFacture} />
        </form>
      )}
    </ActionModal>
  );
}

/** Statut d'une facture : changement réversible (vérifiée ↔ contestée), annoncé en toast. */
export function StatutFactureForm({ dict, locale, depenseId, factureId, statut }: { dict: Dict; locale: Locale; depenseId: string; factureId: string; statut: StatutFacture }) {
  const [state, action] = useActionState(changerStatutFacture, IDLE);
  const d = dict.depenses;
  const cibles: Array<{ statut: StatutFacture; label: string; variant?: "secondary" | "dangerGhost" | "ghost" }> = [];
  if (statut === "RECUE") cibles.push({ statut: "VERIFIEE", label: d.marquerVerifiee, variant: "secondary" });
  if (statut !== "CONTESTEE" && statut !== "REGLEE") cibles.push({ statut: "CONTESTEE", label: d.marquerContestee, variant: "dangerGhost" });
  if (statut === "CONTESTEE") cibles.push({ statut: "VERIFIEE", label: d.marquerVerifiee, variant: "secondary" });
  if (statut !== "REGLEE") cibles.push({ statut: "REGLEE", label: d.marquerReglee, variant: "ghost" });
  if (cibles.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {cibles.map((c) => (
        <form key={c.statut} action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="depense_id" value={depenseId} />
          <input type="hidden" name="facture_id" value={factureId} />
          <input type="hidden" name="statut" value={c.statut} />
          <SubmitButton variant={c.variant ?? "ghost"} size="sm">{c.label}</SubmitButton>
        </form>
      ))}
      <FormAlert state={state} compact />
    </div>
  );
}
