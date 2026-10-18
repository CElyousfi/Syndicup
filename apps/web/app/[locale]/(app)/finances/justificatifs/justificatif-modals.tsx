"use client";

import { useActionState, useState } from "react";
import { ActionModal } from "../../../../../components/ui/action-modal";
import { ConfirmAction } from "../../../../../components/ui/confirm-action";
import { IrreversibleNotice } from "../../../../../components/ui/irreversible-notice";
import { Field, Input, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../../lib/forms";
import { formValue } from "../../../../../lib/form-values";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import type { CompteBancaire, Justificatif } from "../../../../../lib/api/types";
import { formatMAD } from "../../../../../lib/format";
import { IconPlus } from "../../../../../components/ui/icons";
import { validerJustificatif, rejeterJustificatif, annulerJustificatif, remplacerComptes, lireRibCompte } from "./actions";

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.close}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}

export function ValiderModal({ dict, locale, justificatif }: { dict: Dict; locale: Locale; justificatif: Justificatif }) {
  const j = dict.justificatifs;
  // Validation = paiement encaissé : écran de succès plein (Wise), la modale se referme.
  return (
    <ActionModal
      action={validerJustificatif}
      title={j.validerTitre}
      subtitle={`${justificatif.lot?.numero ?? ""} · ${formatMAD(justificatif.montant, locale)}`}
      closeLabel={dict.common.close}
      success={{ message: j.valide, illustration: "ok-paiement", moment: "payment" }}
      trigger={(open) => <Button onClick={open}>{j.valider}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="justificatif_id" value={justificatif.id} />
          <p className="text-sm text-body">{j.validerCorps}</p>
          <Field label={j.dateValeur} htmlFor="date_valeur" hint={j.dateValeurAide} optionalLabel={dict.common.optional} error={fieldError(state, "date_valeur")}>
            <Input id="date_valeur" name="date_valeur" type="date" dir="ltr" defaultValue={formValue(state, "date_valeur", justificatif.datePaiementDeclaree.slice(0, 10))} className="tnum text-start" />
          </Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={j.valider} />
        </form>
      )}
    </ActionModal>
  );
}

/** Rejet — décision probante (horodatée au dossier) : motif obligatoire + avertissement. */
export function RejeterModal({ dict, locale, justificatif }: { dict: Dict; locale: Locale; justificatif: Justificatif }) {
  const j = dict.justificatifs;
  return (
    <ActionModal
      action={rejeterJustificatif}
      title={j.rejeterTitre}
      subtitle={`${justificatif.lot?.numero ?? ""} · ${formatMAD(justificatif.montant, locale)}`}
      closeLabel={dict.common.close}
      success={{ message: j.rejete, closeAndToast: true }}
      trigger={(open) => <Button variant="dangerGhost" onClick={open}>{j.rejeter}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="justificatif_id" value={justificatif.id} />
          <Field label={j.rejeterMotif} htmlFor="motif" hint={j.rejeterMotifAide} required error={fieldError(state, "motif")}>
            <Textarea id="motif" name="motif" rows={3} required maxLength={1000} defaultValue={formValue(state, "motif")} />
          </Field>
          <IrreversibleNotice>{dict.formulaires.confirmer.justificatifRejeterConsequence}</IrreversibleNotice>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={j.rejeterTitre} danger />
        </form>
      )}
    </ActionModal>
  );
}

/** Annulation par le déclarant — jamais en un clic : la déclaration ne se rétablit pas. */
export function AnnulerBouton({ dict, locale, justificatif }: { dict: Dict; locale: Locale; justificatif: Justificatif }) {
  const j = dict.justificatifs;
  const f = dict.formulaires.confirmer;
  return (
    <ConfirmAction
      action={annulerJustificatif}
      fields={{ locale, justificatif_id: justificatif.id }}
      triggerLabel={j.annuler}
      title={f.justificatifAnnulerTitre}
      question={fill(f.justificatifAnnulerQuestion, { montant: formatMAD(justificatif.montant, locale) })}
      consequence={f.justificatifAnnulerConsequence}
      irreversible
      confirmLabel={f.justificatifAnnulerConfirmer}
      closeLabel={dict.common.close}
      success={j.annule}
    />
  );
}

