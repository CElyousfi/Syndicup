"use client";

import { ActionModal } from "../../../../../components/ui/action-modal";
import { ConfirmAction } from "../../../../../components/ui/confirm-action";
import { IrreversibleNotice } from "../../../../../components/ui/irreversible-notice";
import { Field, Input, Select, Textarea } from "../../../../../components/ui/field";
import { Checkbox } from "../../../../../components/ui/toggle";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button, ButtonLink } from "../../../../../components/ui/button";
import { fieldError, type FormState } from "../../../../../lib/forms";
import { formChecked, formKey, formValue } from "../../../../../lib/form-values";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import {
  ajouterResolution,
  annulerAg,
  convoquerAg,
  donnerProcuration,
  ouvrirAg,
  revoquerProcuration,
} from "../actions";
import { IconPlus, IconSend } from "../../../../../components/ui/icons";

function LienParametres({ dict, locale }: { dict: Dict; locale: Locale }) {
  return (
    <ButtonLink href={`/${locale}/parametres#legaux`} variant="secondary" size="sm">
      {dict.legalGate.goToSettings}
    </ButtonLink>
  );
}

/**
 * « Convoquer » — envoi probant et définitif : confirmation explicite (e-mail aux membres de la
 * résidence, selon la configuration — ce que fait l'API). Une clé d'idempotence par ouverture de
 * la modale : « Réessayer » dans la même modale ne convoque jamais deux fois. L'état gaté légal
 * (422) s'affiche en bannière dans la modale, jamais en erreur.
 */
export function ConvoquerForm({
  dict,
  locale,
  agId,
  dateAg,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  dateAg: string;
}) {
  const f = dict.formulaires.confirmer;
  return (
    <ConfirmAction
      action={convoquerAg}
      fields={{ locale, ag_id: agId }}
      triggerLabel={dict.ag.convoquer}
      triggerVariant="primary"
      triggerSize="lg"
      triggerClassName="w-full"
      triggerIcon={<IconSend width={16} height={16} />}
      title={f.convoquerTitre}
      question={fill(f.convoquerQuestion, { date: dateAg })}
      consequence={f.convoquerConsequence}
      irreversible
      idempotent
      tone="primary"
      confirmLabel={f.convoquerConfirmer}
      closeLabel={dict.common.close}
      success={{ message: f.convoquerSucces, illustration: "ok-general" }}
      legalGateTitle={dict.legalGate.banner}
      legalGateAction={<LienParametres dict={dict} locale={locale} />}
    />
  );
}

/** « Ouvrir la séance » — horodatée au PV, quorum constaté : confirmée. Redirige vers la séance. */
export function OuvrirForm({
  dict,
  locale,
  agId,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
}) {
  const f = dict.formulaires.confirmer;
  return (
    <ConfirmAction
      action={ouvrirAg}
      fields={{ locale, ag_id: agId }}
      triggerLabel={dict.ag.ouvrirSeance}
      triggerVariant="primary"
      triggerSize="lg"
      triggerClassName="w-full"
      title={f.ouvrirTitre}
      question={f.ouvrirQuestion}
      consequence={f.ouvrirConsequence}
      irreversible
      idempotent
      tone="primary"
      confirmLabel={f.ouvrirConfirmer}
      closeLabel={dict.common.close}
      success={dict.formulaires.fait}
      legalGateTitle={dict.legalGate.banner}
      legalGateAction={<LienParametres dict={dict} locale={locale} />}
    />
  );
}

export function AnnulerModal({
  dict,
  locale,
  agId,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
}) {
  const f = dict.formulaires.confirmer;
  return (
    <ActionModal
      action={annulerAg}
      title={dict.ag.annuler}
      closeLabel={dict.common.close}
      success={{ message: dict.formulaires.succes.agAnnulee, closeAndToast: true }}
      trigger={(open) => (
        <Button variant="dangerGhost" className="w-full" onClick={open}>
          {dict.ag.annuler}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="ag_id" value={agId} />
          <Field label={dict.ag.annulerMotif} htmlFor="motif" required error={fieldError(state, "motif")}>
            <Textarea id="motif" name="motif" required minLength={3} defaultValue={formValue(state, "motif")} />
          </Field>
          <IrreversibleNotice>{f.agAnnulerConsequence}</IrreversibleNotice>
          <FormAlert state={state} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dict.common.close}
            </Button>
            <SubmitButton variant="danger">{f.agAnnulerConfirmer}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
  );
}

export function ResolutionModal({
  dict,
  locale,
  agId,
  prochainOrdre,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  prochainOrdre: number;
}) {
  return (
    <ActionModal
      action={ajouterResolution}
      title={dict.ag.ajouterResolution}
      closeLabel={dict.common.close}
      wide
      success={{ message: dict.formulaires.succes.resolutionAjoutee }}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          <IconPlus width={15} height={15} />
          {dict.ag.ajouterResolution}
        </Button>
      )}
    >
      {({ state, formAction, close }) => <ResolutionFields dict={dict} locale={locale} agId={agId} prochainOrdre={prochainOrdre} state={state} formAction={formAction} close={close} />}
    </ActionModal>
  );
}

