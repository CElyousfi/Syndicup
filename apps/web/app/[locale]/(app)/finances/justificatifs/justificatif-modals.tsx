"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../../components/ui/modal";
import { Field, Input, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { CompteBancaire, Justificatif } from "../../../../../lib/api/types";
import { formatMAD } from "../../../../../lib/format";
import { IconPlus } from "../../../../../components/ui/icons";
import { validerJustificatif, rejeterJustificatif, annulerJustificatif, remplacerComptes, lireRibCompte } from "./actions";

function Succes({ dict, message, onClose }: { dict: Dict; message: string; onClose: () => void }) {
  return <div className="space-y-4"><p className="text-sm text-ink-strong">{message}</p><div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button></div></div>;
}
function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}

export function ValiderModal({ dict, locale, justificatif }: { dict: Dict; locale: Locale; justificatif: Justificatif }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(validerJustificatif, IDLE);
  const j = dict.justificatifs;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{j.valider}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={j.validerTitre} subtitle={`${justificatif.lot?.numero ?? ""} · ${formatMAD(justificatif.montant, locale)}`} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={j.valide} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="justificatif_id" value={justificatif.id} />
            <p className="text-sm text-body">{j.validerCorps}</p>
            <Field label={j.dateValeur} htmlFor="date_valeur" hint={j.dateValeurAide} optionalLabel={dict.common.optional} error={fieldError(state, "date_valeur")}>
              <Input id="date_valeur" name="date_valeur" type="date" dir="ltr" defaultValue={justificatif.datePaiementDeclaree.slice(0, 10)} className="tnum text-start" />
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={j.valider} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function RejeterModal({ dict, locale, justificatif }: { dict: Dict; locale: Locale; justificatif: Justificatif }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(rejeterJustificatif, IDLE);
  const j = dict.justificatifs;
  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>{j.rejeter}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={j.rejeterTitre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={j.rejete} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="justificatif_id" value={justificatif.id} />
            <Field label={j.rejeterMotif} htmlFor="motif" hint={j.rejeterMotifAide} required error={fieldError(state, "motif")}>
              <Textarea id="motif" name="motif" rows={3} required maxLength={1000} />
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={j.rejeter} danger />
          </form>
        )}
      </Modal>
    </>
  );
}

export function AnnulerBouton({ dict, locale, justificatif }: { dict: Dict; locale: Locale; justificatif: Justificatif }) {
  const [state, action] = useActionState(annulerJustificatif, IDLE);
  const j = dict.justificatifs;
  if (state.status === "success") return <span className="text-[13px] text-soft">{j.annule}</span>;
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="justificatif_id" value={justificatif.id} />
      <SubmitButton variant="dangerGhost" size="sm">{j.annuler}</SubmitButton>
      {state.status === "error" ? <FormAlert state={state} /> : null}
    </form>
  );
}

/** Syndic : gestion des comptes bancaires (RIB complet saisi, jamais ré-affiché sans action explicite). */
export function ComptesModal({ dict, locale, coproprieteId, comptes }: { dict: Dict; locale: Locale; coproprieteId: string; comptes: CompteBancaire[] }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(Math.max(1, comptes.length));
  const [state, action] = useActionState(remplacerComptes, IDLE);
  const j = dict.justificatifs;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{j.gererComptes}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={j.comptes} subtitle={j.aucunCompteAide} closeLabel={dict.common.close} wide>
        {state.status === "success" ? <Succes dict={dict} message={dict.common.updated} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="copropriete_id" value={coproprieteId} />
            <IrreversibleNotice>{j.ribAfficher} : {dict.depenses.ribAfficherAide}</IrreversibleNotice>
            {Array.from({ length: n }).map((_, i) => {
              const c = comptes[i];
              return (
                <div key={i} className="grid gap-3 rounded-field border border-hairline p-3 sm:grid-cols-3">
                  <Field label={j.libelle} htmlFor={`lib_${i}`} required><Input id={`lib_${i}`} name="libelle" required maxLength={120} defaultValue={c?.libelle ?? ""} /></Field>
                  <Field label={j.banque} htmlFor={`bq_${i}`} required><Input id={`bq_${i}`} name="banque" required maxLength={120} defaultValue={c?.banque ?? ""} /></Field>
                  <Field label={c ? `${j.rib} · ${c.rib_masque}` : j.rib} htmlFor={`rib_${i}`} required={!c} error={fieldError(state, `comptes.${i}.rib`)}>
                    <Input id={`rib_${i}`} name="rib" dir="ltr" inputMode="numeric" pattern="[0-9 ]{24,30}" required autoComplete="off" placeholder="007 780 …" className="tnum text-start" />
                  </Field>
                </div>
              );
            })}
            <Button type="button" variant="ghost" size="sm" onClick={() => setN(n + 1)}><IconPlus width={16} height={16} />{j.ajouterCompte}</Button>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={dict.common.save} />
          </form>
        )}
      </Modal>
    </>
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
