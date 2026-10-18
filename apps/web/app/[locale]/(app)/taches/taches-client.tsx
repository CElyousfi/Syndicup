"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { IrreversibleNotice } from "../../../../components/ui/irreversible-notice";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { Checkbox } from "../../../../components/ui/toggle";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { ChecklistItem, PrioriteTache, StatutTache, TacheDetail } from "../../../../lib/api/types";
import { IconPlus } from "../../../../components/ui/icons";
import { assignerTache, basculerEtape, changerStatut, commenterTache, creerTache, modifierTache } from "./actions";
import { ActionModal } from "../../../../components/ui/action-modal";
import { formChecked, formKey, formValue } from "../../../../lib/form-values";

export type AssigneeOption = { id: string; nom: string; role: string };
const PRIORITES: PrioriteTache[] = ["BASSE", "NORMALE", "HAUTE", "CRITIQUE"];
const STATUTS: StatutTache[] = ["A_FAIRE", "EN_COURS", "BLOQUEE", "TERMINEE", "ANNULEE"];

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.close}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}

export function TacheForm({ dict, locale, assignees, tache }: { dict: Dict; locale: Locale; assignees: AssigneeOption[]; tache?: TacheDetail }) {
  const [state, action] = useActionState(tache ? modifierTache : creerTache, IDLE);
  const t = dict.taches;
  const e = dict.enumsTaches;
  const [etapes, setEtapes] = useState<ChecklistItem[]>(tache?.checklist ?? []);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {tache ? <input type="hidden" name="tache_id" value={tache.id} /> : null}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label={t.titreChamp} htmlFor="titre" required error={fieldError(state, "titre")}><Input id="titre" name="titre" required maxLength={200} defaultValue={formValue(state, "titre", tache?.titre ?? "")} /></Field></div>
          <Field label={t.assignee} htmlFor="assignee_id" hint={t.assigneeAide} error={fieldError(state, "assignee_id")}>
            <Select key={formKey(state, "assignee_id")} id="assignee_id" name="assignee_id" defaultValue={formValue(state, "assignee_id", tache?.assignee?.id ?? "")}><option value="">{t.nonAssignee}</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.nom} · {dict.roles[a.role as keyof typeof dict.roles] ?? a.role}</option>)}</Select>
          </Field>
          <Field label={t.priorite} htmlFor="priorite" required><Select key={formKey(state, "priorite")} id="priorite" name="priorite" defaultValue={formValue(state, "priorite", tache?.priorite ?? "NORMALE")}>{PRIORITES.map((p) => <option key={p} value={p}>{e.priorite[p]}</option>)}</Select></Field>
          <Field label={t.echeance} htmlFor="date_echeance" optionalLabel={dict.common.optional} error={fieldError(state, "date_echeance")}><Input id="date_echeance" name="date_echeance" type="date" dir="ltr" defaultValue={formValue(state, "date_echeance", tache?.dateEcheance ?? "")} className="tnum text-start" /></Field>
          <Field label={t.recurrence} htmlFor="recurrence" hint={t.recurrenceAide}><Select key={formKey(state, "recurrence")} id="recurrence" name="recurrence" defaultValue={formValue(state, "recurrence", tache?.recurrence?.frequence ?? "")}><option value="">{t.aucuneRecurrence}</option>{(["MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE"] as const).map((f) => <option key={f} value={f}>{e.frequence[f]}</option>)}</Select></Field>
        </div>
        <div className="mt-4"><Field label={t.description} htmlFor="description" optionalLabel={dict.common.optional}><Textarea id="description" name="description" rows={4} maxLength={8000} defaultValue={formValue(state, "description", tache?.description ?? "")} /></Field></div>
        <div className="mt-4">
          <p className="text-[14px] font-semibold text-ink">{t.checklist}</p>
          <p className="mb-2 text-[12px] text-soft">{t.checklistAide}</p>
          <div className="space-y-2">
            {etapes.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <Checkbox name={`etape_fait_${i + 1}`} defaultChecked={formChecked(state, `etape_fait_${i + 1}`, it.fait)} aria-label={`${t.checklist} ${i + 1}`} label={null} className="shrink-0 self-center" />
                <Input name={`etape_${i + 1}`} defaultValue={formValue(state, `etape_${i + 1}`, it.libelle)} maxLength={200} className="!h-9" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setEtapes(etapes.filter((_, k) => k !== i))}>✕</Button>
              </div>
            ))}
            {etapes.length < 50 ? <Button type="button" variant="secondary" size="sm" onClick={() => setEtapes([...etapes, { id: `c${etapes.length + 1}`, libelle: "", fait: false }])}><IconPlus width={14} height={14} />{t.ajouterEtape}</Button> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Checkbox name="visible_conseil" label={t.visibleConseil} defaultChecked={formChecked(state, "visible_conseil", tache?.visibleConseil ?? true)} />
        </div>
        <div className="mt-4"><Field label={t.piecesJointes} htmlFor="pieces" hint={t.piecesJointesAide} optionalLabel={dict.common.optional} error={fieldError(state, "pieces")}><Input id="pieces" name="pieces" type="file" multiple accept="image/*,application/pdf" /></Field></div>
      </Card>
      <FormAlert state={state} />
      <div className="flex justify-end"><SubmitButton>{tache ? dict.common.save : t.nouvelle}</SubmitButton></div>
    </form>
  );
}