/** Syndic : gestion des comptes bancaires (RIB complet saisi, jamais ré-affiché sans action explicite). */
export function ComptesModal({ dict, locale, coproprieteId, comptes }: { dict: Dict; locale: Locale; coproprieteId: string; comptes: CompteBancaire[] }) {
  const [n, setN] = useState(Math.max(1, comptes.length));
  const j = dict.justificatifs;
  return (
    <ActionModal
      action={remplacerComptes}
      title={j.comptes}
      subtitle={j.aucunCompteAide}
      closeLabel={dict.common.close}
      wide
      success={{ message: dict.common.updated }}
      trigger={(open) => <Button variant="secondary" onClick={open}>{j.gererComptes}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="copropriete_id" value={coproprieteId} />
          <IrreversibleNotice>{j.ribAfficher} : {dict.depenses.ribAfficherAide}</IrreversibleNotice>
          {Array.from({ length: n }).map((_, i) => {
            const c = comptes[i];
            const libelles = state.status === "error" ? state.values?.libelle : undefined;
            const banques = state.status === "error" ? state.values?.banque : undefined;
            const saisi = (v: string | string[] | undefined) => (Array.isArray(v) ? v[i] : i === 0 ? v : undefined);
            return (
              <div key={i} className="grid gap-3 rounded-[20px] bg-tile p-4 sm:grid-cols-3">
                <Field label={j.libelle} htmlFor={`lib_${i}`} required><Input id={`lib_${i}`} name="libelle" required maxLength={120} defaultValue={saisi(libelles) ?? c?.libelle ?? ""} /></Field>
                <Field label={j.banque} htmlFor={`bq_${i}`} required><Input id={`bq_${i}`} name="banque" required maxLength={120} defaultValue={saisi(banques) ?? c?.banque ?? ""} /></Field>
                {/* RIB : jamais renvoyé au navigateur après un échec (donnée bancaire) — à ressaisir. */}
                <Field label={c ? `${j.rib} · ${c.rib_masque}` : j.rib} htmlFor={`rib_${i}`} required={!c} error={fieldError(state, `comptes.${i}.rib`)}>
                  <Input id={`rib_${i}`} name="rib" dir="ltr" inputMode="numeric" pattern="[0-9 ]{24,30}" required autoComplete="off" placeholder="007 780 …" className="tnum text-start" />
                </Field>
              </div>
            );
          })}
          <Button type="button" variant="ghost" size="sm" onClick={() => setN(n + 1)}><IconPlus width={16} height={16} />{j.ajouterCompte}</Button>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={dict.common.save} />
        </form>
      )}
    </ActionModal>
  );
}

export function RibCompteButton({ dict, locale, coproprieteId, compte }: { dict: Dict; locale: Locale; coproprieteId: string; compte: CompteBancaire }) {
  const [state, action] = useActionState(lireRibCompte, IDLE);
  const rib = state.status === "success" ? ((state.data as { rib?: string } | undefined)?.rib ?? null) : null;
  if (rib) return <span className="tnum font-mono text-sm text-ink" dir="ltr">{rib.replace(/(\d{3})(\d{3})(\d{16})(\d{2})/, "$1 $2 $3 $4")}</span>;
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="copropriete_id" value={coproprieteId} /><input type="hidden" name="index" value={compte.index} />
      <span className="tnum text-sm text-body" dir="ltr">{compte.rib_masque}</span>
      <SubmitButton variant="ghost" size="sm">{dict.justificatifs.ribAfficher}</SubmitButton>
      {state.status === "error" ? <FormAlert state={state} /> : null}
    </form>
  );
}
