"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { ContratDetail, ContratEcheance, TypeEcheance } from "../../../../lib/api/types";
import { formatDate, formatMAD } from "../../../../lib/format";
import { IconPlus } from "../../../../components/ui/icons";
import { activerContrat, suspendreContrat, resilierContrat, regenererEcheances, ajouterEcheance, modifierEcheance, genererDepense } from "./actions";

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
function Succes({ dict, message, onClose, lien }: { dict: Dict; message: string; onClose: () => void; lien?: { href: string; label: string } }) {
  return <div className="space-y-4"><p className="text-sm text-ink-strong">{message}</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button>{lien ? <a href={lien.href} className="inline-flex h-10 items-center rounded-btn bg-ink px-4 text-[13px] font-medium text-white">{lien.label}</a> : null}</div></div>;
}

type Props = { dict: Dict; locale: Locale; contrat: ContratDetail };

export function ActiverModal({ dict, locale, contrat }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(activerContrat, IDLE);
  const c = dict.contrats;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{c.activer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.activerTitre} subtitle={contrat.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={c.active} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
            <p className="text-sm text-body">{c.activerCorps}</p>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={c.activer} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function SuspendreModal({ dict, locale, contrat }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(suspendreContrat, IDLE);
  const c = dict.contrats;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{c.suspendre}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.suspendreTitre} subtitle={contrat.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={c.suspendu} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
            <p className="text-sm text-body">{c.suspendreCorps}</p>
            <Field label={c.motif} htmlFor="motif" optionalLabel={dict.common.optional} error={fieldError(state, "motif")}><Textarea id="motif" name="motif" rows={2} maxLength={1000} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={c.suspendre} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function ResilierModal({ dict, locale, contrat }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(resilierContrat, IDLE);
  const c = dict.contrats;
  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>{c.resilier}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.resilierTitre} subtitle={contrat.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={c.resilie} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
            <IrreversibleNotice>{c.resilierCorps}</IrreversibleNotice>
            <Field label={c.motif} htmlFor="motif_res" required error={fieldError(state, "motif")}><Textarea id="motif_res" name="motif" rows={3} required maxLength={1000} /></Field>
            <Field label={c.dateResiliation} htmlFor="date_resiliation" optionalLabel={dict.common.optional} error={fieldError(state, "date_resiliation")}><Input id="date_resiliation" name="date_resiliation" type="date" dir="ltr" className="tnum text-start" /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={c.resilier} danger />
          </form>
        )}
      </Modal>
    </>
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(ajouterEcheance, IDLE);
  const c = dict.contrats;
  const types: TypeEcheance[] = ["VISITE_TECHNIQUE", "CONTROLE_REGLEMENTAIRE", "PAIEMENT", "RENOUVELLEMENT", "AUTRE"];
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><IconPlus width={14} height={14} />{c.ajouterEcheance}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.ajouterEcheanceTitre} subtitle={contrat.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={c.echeanceAjoutee} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} />
            <Field label={c.typeEcheance} htmlFor="type_ech" required><Select id="type_ech" name="type" required defaultValue="VISITE_TECHNIQUE">{types.map((t) => <option key={t} value={t}>{dict.enumsContrats.typeEcheance[t]}</option>)}</Select></Field>
            <Field label={c.dateEcheance} htmlFor="date_echeance" required error={fieldError(state, "date_echeance")}><Input id="date_echeance" name="date_echeance" type="date" required dir="ltr" className="tnum text-start" /></Field>
            <Field label={`${c.montant} (${dict.common.mad})`} htmlFor="montant_ech" optionalLabel={dict.common.optional} error={fieldError(state, "montant")}><Input id="montant_ech" name="montant" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" className="tnum text-start" /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={c.ajouterEcheance} />
          </form>
        )}
      </Modal>
    </>
  );
}

/** Actions d'une ligne d'échéance : créer la dépense, marquer réalisée, annuler. */
export function EcheanceActions({ dict, locale, contrat, echeance }: Props & { echeance: ContratEcheance }) {
  const [open, setOpen] = useState(false);
  const [stateD, actionD] = useActionState(genererDepense, IDLE);
  const [stateM, actionM] = useActionState(modifierEcheance, IDLE);
  const c = dict.contrats;
  if (echeance.statut === "REALISEE" || echeance.statut === "ANNULEE") return null;
  if (stateM.status === "success") return <span className="text-[12px] text-ok">{c.echeanceMaj}</span>;
  const montantDefaut = echeance.montant ?? contrat.montantPeriode ?? "";
  return (
    <div className="flex min-w-[190px] flex-col items-end gap-1.5">
      {(echeance.statut === "A_VENIR" || echeance.statut === "MANQUEE") && echeance.type === "PAIEMENT" ? (
        <>
          <Button size="sm" onClick={() => setOpen(true)}>{c.genererDepense}</Button>
          <Modal open={open} onClose={() => setOpen(false)} title={c.genererDepenseTitre} subtitle={`${contrat.libelle} · ${formatDate(echeance.dateEcheance, locale)}`} closeLabel={dict.common.close}>
            {stateD.status === "success" ? <Succes dict={dict} message={c.depenseGeneree} onClose={() => setOpen(false)} lien={{ href: `/${locale}/finances/depenses/${(stateD.data as { depense_id: string }).depense_id}`, label: c.voirDepense }} /> : (
              <form action={actionD} className="space-y-4">
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} /><input type="hidden" name="echeance_id" value={echeance.id} />
                <p className="text-sm text-body">{c.genererDepenseCorps}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`${dict.depenses.montantTtc} (${dict.common.mad})`} htmlFor="montant_ttc" required error={fieldError(stateD, "montant_ttc")}><Input id="montant_ttc" name="montant_ttc" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" required defaultValue={montantDefaut} className="tnum text-start" /></Field>
                  <Field label={dict.depenses.date} htmlFor="date_depense" required><Input id="date_depense" name="date_depense" type="date" required dir="ltr" defaultValue={echeance.dateEcheance.slice(0, 10)} className="tnum text-start" /></Field>
                </div>
                <Field label={dict.depenses.source} htmlFor="source" required><Select id="source" name="source" defaultValue="COMPTE_COURANT"><option value="COMPTE_COURANT">{dict.enumsDepenses.sourceFinancement.COMPTE_COURANT}</option><option value="FONDS_RESERVE">{dict.enumsDepenses.sourceFinancement.FONDS_RESERVE}</option></Select></Field>
                <FormAlert state={stateD} />
                <Pied dict={dict} onCancel={() => setOpen(false)} label={c.genererDepense} />
              </form>
            )}
          </Modal>
        </>
      ) : null}
      <form action={actionM} className="inline">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} /><input type="hidden" name="echeance_id" value={echeance.id} /><input type="hidden" name="statut" value="REALISEE" />
        <SubmitButton variant="secondary" size="sm">{c.marquerRealisee}</SubmitButton>
      </form>
      {echeance.statut === "A_VENIR" || echeance.statut === "MANQUEE" ? (
        <form action={actionM} className="inline">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="contrat_id" value={contrat.id} /><input type="hidden" name="echeance_id" value={echeance.id} /><input type="hidden" name="statut" value="ANNULEE" />
          <SubmitButton variant="dangerGhost" size="sm">{c.annulerEcheance}</SubmitButton>
        </form>
      ) : null}
      {stateM.status === "error" ? <FormAlert state={stateM} /> : null}
      <span className="sr-only">{formatMAD(echeance.montant, locale)}</span>
    </div>
  );
}