export function StatutModal({ dict, locale, tache, syndic }: { dict: Dict; locale: Locale; tache: TacheDetail; syndic: boolean }) {
  const t = dict.taches;
  const e = dict.enumsTaches;
  const cibles = STATUTS.filter((s) => s !== tache.statut && (syndic || s !== "ANNULEE"));
  return (
    <ActionModal
      action={changerStatut}
      title={t.changerStatut}
      subtitle={tache.titre}
      closeLabel={dict.common.close}
      success={{ message: (s) => ((s.data as { suivante_id?: string | null } | undefined)?.suivante_id ? `${t.statutChange} ${t.suivanteCreee}` : t.statutChange) }}
      trigger={(open) => <Button onClick={open}>{t.changerStatut}</Button>}
    >
      {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tache.id} />
            <Field label={t.nouveauStatut} htmlFor="statut" required><Select key={formKey(state, "statut")} id="statut" name="statut" defaultValue={formValue(state, "statut", cibles.includes("TERMINEE") && tache.statut === "EN_COURS" ? "TERMINEE" : cibles[0])}>{cibles.map((s) => <option key={s} value={s}>{e.statut[s]}</option>)}</Select></Field>
            <Field label={t.commentaireStatut} htmlFor="commentaire_statut" optionalLabel={dict.common.optional}><Textarea id="commentaire_statut" name="commentaire" rows={2} maxLength={4000} defaultValue={formValue(state, "commentaire")} /></Field>
            <Field label={t.photo} htmlFor="photo" optionalLabel={dict.common.optional}><Input id="photo" name="photo" type="file" accept="image/*,application/pdf" /></Field>
            {tache.recurrence ? <p className="text-[12px] text-soft">{t.recurrenceAide}</p> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.changerStatut} />
          </form>
      )}
    </ActionModal>
  );
}

export function AnnulerModal({ dict, locale, tache }: { dict: Dict; locale: Locale; tache: TacheDetail }) {
  const t = dict.taches;
  return (
    <ActionModal
        action={changerStatut}
        title={t.annuler}
        subtitle={tache.titre}
        closeLabel={dict.common.close}
        success={{ message: t.statutChange }}
        trigger={(open) => <Button variant="dangerGhost" onClick={open}>{t.annuler}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tache.id} /><input type="hidden" name="statut" value="ANNULEE" />
            <IrreversibleNotice>{t.annulerCorps}</IrreversibleNotice>
            <Field label={t.commentaireStatut} htmlFor="commentaire_annul" optionalLabel={dict.common.optional}><Textarea id="commentaire_annul" name="commentaire" rows={2} maxLength={4000} defaultValue={formValue(state, "commentaire")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.annuler} danger />
          </form>
        )}
      </ActionModal>
  );
}

export function AssignerModal({ dict, locale, tache, assignees }: { dict: Dict; locale: Locale; tache: TacheDetail; assignees: AssigneeOption[] }) {
  const t = dict.taches;
  return (
    <ActionModal
        action={assignerTache}
        title={t.assignerTitre}
        subtitle={tache.titre}
        closeLabel={dict.common.close}
        success={{ message: t.assigneeChange }}
        trigger={(open) => <Button variant="secondary" onClick={open}>{t.assigner}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tache.id} />
            <Field label={t.assignee} htmlFor="assignee_id_m" hint={t.assigneeAide} error={fieldError(state, "assignee_id")}><Select key={formKey(state, "assignee_id")} id="assignee_id_m" name="assignee_id" defaultValue={formValue(state, "assignee_id", tache.assignee?.id ?? "")}><option value="">{t.nonAssignee}</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.nom} · {dict.roles[a.role as keyof typeof dict.roles] ?? a.role}</option>)}</Select></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.assigner} />
          </form>
        )}
      </ActionModal>
  );
}

/** Checklist cochable en place (syndic ou assigné(e)). */
export function Checklist({ dict, locale, tache, editable }: { dict: Dict; locale: Locale; tache: TacheDetail; editable: boolean }) {
  const [pending, start] = useTransition();
  const items = tache.checklist ?? [];
  if (!items.length) return null;
  const faits = items.filter((i) => i.fait).length;
  return (
    <div>
      <p className="tnum mb-3 mt-1 text-[13px] text-soft">{fill(dict.taches.checklistProgres, { n: faits, total: items.length })}</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <Checkbox
              checked={it.fait}
              disabled={!editable || pending}
              onChange={(ev) => start(() => basculerEtape(locale, tache.id, it.id, ev.target.checked))}
              className={`rounded-2xl bg-surface px-4 py-3 transition-colors ${editable ? "hover:bg-hover" : "cursor-default"}`}
              label={<span className={`text-[15px] ${it.fait ? "font-normal text-soft line-through" : "font-medium text-ink"}`}>{it.libelle}</span>}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommentaireForm({ dict, locale, tacheId }: { dict: Dict; locale: Locale; tacheId: string }) {
  const [state, action] = useActionState(commenterTache, IDLE);
  const t = dict.taches;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tacheId} />
      <Field label={t.votreCommentaire} htmlFor="contenu_t" error={fieldError(state, "contenu")}><Textarea id="contenu_t" name="contenu" rows={2} required maxLength={4000} defaultValue={formValue(state, "contenu")} /></Field>
      <FormAlert state={state} />
      <div className="flex items-center justify-end gap-3">{state.status === "success" ? <span className="text-[13px] font-semibold text-ok">{t.commentaireEnvoye}</span> : null}<SubmitButton size="sm">{t.commenter}</SubmitButton></div>
    </form>
  );
}
