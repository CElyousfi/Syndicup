"use client";

/** Parkings (M23) — modales : emplacement, attribution, libération, véhicule, badge (remise, perdu, restitution, désactivation), place visiteur, recherche de plaque, véhicule gênant. */
import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { Field, Input, Select, Textarea, Checkbox } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { BadgeAcces, Emplacement, RechercheVehicule, StatutEmplacement, TypeAttributionEmplacement, TypeBadge, TypeEmplacement, TypeVehicule, Vehicule, Visite } from "../../../../lib/api/types";
import { IconPlus, IconSearch } from "../../../../components/ui/icons";
import { attribuerEmplacement, badgeDesactiver, badgePerdu, badgeRestituer, creerBadge, creerEmplacement, creerVehicule, libererEmplacement, modifierBadge, modifierEmplacement, modifierVehicule, notifierVehicule, placeVisiteur, rechercherVehicule, retirerVehicule, supprimerEmplacement } from "./actions";

export type LotOption = { id: string; numero: string };
const TYPES_EMPLACEMENT: TypeEmplacement[] = ["PARKING_COMMUN", "PARKING_VISITEUR", "PARKING_PMR", "MOTO", "VELO", "CAVE_COMMUNE"];
const TYPES_ATTRIBUTION: TypeAttributionEmplacement[] = ["ATTRIBUTION_AG", "ROTATION", "LOCATION_INTERNE", "TEMPORAIRE"];
const TYPES_VEHICULE: TypeVehicule[] = ["VOITURE", "MOTO", "UTILITAIRE"];
const TYPES_BADGE: TypeBadge[] = ["BADGE_PIETON", "TELECOMMANDE_PARKING", "CLE_CAVE", "CARTE_ASCENSEUR"];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
function Succes({ dict, message, onClose }: { dict: Dict; message: string; onClose: () => void }) {
  return <div className="space-y-4"><p className="text-sm text-ink-strong">{message}</p><div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button></div></div>;
}
function LotSelect({ dict, lots, defaultValue, error }: { dict: Dict; lots: LotOption[]; defaultValue?: string; error?: string }) {
  const t = dict.parkings;
  return <Field label={t.lot} htmlFor="lot_id" required error={error}><Select id="lot_id" name="lot_id" defaultValue={defaultValue ?? lots[0]?.id ?? ""} required>{lots.map((l) => <option key={l.id} value={l.id}>{l.numero}</option>)}</Select></Field>;
}