function ResolutionFields({
  dict,
  locale,
  agId,
  prochainOrdre,
  state,
  formAction,
  close,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  prochainOrdre: number;
  state: FormState;
  formAction: (fd: FormData) => void;
  close: () => void;
}) {
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="ag_id" value={agId} />
      <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
        <Field label={dict.ag.ordre} htmlFor="ordre" required error={fieldError(state, "ordre")}>
          <Input id="ordre" name="ordre" type="number" min={1} defaultValue={formValue(state, "ordre", prochainOrdre)} required className="tnum" />
        </Field>
        <Field label={dict.ag.typeMajorite} htmlFor="type_majorite" required error={fieldError(state, "type_majorite")}>
          <Select key={formKey(state, "type_majorite")} id="type_majorite" name="type_majorite" defaultValue={formValue(state, "type_majorite", "SIMPLE")} required>
            {(["SIMPLE", "DOUBLE", "UNANIMITE"] as const).map((m) => (
              <option key={m} value={m}>
                {dict.enums.typeMajorite[m]} — {dict.enums.typeMajoriteAide[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={dict.ag.texteResolution} htmlFor="texte" required error={fieldError(state, "texte")}>
        <Textarea id="texte" name="texte" required minLength={3} rows={4} defaultValue={formValue(state, "texte")} />
      </Field>
      <Checkbox name="necessite_execution" label={dict.taches.necessiteExecution} defaultChecked={formChecked(state, "necessite_execution", false)} />
      <FormAlert state={state} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={close}>
          {dict.common.close}
        </Button>
        <SubmitButton>{dict.ag.ajouterResolution}</SubmitButton>
      </div>
    </form>
  );
}

/** E4 — donner procuration (cas d'usage clé du MRE). Geste de vote : écran de succès plein. */
export function ProcurationModal({
  dict,
  locale,
  agId,
  mesLots,
  membres,
  syndic,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  mesLots: Array<{ id: string; numero: string }>;
  membres: Array<{ id: string; nom: string; lots: string[] }>;
  /** Le syndic peut saisir une procuration papier pour un mandant tiers. */
  syndic: boolean;
}) {
  return (
    <ActionModal
      action={donnerProcuration}
      title={dict.ag.donnerProcuration}
      subtitle={dict.ag.procurationsAide}
      closeLabel={dict.common.close}
      success={{ message: dict.ag.procurationDonnee, illustration: "ok-vote" }}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          {dict.ag.donnerProcuration}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="ag_id" value={agId} />
          <Field label={dict.invitations.lot} htmlFor="proc_lot" required error={fieldError(state, "lot_id")}>
            <Select key={formKey(state, "lot_id")} id="proc_lot" name="lot_id" required defaultValue={formValue(state, "lot_id", mesLots[0]?.id ?? "")}>
              {mesLots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.numero}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={dict.ag.mandataire} htmlFor="proc_mandataire" hint={dict.ag.mandataireAide} required error={fieldError(state, "mandataire_id")}>
            <>
              <Input
                id="proc_mandataire"
                name="mandataire_id"
                list="proc-membres"
                dir="ltr"
                required
                pattern="[0-9a-fA-F-]{36}"
                className="font-mono text-[13px] text-start"
                placeholder="00000000-0000-0000-0000-000000000000"
                defaultValue={formValue(state, "mandataire_id")}
              />
              <datalist id="proc-membres">
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom} · {m.lots.join(", ")}
                  </option>
                ))}
              </datalist>
            </>
          </Field>
          {syndic ? (
            <Field label={dict.ag.mandant} htmlFor="proc_mandant" optionalLabel={dict.common.optional} error={fieldError(state, "mandant_id")}>
              <Input
                id="proc_mandant"
                name="mandant_id"
                list="proc-membres"
                dir="ltr"
                pattern="[0-9a-fA-F-]{36}"
                className="font-mono text-[13px] text-start"
                defaultValue={formValue(state, "mandant_id")}
              />
            </Field>
          ) : null}
          <FormAlert state={state} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dict.common.close}
            </Button>
            <SubmitButton>{dict.ag.donnerProcuration}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
  );
}

/** Révocation — écriture probante (dossier de l'AG) : confirmée, irréversible. */
export function RevoquerForm({
  dict,
  locale,
  agId,
  procurationId,
  mandataire,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  procurationId: string;
  /** Nom du mandataire, pour une question nominative. */
  mandataire?: string;
}) {
  const f = dict.formulaires.confirmer;
  return (
    <ConfirmAction
      action={revoquerProcuration}
      fields={{ locale, ag_id: agId, procuration_id: procurationId }}
      triggerLabel={dict.ag.revoquer}
      title={f.procurationRevoquerTitre}
      question={mandataire ? fill(f.procurationRevoquerQuestion, { nom: mandataire }) : f.procurationRevoquerQuestionSansNom}
      consequence={f.procurationRevoquerConsequence}
      irreversible
      confirmLabel={f.procurationRevoquerConfirmer}
      closeLabel={dict.common.close}
      success={dict.ag.procurationRevoquee}
    />
  );
}

/** Clôture (pupitre) — irréversible : fige les résultats et génère le PV. Redirige vers le PV. */
export function CloturerModal({
  dict,
  locale,
  agId,
  action: cloturer,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  return (
    <ConfirmAction
      action={cloturer}
      fields={{ locale, ag_id: agId }}
      triggerLabel={dict.ag.cloturer}
      triggerVariant="danger"
      triggerSize="lg"
      triggerClassName="w-full sm:w-auto"
      title={dict.ag.cloturer}
      consequence={dict.ag.cloturerCorps}
      irreversible
      confirmLabel={dict.ag.cloturer}
      closeLabel={dict.common.close}
      success={dict.formulaires.fait}
    />
  );
}
