"use client";

/** Parkings (M23) — modales : emplacement, attribution, libération, véhicule, badge (remise, perdu, restitution, désactivation), place visiteur, recherche de plaque, véhicule gênant. */
import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { IrreversibleNotice } from "../../../../components/ui/irreversible-notice";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { Checkbox } from "../../../../components/ui/toggle";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { IDLE, fieldError, type FormState } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { BadgeAcces, Emplacement, RechercheVehicule, StatutEmplacement, TypeAttributionEmplacement, TypeBadge, TypeEmplacement, TypeVehicule, Vehicule, Visite } from "../../../../lib/api/types";
import { IconPlus, IconSearch } from "../../../../components/ui/icons";
import { attribuerEmplacement, badgeDesactiver, badgePerdu, badgeRestituer, creerBadge, creerEmplacement, creerVehicule, libererEmplacement, modifierBadge, modifierEmplacement, modifierVehicule, notifierVehicule, placeVisiteur, rechercherVehicule, retirerVehicule, supprimerEmplacement } from "./actions";
import { ActionModal } from "../../../../components/ui/action-modal";
import { MoneyInput } from "../../../../components/ui/money-input";
import { formChecked, formKey, formValue } from "../../../../lib/form-values";

export type LotOption = { id: string; numero: string };
const TYPES_EMPLACEMENT: TypeEmplacement[] = ["PARKING_COMMUN", "PARKING_VISITEUR", "PARKING_PMR", "MOTO", "VELO", "CAVE_COMMUNE"];
const TYPES_ATTRIBUTION: TypeAttributionEmplacement[] = ["ATTRIBUTION_AG", "ROTATION", "LOCATION_INTERNE", "TEMPORAIRE"];
const TYPES_VEHICULE: TypeVehicule[] = ["VOITURE", "MOTO", "UTILITAIRE"];
const TYPES_BADGE: TypeBadge[] = ["BADGE_PIETON", "TELECOMMANDE_PARKING", "CLE_CAVE", "CARTE_ASCENSEUR"];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.close}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
function LotSelect({ dict, lots, defaultValue, error, state = IDLE }: { dict: Dict; lots: LotOption[]; defaultValue?: string; error?: string; state?: FormState }) {
  const t = dict.parkings;
  return <Field label={t.lot} htmlFor="lot_id" required error={error}><Select key={formKey(state, "lot_id")} id="lot_id" name="lot_id" defaultValue={formValue(state, "lot_id", defaultValue ?? lots[0]?.id ?? "")} required>{lots.map((l) => <option key={l.id} value={l.id}>{l.numero}</option>)}</Select></Field>;
}