// ── Emplacements ─────────────────────────────────────────────────────────────
export function EmplacementModal({ dict, locale, emplacement, grand }: { dict: Dict; locale: Locale; emplacement?: Emplacement; grand?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(emplacement ? modifierEmplacement : creerEmplacement, IDLE);
  const t = dict.parkings;
  const e = dict.enumsParkings;
  const statuts: StatutEmplacement[] = ["DISPONIBLE", "HORS_SERVICE"];
  return (
    <>
      <Button variant={emplacement ? "secondary" : "primary"} size={grand ? "md" : "sm"} onClick={() => setOpen(true)}>{emplacement ? dict.common.modify : <><IconPlus width={16} height={16} />{t.nouvelEmplacement}</>}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={emplacement ? t.modifierEmplacement : t.nouvelEmplacement} subtitle={emplacement?.code} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={emplacement ? t.emplacementModifie : t.emplacementCree} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            {emplacement ? <input type="hidden" name="emplacement_id" value={emplacement.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.type} htmlFor="type" required><Select id="type" name="type" defaultValue={emplacement?.type ?? "PARKING_COMMUN"}>{TYPES_EMPLACEMENT.map((x) => <option key={x} value={x}>{e.typeEmplacement[x]}</option>)}</Select></Field>
              <Field label={t.code} htmlFor="code" required error={fieldError(state, "code")}><Input id="code" name="code" required maxLength={30} defaultValue={emplacement?.code ?? ""} dir="ltr" className="font-mono text-start" /></Field>
              <Field label={t.niveau} htmlFor="niveau" optionalLabel={dict.common.optional}><Input id="niveau" name="niveau" maxLength={30} defaultValue={emplacement?.niveau ?? ""} placeholder="-1" dir="ltr" className="text-start" /></Field>
              {emplacement && emplacement.statut !== "ATTRIBUE" ? <Field label={t.statut} htmlFor="statut"><Select id="statut" name="statut" defaultValue={emplacement.statut}>{statuts.map((x) => <option key={x} value={x}>{e.statutEmplacement[x]}</option>)}</Select></Field> : null}
            </div>
            <Checkbox name="attribuable" label={t.attribuable} defaultChecked={emplacement?.attribuable ?? true} />
            <Field label={t.notes} htmlFor="notes" optionalLabel={dict.common.optional}><Textarea id="notes" name="notes" rows={2} maxLength={2000} defaultValue={emplacement?.notes ?? ""} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={emplacement ? dict.common.save : t.nouvelEmplacement} />
          </form>
        )}
      </Modal>
    </>
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(attribuerEmplacement, IDLE);
  const [type, setType] = useState<TypeAttributionEmplacement>("ROTATION");
  const t = dict.parkings;
  const e = dict.enumsParkings;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t.attribuer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={fill(t.attribuerA, { code: emplacement.code })} subtitle={e.typeEmplacement[emplacement.type]} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.attribue} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="emplacement_id" value={emplacement.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <LotSelect dict={dict} lots={lots} error={fieldError(state, "lot_id")} />
              <Field label={t.type} htmlFor="type_attribution" required><Select id="type_attribution" name="type" value={type} onChange={(ev) => setType(ev.target.value as TypeAttributionEmplacement)}>{TYPES_ATTRIBUTION.map((x) => <option key={x} value={x}>{e.typeAttribution[x]}</option>)}</Select></Field>
              <Field label={t.dateDebut} htmlFor="date_debut" required error={fieldError(state, "date_debut")}><Input id="date_debut" name="date_debut" type="date" required defaultValue={aujourdhui()} dir="ltr" className="tnum text-start" /></Field>
              <Field label={t.dateFin} htmlFor="date_fin" required={type === "TEMPORAIRE"} optionalLabel={type === "TEMPORAIRE" ? undefined : dict.common.optional} hint={type === "TEMPORAIRE" ? undefined : t.sansFin} error={fieldError(state, "date_fin")}><Input id="date_fin" name="date_fin" type="date" required={type === "TEMPORAIRE"} dir="ltr" className="tnum text-start" /></Field>
              <Field label={t.redevance} htmlFor="redevance_mensuelle" hint={t.redevanceAide} optionalLabel={dict.common.optional} error={fieldError(state, "redevance_mensuelle")}><Input id="redevance_mensuelle" name="redevance_mensuelle" inputMode="decimal" placeholder="150.00" dir="ltr" className="tnum text-start" /></Field>
              <Field label={t.resolutionAg} htmlFor="resolution_ag_id" hint={t.resolutionAgAide} optionalLabel={dict.common.optional} error={fieldError(state, "resolution_ag_id")}><Input id="resolution_ag_id" name="resolution_ag_id" dir="ltr" className="font-mono text-[12px] text-start" /></Field>
            </div>
            <Field label={t.notes} htmlFor="notes_attr" optionalLabel={dict.common.optional}><Textarea id="notes_attr" name="notes" rows={2} maxLength={2000} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.attribuer} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function LibererModal({ dict, locale, emplacement }: { dict: Dict; locale: Locale; emplacement: Emplacement }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(libererEmplacement, IDLE);
  const t = dict.parkings;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t.liberer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.liberer} subtitle={`${emplacement.code} · ${emplacement.attributionCourante?.lotNumero ?? ""}`} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.libere} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="emplacement_id" value={emplacement.id} />
            <p className="text-sm text-body">{t.libererCorps}</p>
            <Field label={t.dateFin} htmlFor="date_fin_lib" optionalLabel={dict.common.optional} error={fieldError(state, "date_fin")}><Input id="date_fin_lib" name="date_fin" type="date" dir="ltr" className="tnum text-start" /></Field>
            <Field label={t.motif} htmlFor="motif" optionalLabel={dict.common.optional}><Textarea id="motif" name="motif" rows={2} maxLength={1000} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.liberer} />
          </form>
        )}
      </Modal>
    </>
  );
}