// ── Emplacements ─────────────────────────────────────────────────────────────
export function EmplacementModal({ dict, locale, emplacement, grand }: { dict: Dict; locale: Locale; emplacement?: Emplacement; grand?: boolean }) {
  const t = dict.parkings;
  const e = dict.enumsParkings;
  const statuts: StatutEmplacement[] = ["DISPONIBLE", "HORS_SERVICE"];
  return (
    <ActionModal
        action={emplacement ? modifierEmplacement : creerEmplacement}
        title={emplacement ? t.modifierEmplacement : t.nouvelEmplacement}
        subtitle={emplacement?.code}
        closeLabel={dict.common.close}
        success={{ message: emplacement ? t.emplacementModifie : t.emplacementCree, illustration: emplacement ? undefined : "ok-general" }}
        trigger={(open) => <Button variant={emplacement ? "secondary" : "primary"} size={grand ? "md" : "sm"} onClick={open}>{emplacement ? dict.common.modify : <><IconPlus width={16} height={16} />{t.nouvelEmplacement}</>}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            {emplacement ? <input type="hidden" name="emplacement_id" value={emplacement.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.type} htmlFor="type" required><Select key={formKey(state, "type")} id="type" name="type" defaultValue={formValue(state, "type", emplacement?.type ?? "PARKING_COMMUN")}>{TYPES_EMPLACEMENT.map((x) => <option key={x} value={x}>{e.typeEmplacement[x]}</option>)}</Select></Field>
              <Field label={t.code} htmlFor="code" required error={fieldError(state, "code")}><Input id="code" name="code" required maxLength={30} defaultValue={formValue(state, "code", emplacement?.code ?? "")} dir="ltr" className="font-mono text-start" /></Field>
              <Field label={t.niveau} htmlFor="niveau" optionalLabel={dict.common.optional}><Input id="niveau" name="niveau" maxLength={30} defaultValue={formValue(state, "niveau", emplacement?.niveau ?? "")} placeholder="-1" dir="ltr" className="text-start" /></Field>
              {emplacement && emplacement.statut !== "ATTRIBUE" ? <Field label={t.statut} htmlFor="statut"><Select key={formKey(state, "statut")} id="statut" name="statut" defaultValue={formValue(state, "statut", emplacement.statut)}>{statuts.map((x) => <option key={x} value={x}>{e.statutEmplacement[x]}</option>)}</Select></Field> : null}
            </div>
            <Checkbox name="attribuable" label={t.attribuable} defaultChecked={emplacement?.attribuable ?? true} />
            <Field label={t.notes} htmlFor="notes" optionalLabel={dict.common.optional}><Textarea id="notes" name="notes" rows={2} maxLength={2000} defaultValue={formValue(state, "notes", emplacement?.notes ?? "")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={emplacement ? dict.common.save : t.nouvelEmplacement} />
          </form>
        )}
      </ActionModal>
  );
}
export function SupprimerEmplacementModal({ dict, locale, emplacement }: { dict: Dict; locale: Locale; emplacement: Emplacement }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(supprimerEmplacement, IDLE);
  const t = dict.parkings;
  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>{t.supprimerEmplacement}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.supprimerEmplacement} subtitle={emplacement.code} closeLabel={dict.common.close}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="emplacement_id" value={emplacement.id} />
          <IrreversibleNotice>{t.supprimerCorps}</IrreversibleNotice>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={() => setOpen(false)} label={t.supprimerEmplacement} danger />
        </form>
      </Modal>
    </>
  );
}
export function AttribuerModal({ dict, locale, emplacement, lots }: { dict: Dict; locale: Locale; emplacement: Emplacement; lots: LotOption[] }) {
  const [type, setType] = useState<TypeAttributionEmplacement>("ROTATION");
  const t = dict.parkings;
  const e = dict.enumsParkings;
  return (
    <ActionModal
        action={attribuerEmplacement}
        title={fill(t.attribuerA, { code: emplacement.code })}
        subtitle={e.typeEmplacement[emplacement.type]}
        closeLabel={dict.common.close}
        success={{ message: t.attribue, illustration: "ok-general" }}
        trigger={(open) => <Button onClick={open}>{t.attribuer}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="emplacement_id" value={emplacement.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <LotSelect dict={dict} lots={lots} state={state} error={fieldError(state, "lot_id")} />
              <Field label={t.type} htmlFor="type_attribution" required><Select id="type_attribution" name="type" value={type} onChange={(ev) => setType(ev.target.value as TypeAttributionEmplacement)}>{TYPES_ATTRIBUTION.map((x) => <option key={x} value={x}>{e.typeAttribution[x]}</option>)}</Select></Field>
              <Field label={t.dateDebut} htmlFor="date_debut" required error={fieldError(state, "date_debut")}><Input id="date_debut" name="date_debut" type="date" required defaultValue={formValue(state, "date_debut", aujourdhui())} dir="ltr" className="tnum text-start" /></Field>
              <Field label={t.dateFin} htmlFor="date_fin" required={type === "TEMPORAIRE"} optionalLabel={type === "TEMPORAIRE" ? undefined : dict.common.optional} hint={type === "TEMPORAIRE" ? undefined : t.sansFin} error={fieldError(state, "date_fin")}><Input id="date_fin" name="date_fin" type="date" required={type === "TEMPORAIRE"} dir="ltr" className="tnum text-start" defaultValue={formValue(state, "date_fin")} /></Field>
              <Field label={t.redevance} htmlFor="redevance_mensuelle" hint={t.redevanceAide} optionalLabel={dict.common.optional} error={fieldError(state, "redevance_mensuelle")}><MoneyInput id="redevance_mensuelle" name="redevance_mensuelle" invalidMessage={dict.formulaires.montantInvalide} placeholder="150,00" defaultValue={formValue(state, "redevance_mensuelle")} /></Field>
              <Field label={t.resolutionAg} htmlFor="resolution_ag_id" hint={t.resolutionAgAide} optionalLabel={dict.common.optional} error={fieldError(state, "resolution_ag_id")}><Input id="resolution_ag_id" name="resolution_ag_id" dir="ltr" className="font-mono text-[12px] text-start" defaultValue={formValue(state, "resolution_ag_id")} /></Field>
            </div>
            <Field label={t.notes} htmlFor="notes_attr" optionalLabel={dict.common.optional}><Textarea id="notes_attr" name="notes" rows={2} maxLength={2000} defaultValue={formValue(state, "notes")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.attribuer} />
          </form>
        )}
      </ActionModal>
  );
}
export function LibererModal({ dict, locale, emplacement }: { dict: Dict; locale: Locale; emplacement: Emplacement }) {
  const t = dict.parkings;
  return (
    <ActionModal
        action={libererEmplacement}
        title={t.liberer}
        subtitle={`${emplacement.code} · ${emplacement.attributionCourante?.lotNumero ?? ""}`}
        closeLabel={dict.common.close}
        success={{ message: t.libere }}
        trigger={(open) => <Button variant="secondary" onClick={open}>{t.liberer}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="emplacement_id" value={emplacement.id} />
            <p className="text-sm text-body">{t.libererCorps}</p>
            <Field label={t.dateFin} htmlFor="date_fin_lib" optionalLabel={dict.common.optional} error={fieldError(state, "date_fin")}><Input id="date_fin_lib" name="date_fin" type="date" dir="ltr" className="tnum text-start" defaultValue={formValue(state, "date_fin")} /></Field>
            <Field label={t.motif} htmlFor="motif" optionalLabel={dict.common.optional}><Textarea id="motif" name="motif" rows={2} maxLength={1000} defaultValue={formValue(state, "motif")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.liberer} />
          </form>
        )}
      </ActionModal>
  );
}

// ── Véhicules ────────────────────────────────────────────────────────────────
export function VehiculeModal({ dict, locale, lots, vehicule, grand }: { dict: Dict; locale: Locale; lots: LotOption[]; vehicule?: Vehicule; grand?: boolean }) {
  const t = dict.parkings;
  const e = dict.enumsParkings;
  return (
    <ActionModal
        action={vehicule ? modifierVehicule : creerVehicule}
        title={vehicule ? t.modifierVehicule : t.declarerVehicule}
        subtitle={vehicule?.immatriculation}
        closeLabel={dict.common.close}
        success={{ message: vehicule ? t.vehiculeModifie : t.vehiculeDeclare, illustration: vehicule ? undefined : "ok-general" }}
        trigger={(open) => <Button variant={vehicule ? "ghost" : "primary"} size={grand ? "md" : "sm"} onClick={open}>{vehicule ? dict.common.modify : <><IconPlus width={16} height={16} />{t.declarerVehicule}</>}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            {vehicule ? <input type="hidden" name="vehicule_id" value={vehicule.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {vehicule ? null : <LotSelect dict={dict} lots={lots} state={state} error={fieldError(state, "lot_id")} />}
              <Field label={t.immatriculation} htmlFor="immatriculation" required hint={t.immatriculationAide} error={fieldError(state, "immatriculation")}><Input id="immatriculation" name="immatriculation" required maxLength={24} defaultValue={formValue(state, "immatriculation", vehicule?.immatriculation ?? "")} placeholder="12345-A-6" dir="ltr" className="font-mono uppercase text-start" /></Field>
              <Field label={t.typeVehicule} htmlFor="type_vehicule"><Select key={formKey(state, "type")} id="type_vehicule" name="type" defaultValue={formValue(state, "type", vehicule?.type ?? "VOITURE")}>{TYPES_VEHICULE.map((x) => <option key={x} value={x}>{e.typeVehicule[x]}</option>)}</Select></Field>
              <Field label={t.marque} htmlFor="marque" optionalLabel={dict.common.optional}><Input id="marque" name="marque" maxLength={60} defaultValue={formValue(state, "marque", vehicule?.marque ?? "")} /></Field>
              <Field label={t.couleur} htmlFor="couleur" optionalLabel={dict.common.optional}><Input id="couleur" name="couleur" maxLength={40} defaultValue={formValue(state, "couleur", vehicule?.couleur ?? "")} /></Field>
            </div>
            {vehicule ? <input type="hidden" name="actif" value={vehicule.actif ? "on" : "off"} /> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={vehicule ? dict.common.save : t.declarerVehicule} />
          </form>
        )}
      </ActionModal>
  );
}
export function RetirerVehiculeModal({ dict, locale, vehicule }: { dict: Dict; locale: Locale; vehicule: Vehicule }) {
  const t = dict.parkings;
  return (
    <ActionModal
        action={retirerVehicule}
        title={t.retirerVehicule}
        subtitle={vehicule.immatriculation}
        closeLabel={dict.common.close}
        success={{ message: t.vehiculeRetire }}
        trigger={(open) => <Button variant="dangerGhost" size="sm" onClick={open}>{t.retirerVehicule}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="vehicule_id" value={vehicule.id} />
            <p className="text-sm text-body">{t.retirerVehiculeCorps}</p>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.retirerVehicule} danger />
          </form>
        )}
      </ActionModal>
  );
}
/** Recherche de plaque (gardien / syndic) — chaque recherche est journalisée côté API. */
export function RechercheVehiculeForm({ dict }: { dict: Dict }) {
  const [state, action] = useActionState(rechercherVehicule, IDLE);
  const t = dict.parkings;
  const e = dict.enumsParkings;
  const r = state.status === "success" ? (state.data as RechercheVehicule | undefined) : undefined;
  const Ligne = ({ v }: { v: Vehicule }) => (
    <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-surface px-4 py-3">
      <span className="font-mono text-[16px] font-bold text-ink" dir="ltr">{v.immatriculation}</span>
      <Badge variant="info">{t.lot} {v.lotNumero ?? "—"}</Badge>
      <span className="text-[12.5px] text-soft">{[e.typeVehicule[v.type], v.marque, v.couleur].filter(Boolean).join(" · ")}</span>
    </div>
  );
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1"><Field label={t.rechercher} htmlFor="recherche_plaque" hint={t.rechercherAide}><Input id="recherche_plaque" name="immatriculation" required minLength={2} maxLength={24} placeholder="12345-A-6" dir="ltr" className="font-mono uppercase text-start" defaultValue={formValue(state, "immatriculation")} /></Field></div>
        <SubmitButton><IconSearch width={16} height={16} />{t.rechercherAction}</SubmitButton>
      </div>
      <FormAlert state={state} />
      {r ? (
        <div className="space-y-2">
          {r.exact ? <><p className="text-[13px] font-semibold text-soft">{t.resultatExact}</p><Ligne v={r.exact} /></> : <Banner variant="warn">{t.aucunResultat}</Banner>}
          {r.similaires.length ? <><p className="pt-2 text-[13px] font-semibold text-soft">{t.resultatsSimilaires}</p>{r.similaires.map((v) => <Ligne key={v.id} v={v} />)}</> : null}
        </div>
      ) : null}
    </form>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────
export function BadgeModal({ dict, locale, lots, badge, grand }: { dict: Dict; locale: Locale; lots: LotOption[]; badge?: BadgeAcces; grand?: boolean }) {
  const t = dict.parkings;
  const e = dict.enumsParkings;
  return (
    <ActionModal
        action={badge ? modifierBadge : creerBadge}
        title={badge ? t.modifierBadge : t.remettreBadge}
        subtitle={badge ? `${e.typeBadge[badge.type]} ${badge.identifiant}` : undefined}
        closeLabel={dict.common.close}
        success={{ message: badge ? t.badgeModifie : t.badgeRemis, illustration: badge ? undefined : "ok-general" }}
        trigger={(open) => <Button variant={badge ? "ghost" : "primary"} size={grand ? "md" : "sm"} onClick={open}>{badge ? dict.common.modify : <><IconPlus width={16} height={16} />{t.remettreBadge}</>}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            {badge ? <input type="hidden" name="badge_id" value={badge.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {badge ? null : <LotSelect dict={dict} lots={lots} state={state} error={fieldError(state, "lot_id")} />}
              {badge ? null : <Field label={t.type} htmlFor="type_badge" required><Select key={formKey(state, "type")} id="type_badge" name="type" defaultValue={formValue(state, "type", "TELECOMMANDE_PARKING")}>{TYPES_BADGE.map((x) => <option key={x} value={x}>{e.typeBadge[x]}</option>)}</Select></Field>}
              <Field label={t.identifiant} htmlFor="identifiant" required hint={t.identifiantAide} error={fieldError(state, "identifiant")}><Input id="identifiant" name="identifiant" required maxLength={60} defaultValue={formValue(state, "identifiant", badge?.identifiant ?? "")} dir="ltr" className="font-mono text-start" /></Field>
              {badge ? null : <Field label={t.remisLe} htmlFor="remis_le" required error={fieldError(state, "remis_le")}><Input id="remis_le" name="remis_le" type="date" required defaultValue={formValue(state, "remis_le", aujourdhui())} dir="ltr" className="tnum text-start" /></Field>}
              <Field label={t.caution} htmlFor="caution_montant" hint={t.cautionAide} optionalLabel={dict.common.optional} error={fieldError(state, "caution_montant")}><MoneyInput id="caution_montant" name="caution_montant" invalidMessage={dict.formulaires.montantInvalide} placeholder="300,00" defaultValue={formValue(state, "caution_montant", badge?.cautionMontant ?? "")} /></Field>
              <Field label={t.cautionPaiement} htmlFor="caution_paiement_id" optionalLabel={dict.common.optional} error={fieldError(state, "caution_paiement_id")}><Input id="caution_paiement_id" name="caution_paiement_id" defaultValue={formValue(state, "caution_paiement_id", badge?.cautionPaiement?.id ?? "")} dir="ltr" className="font-mono text-[12px] text-start" /></Field>
            </div>
            <Field label={t.notes} htmlFor="notes_badge" optionalLabel={dict.common.optional}><Textarea id="notes_badge" name="notes" rows={2} maxLength={2000} defaultValue={formValue(state, "notes", badge?.notes ?? "")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={badge ? dict.common.save : t.remettreBadge} />
          </form>
        )}
      </ActionModal>
  );
}
export function BadgePerduModal({ dict, locale, badge }: { dict: Dict; locale: Locale; badge: BadgeAcces }) {
  const t = dict.parkings;
  return (
    <ActionModal
        action={badgePerdu}
        title={t.declarerPerdu}
        subtitle={badge.identifiant}
        closeLabel={dict.common.close}
        success={{ message: t.badgePerdu }}
        trigger={(open) => <Button variant="dangerGhost" size="sm" onClick={open}>{t.declarerPerdu}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="badge_id" value={badge.id} />
            <IrreversibleNotice>{t.declarerPerduCorps}</IrreversibleNotice>
            <Field label={t.commentaire} htmlFor="commentaire_perdu" optionalLabel={dict.common.optional}><Textarea id="commentaire_perdu" name="commentaire" rows={2} maxLength={1000} defaultValue={formValue(state, "commentaire")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.declarerPerdu} danger />
          </form>
        )}
      </ActionModal>
  );
}
export function BadgeRestituerModal({ dict, locale, badge }: { dict: Dict; locale: Locale; badge: BadgeAcces }) {
  const t = dict.parkings;
  return (
    <ActionModal
        action={badgeRestituer}
        title={t.restituer}
        subtitle={badge.identifiant}
        closeLabel={dict.common.close}
        success={{ message: t.badgeRestitue }}
        trigger={(open) => <Button variant="secondary" size="sm" onClick={open}>{t.restituer}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="badge_id" value={badge.id} />
            <p className="text-sm text-body">{t.restituerCorps}</p>
            <Field label={t.restitueLe} htmlFor="restitue_le" optionalLabel={dict.common.optional}><Input id="restitue_le" name="restitue_le" type="date" defaultValue={formValue(state, "restitue_le", aujourdhui())} dir="ltr" className="tnum text-start" /></Field>
            {badge.cautionMontant ? <Checkbox name="caution_rendue" label={`${t.cautionRendue} (${badge.cautionMontant} MAD)`} defaultChecked={formChecked(state, "caution_rendue", true)} /> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.restituer} />
          </form>
        )}
      </ActionModal>
  );
}
export function BadgeDesactiverModal({ dict, locale, badge }: { dict: Dict; locale: Locale; badge: BadgeAcces }) {
  const t = dict.parkings;
  return (
    <ActionModal
        action={badgeDesactiver}
        title={t.desactiver}
        subtitle={badge.identifiant}
        closeLabel={dict.common.close}
        success={{ message: t.badgeDesactive }}
        trigger={(open) => <Button variant="ghost" size="sm" onClick={open}>{t.desactiver}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="badge_id" value={badge.id} />
            <IrreversibleNotice>{t.desactiverCorps}</IrreversibleNotice>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.desactiver} danger />
          </form>
        )}
      </ActionModal>
  );
}