// ── Véhicules ────────────────────────────────────────────────────────────────
export function VehiculeModal({ dict, locale, lots, vehicule, grand }: { dict: Dict; locale: Locale; lots: LotOption[]; vehicule?: Vehicule; grand?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(vehicule ? modifierVehicule : creerVehicule, IDLE);
  const t = dict.parkings;
  const e = dict.enumsParkings;
  return (
    <>
      <Button variant={vehicule ? "ghost" : "primary"} size={grand ? "md" : "sm"} onClick={() => setOpen(true)}>{vehicule ? dict.common.modify : <><IconPlus width={16} height={16} />{t.declarerVehicule}</>}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={vehicule ? t.modifierVehicule : t.declarerVehicule} subtitle={vehicule?.immatriculation} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={vehicule ? t.vehiculeModifie : t.vehiculeDeclare} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            {vehicule ? <input type="hidden" name="vehicule_id" value={vehicule.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {vehicule ? null : <LotSelect dict={dict} lots={lots} error={fieldError(state, "lot_id")} />}
              <Field label={t.immatriculation} htmlFor="immatriculation" required hint={t.immatriculationAide} error={fieldError(state, "immatriculation")}><Input id="immatriculation" name="immatriculation" required maxLength={24} defaultValue={vehicule?.immatriculation ?? ""} placeholder="12345-A-6" dir="ltr" className="font-mono uppercase text-start" /></Field>
              <Field label={t.typeVehicule} htmlFor="type_vehicule"><Select id="type_vehicule" name="type" defaultValue={vehicule?.type ?? "VOITURE"}>{TYPES_VEHICULE.map((x) => <option key={x} value={x}>{e.typeVehicule[x]}</option>)}</Select></Field>
              <Field label={t.marque} htmlFor="marque" optionalLabel={dict.common.optional}><Input id="marque" name="marque" maxLength={60} defaultValue={vehicule?.marque ?? ""} /></Field>
              <Field label={t.couleur} htmlFor="couleur" optionalLabel={dict.common.optional}><Input id="couleur" name="couleur" maxLength={40} defaultValue={vehicule?.couleur ?? ""} /></Field>
            </div>
            {vehicule ? <input type="hidden" name="actif" value={vehicule.actif ? "on" : "off"} /> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={vehicule ? dict.common.save : t.declarerVehicule} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function RetirerVehiculeModal({ dict, locale, vehicule }: { dict: Dict; locale: Locale; vehicule: Vehicule }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(retirerVehicule, IDLE);
  const t = dict.parkings;
  return (
    <>
      <Button variant="dangerGhost" size="sm" onClick={() => setOpen(true)}>{t.retirerVehicule}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.retirerVehicule} subtitle={vehicule.immatriculation} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.vehiculeRetire} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="vehicule_id" value={vehicule.id} />
            <p className="text-sm text-body">{t.retirerVehiculeCorps}</p>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.retirerVehicule} danger />
          </form>
        )}
      </Modal>
    </>
  );
}
/** Recherche de plaque (gardien / syndic) — chaque recherche est journalisée côté API. */
export function RechercheVehiculeForm({ dict }: { dict: Dict }) {
  const [state, action] = useActionState(rechercherVehicule, IDLE);
  const t = dict.parkings;
  const e = dict.enumsParkings;
  const r = state.status === "success" ? (state.data as RechercheVehicule | undefined) : undefined;
  const Ligne = ({ v }: { v: Vehicule }) => (
    <div className="flex flex-wrap items-center gap-3 rounded-field border border-hairline bg-surface px-3 py-2">
      <span className="font-mono text-[15px] font-semibold text-ink-strong" dir="ltr">{v.immatriculation}</span>
      <Badge variant="info">{t.lot} {v.lotNumero ?? "—"}</Badge>
      <span className="text-[12.5px] text-soft">{[e.typeVehicule[v.type], v.marque, v.couleur].filter(Boolean).join(" · ")}</span>
    </div>
  );
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1"><Field label={t.rechercher} htmlFor="recherche_plaque" hint={t.rechercherAide}><Input id="recherche_plaque" name="immatriculation" required minLength={2} maxLength={24} placeholder="12345-A-6" dir="ltr" className="font-mono uppercase text-start" /></Field></div>
        <SubmitButton><IconSearch width={16} height={16} />{t.rechercherAction}</SubmitButton>
      </div>
      <FormAlert state={state} />
      {r ? (
        <div className="space-y-2">
          {r.exact ? <><p className="text-[12px] font-medium uppercase tracking-wide text-faint">{t.resultatExact}</p><Ligne v={r.exact} /></> : <p className="text-sm text-danger">{t.aucunResultat}</p>}
          {r.similaires.length ? <><p className="pt-1 text-[12px] font-medium uppercase tracking-wide text-faint">{t.resultatsSimilaires}</p>{r.similaires.map((v) => <Ligne key={v.id} v={v} />)}</> : null}
        </div>
      ) : null}
    </form>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────
export function BadgeModal({ dict, locale, lots, badge, grand }: { dict: Dict; locale: Locale; lots: LotOption[]; badge?: BadgeAcces; grand?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(badge ? modifierBadge : creerBadge, IDLE);
  const t = dict.parkings;
  const e = dict.enumsParkings;
  return (
    <>
      <Button variant={badge ? "ghost" : "primary"} size={grand ? "md" : "sm"} onClick={() => setOpen(true)}>{badge ? dict.common.modify : <><IconPlus width={16} height={16} />{t.remettreBadge}</>}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={badge ? t.modifierBadge : t.remettreBadge} subtitle={badge ? `${e.typeBadge[badge.type]} ${badge.identifiant}` : undefined} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={badge ? t.badgeModifie : t.badgeRemis} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            {badge ? <input type="hidden" name="badge_id" value={badge.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {badge ? null : <LotSelect dict={dict} lots={lots} error={fieldError(state, "lot_id")} />}
              {badge ? null : <Field label={t.type} htmlFor="type_badge" required><Select id="type_badge" name="type" defaultValue="TELECOMMANDE_PARKING">{TYPES_BADGE.map((x) => <option key={x} value={x}>{e.typeBadge[x]}</option>)}</Select></Field>}
              <Field label={t.identifiant} htmlFor="identifiant" required hint={t.identifiantAide} error={fieldError(state, "identifiant")}><Input id="identifiant" name="identifiant" required maxLength={60} defaultValue={badge?.identifiant ?? ""} dir="ltr" className="font-mono text-start" /></Field>
              {badge ? null : <Field label={t.remisLe} htmlFor="remis_le" required error={fieldError(state, "remis_le")}><Input id="remis_le" name="remis_le" type="date" required defaultValue={aujourdhui()} dir="ltr" className="tnum text-start" /></Field>}
              <Field label={t.caution} htmlFor="caution_montant" hint={t.cautionAide} optionalLabel={dict.common.optional} error={fieldError(state, "caution_montant")}><Input id="caution_montant" name="caution_montant" inputMode="decimal" placeholder="300.00" defaultValue={badge?.cautionMontant ?? ""} dir="ltr" className="tnum text-start" /></Field>
              <Field label={t.cautionPaiement} htmlFor="caution_paiement_id" optionalLabel={dict.common.optional} error={fieldError(state, "caution_paiement_id")}><Input id="caution_paiement_id" name="caution_paiement_id" defaultValue={badge?.cautionPaiement?.id ?? ""} dir="ltr" className="font-mono text-[12px] text-start" /></Field>
            </div>
            <Field label={t.notes} htmlFor="notes_badge" optionalLabel={dict.common.optional}><Textarea id="notes_badge" name="notes" rows={2} maxLength={2000} defaultValue={badge?.notes ?? ""} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={badge ? dict.common.save : t.remettreBadge} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function BadgePerduModal({ dict, locale, badge }: { dict: Dict; locale: Locale; badge: BadgeAcces }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(badgePerdu, IDLE);
  const t = dict.parkings;
  return (
    <>
      <Button variant="dangerGhost" size="sm" onClick={() => setOpen(true)}>{t.declarerPerdu}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.declarerPerdu} subtitle={badge.identifiant} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.badgePerdu} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="badge_id" value={badge.id} />
            <IrreversibleNotice>{t.declarerPerduCorps}</IrreversibleNotice>
            <Field label={t.commentaire} htmlFor="commentaire_perdu" optionalLabel={dict.common.optional}><Textarea id="commentaire_perdu" name="commentaire" rows={2} maxLength={1000} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.declarerPerdu} danger />
          </form>
        )}
      </Modal>
    </>
  );
}
export function BadgeRestituerModal({ dict, locale, badge }: { dict: Dict; locale: Locale; badge: BadgeAcces }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(badgeRestituer, IDLE);
  const t = dict.parkings;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{t.restituer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.restituer} subtitle={badge.identifiant} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.badgeRestitue} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="badge_id" value={badge.id} />
            <p className="text-sm text-body">{t.restituerCorps}</p>
            <Field label={t.restitueLe} htmlFor="restitue_le" optionalLabel={dict.common.optional}><Input id="restitue_le" name="restitue_le" type="date" defaultValue={aujourdhui()} dir="ltr" className="tnum text-start" /></Field>
            {badge.cautionMontant ? <Checkbox name="caution_rendue" label={`${t.cautionRendue} (${badge.cautionMontant} MAD)`} defaultChecked /> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.restituer} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function BadgeDesactiverModal({ dict, locale, badge }: { dict: Dict; locale: Locale; badge: BadgeAcces }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(badgeDesactiver, IDLE);
  const t = dict.parkings;
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{t.desactiver}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.desactiver} subtitle={badge.identifiant} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.badgeDesactive} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="badge_id" value={badge.id} />
            <IrreversibleNotice>{t.desactiverCorps}</IrreversibleNotice>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.desactiver} danger />
          </form>
        )}
      </Modal>
    </>
  );
}