// ── Place visiteur (visites) et véhicule gênant (incidents) ──────────────────
export function PlaceVisiteurModal({ dict, locale, visite, places }: { dict: Dict; locale: Locale; visite: Visite; places: { id: string; code: string; niveau: string | null }[] }) {
  const t = dict.parkings;
  const code = places.find((x) => x.id === visite.emplacementId)?.code;
  const dansUneHeure = () => { const d = new Date(Date.now() + 3_600_000); d.setSeconds(0, 0); const z = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
  return (
    <ActionModal
        action={placeVisiteur}
        title={t.attribuerPlace}
        subtitle={visite.visiteurNom}
        closeLabel={dict.common.close}
        success={{ message: t.placeAttribuee, illustration: "ok-visiteur" }}
        trigger={(open) => <Button variant={visite.emplacementId ? "ghost" : "secondary"} size="sm" onClick={open}>{visite.emplacementId ? `${t.placeVisiteur} ${code ?? ""}` : t.attribuerPlace}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="visite_id" value={visite.id} />
            <Field label={t.placeVisiteur} htmlFor="emplacement_id" hint={t.attribuerPlaceAide} error={fieldError(state, "emplacement_id")}>
              <Select key={formKey(state, "emplacement_id")} id="emplacement_id" name="emplacement_id" defaultValue={formValue(state, "emplacement_id", visite.emplacementId ?? "")}><option value="">{t.retirerPlace}</option>{places.map((x) => <option key={x.id} value={x.id}>{x.code}{x.niveau ? ` · ${t.niveau} ${x.niveau}` : ""}</option>)}</Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.immatriculation} htmlFor="immat_visite" optionalLabel={dict.common.optional} error={fieldError(state, "immatriculation")}><Input id="immat_visite" name="immatriculation" maxLength={24} defaultValue={formValue(state, "immatriculation", visite.immatriculation ?? "")} placeholder="12345-A-6" dir="ltr" className="font-mono uppercase text-start" /></Field>
              <Field label={t.heureLimite} htmlFor="heure_limite" optionalLabel={dict.common.optional} error={fieldError(state, "heure_limite")}><Input id="heure_limite" name="heure_limite" type="datetime-local" defaultValue={formValue(state, "heure_limite", visite.heureLimite ? visite.heureLimite.slice(0, 16) : dansUneHeure())} dir="ltr" className="tnum text-start" /></Field>
            </div>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={t.attribuerPlace} />
          </form>
        )}
      </ActionModal>
  );
}
export function NotifierVehiculeModal({ dict, locale, incidentId, immatriculation }: { dict: Dict; locale: Locale; incidentId: string; immatriculation: string | null }) {
  const i = dict.incidents;
  const resultat = (s: { data?: unknown }) => s.data as { lot: string | null; notifies: number } | undefined;
  return (
    <ActionModal
      action={notifierVehicule}
      title={i.notifierVehicule}
      subtitle={immatriculation ?? undefined}
      closeLabel={dict.common.close}
      success={{ message: (s) => fill(i.vehiculeNotifie, { lot: resultat(s)?.lot ?? "—", n: resultat(s)?.notifies ?? 0 }) }}
      trigger={(open) => <Button variant="secondary" onClick={open}>{i.notifierVehicule}</Button>}
    >
      {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="incident_id" value={incidentId} />
            <p className="text-sm text-body">{i.notifierVehiculeAide}</p>
            <Field label={i.immatriculationSignalee} htmlFor="immat_incident" required={!immatriculation} error={fieldError(state, "immatriculation")}><Input id="immat_incident" name="immatriculation" maxLength={24} defaultValue={formValue(state, "immatriculation", immatriculation ?? "")} required={!immatriculation} dir="ltr" className="font-mono uppercase text-start" /></Field>
            <Field label={i.messageVehicule} htmlFor="message_vehicule" optionalLabel={dict.common.optional}><Textarea id="message_vehicule" name="message" rows={2} maxLength={500} defaultValue={formValue(state, "message")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={i.notifierVehicule} />
          </form>
      )}
    </ActionModal>
  );
}