// ── Place visiteur (visites) et véhicule gênant (incidents) ──────────────────
export function PlaceVisiteurModal({ dict, locale, visite, places }: { dict: Dict; locale: Locale; visite: Visite; places: { id: string; code: string; niveau: string | null }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(placeVisiteur, IDLE);
  const t = dict.parkings;
  const code = places.find((x) => x.id === visite.emplacementId)?.code;
  const dansUneHeure = () => { const d = new Date(Date.now() + 3_600_000); d.setSeconds(0, 0); const z = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
  return (
    <>
      <Button variant={visite.emplacementId ? "ghost" : "secondary"} size="sm" onClick={() => setOpen(true)}>{visite.emplacementId ? `${t.placeVisiteur} ${code ?? ""}` : t.attribuerPlace}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.attribuerPlace} subtitle={visite.visiteurNom} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.placeAttribuee} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="visite_id" value={visite.id} />
            <Field label={t.placeVisiteur} htmlFor="emplacement_id" hint={t.attribuerPlaceAide} error={fieldError(state, "emplacement_id")}>
              <Select id="emplacement_id" name="emplacement_id" defaultValue={visite.emplacementId ?? ""}><option value="">{t.retirerPlace}</option>{places.map((x) => <option key={x.id} value={x.id}>{x.code}{x.niveau ? ` · ${t.niveau} ${x.niveau}` : ""}</option>)}</Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.immatriculation} htmlFor="immat_visite" optionalLabel={dict.common.optional} error={fieldError(state, "immatriculation")}><Input id="immat_visite" name="immatriculation" maxLength={24} defaultValue={visite.immatriculation ?? ""} placeholder="12345-A-6" dir="ltr" className="font-mono uppercase text-start" /></Field>
              <Field label={t.heureLimite} htmlFor="heure_limite" optionalLabel={dict.common.optional} error={fieldError(state, "heure_limite")}><Input id="heure_limite" name="heure_limite" type="datetime-local" defaultValue={visite.heureLimite ? visite.heureLimite.slice(0, 16) : dansUneHeure()} dir="ltr" className="tnum text-start" /></Field>
            </div>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.attribuerPlace} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function NotifierVehiculeModal({ dict, locale, incidentId, immatriculation }: { dict: Dict; locale: Locale; incidentId: string; immatriculation: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(notifierVehicule, IDLE);
  const i = dict.incidents;
  const r = state.status === "success" ? (state.data as { lot: string | null; notifies: number } | undefined) : undefined;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{i.notifierVehicule}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={i.notifierVehicule} subtitle={immatriculation ?? undefined} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={fill(i.vehiculeNotifie, { lot: r?.lot ?? "—", n: r?.notifies ?? 0 })} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="incident_id" value={incidentId} />
            <p className="text-sm text-body">{i.notifierVehiculeAide}</p>
            <Field label={i.immatriculationSignalee} htmlFor="immat_incident" required={!immatriculation} error={fieldError(state, "immatriculation")}><Input id="immat_incident" name="immatriculation" maxLength={24} defaultValue={immatriculation ?? ""} required={!immatriculation} dir="ltr" className="font-mono uppercase text-start" /></Field>
            <Field label={i.messageVehicule} htmlFor="message_vehicule" optionalLabel={dict.common.optional}><Textarea id="message_vehicule" name="message" rows={2} maxLength={500} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={i.notifierVehicule} />
          </form>
        )}
      </Modal>
    </>
  );
}
