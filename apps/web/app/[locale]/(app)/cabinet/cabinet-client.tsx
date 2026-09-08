"use client";

/** Cabinet (M25) — modales : membre, mandat (proposer / modifier / terminer), prestataire modèle + copie, paramètres, confirmation de passation. */
import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { Cabinet, CabinetMandat, CabinetMembre, CabinetPrestataire, MandatCopropriete, RoleCabinet } from "../../../../lib/api/types";
import { IconPlus } from "../../../../components/ui/icons";
import { ajouterMembre, confirmerMandat, copierPrestataire, creerPrestataireModele, modifierCabinet, modifierMandat, modifierMembre, proposerMandat, terminerMandat } from "./actions";

const ROLES: RoleCabinet[] = ["CABINET_ADMIN", "CABINET_GESTIONNAIRE", "CABINET_COMPTABLE"];
export type GestionnaireOption = { id: string; nom: string };
function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
function Succes({ dict, message, onClose }: { dict: Dict; message: string; onClose: () => void }) {
  return <div className="space-y-4"><p className="text-sm text-ink-strong">{message}</p><div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button></div></div>;
}

export function MembreModal({ dict, locale, cabinetId, membre }: { dict: Dict; locale: Locale; cabinetId: string; membre?: CabinetMembre }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(membre ? modifierMembre : ajouterMembre, IDLE);
  const t = dict.cabinet;
  return (
    <>
      <Button variant={membre ? "ghost" : "primary"} size={membre ? "sm" : "md"} onClick={() => setOpen(true)}>{membre ? dict.common.modify : <><IconPlus width={16} height={16} />{t.ajouterMembre}</>}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={membre ? dict.common.modify : t.ajouterMembre} subtitle={membre ? `${membre.prenom ?? ""} ${membre.nom ?? ""}`.trim() : undefined} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={membre ? t.membreModifie : t.membreAjoute} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={cabinetId} />
            {membre ? <input type="hidden" name="membre_id" value={membre.id} /> : <><p className="text-sm text-body">{t.ajouterMembreAide}</p><Field label={t.telephoneOuEmail} htmlFor="contact" required error={fieldError(state, "telephone") ?? fieldError(state, "email")}><Input id="contact" name="contact" required dir="ltr" className="text-start" placeholder="0612345678" /></Field></>}
            <Field label={t.role} htmlFor="role_membre" required><Select id="role_membre" name="role" defaultValue={membre?.role ?? "CABINET_GESTIONNAIRE"}>{ROLES.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</Select></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={membre ? dict.common.save : t.ajouterMembre} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function RetirerMembreModal({ dict, locale, cabinetId, membre }: { dict: Dict; locale: Locale; cabinetId: string; membre: CabinetMembre }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(modifierMembre, IDLE);
  const t = dict.cabinet;
  return (
    <>
      <Button variant="dangerGhost" size="sm" onClick={() => setOpen(true)}>{t.retirer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.retirer} subtitle={`${membre.prenom ?? ""} ${membre.nom ?? ""}`.trim()} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.membreRetire} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={cabinetId} /><input type="hidden" name="membre_id" value={membre.id} /><input type="hidden" name="actif" value="false" />
            <IrreversibleNotice>{t.retirerCorps}</IrreversibleNotice>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.retirer} danger />
          </form>
        )}
      </Modal>
    </>
  );
}
export function MandatModal({ dict, locale, cabinetId, gestionnaires, mandat }: { dict: Dict; locale: Locale; cabinetId: string; gestionnaires: GestionnaireOption[]; mandat?: CabinetMandat }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existante" | "nouvelle">("existante");
  const [state, action] = useActionState(mandat ? modifierMandat : proposerMandat, IDLE);
  const t = dict.cabinet;
  const d = state.status === "success" ? (state.data as CabinetMandat | undefined) : undefined;
  return (
    <>
      <Button variant={mandat ? "ghost" : "primary"} size={mandat ? "sm" : "md"} onClick={() => setOpen(true)}>{mandat ? t.modifierMandat : <><IconPlus width={16} height={16} />{t.proposerMandat}</>}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={mandat ? t.modifierMandat : t.proposerMandat} subtitle={mandat?.copropriete.nom} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={mandat ? t.mandatModifie : d?.statut === "ACTIF" ? t.mandatCree : t.mandatPropose} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={cabinetId} />
            {mandat ? <input type="hidden" name="mandat_id" value={mandat.id} /> : (
              <>
                <p className="text-sm text-body">{t.proposerMandatAide}</p>
                <input type="hidden" name="mode" value={mode} />
                <div className="flex gap-2">{(["existante", "nouvelle"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 text-[12.5px] ${mode === m ? "border-ink bg-ink text-white" : "border-hairline text-body"}`}>{m === "existante" ? t.coproprieteExistante : t.nouvelleCopropriete}</button>)}</div>
                {mode === "existante" ? <Field label={t.coproprieteExistante} htmlFor="copropriete_id" required error={fieldError(state, "copropriete_id")}><Input id="copropriete_id" name="copropriete_id" required dir="ltr" className="font-mono text-[12px] text-start" /></Field> : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Field label={t.nom} htmlFor="nom_copro" required><Input id="nom_copro" name="nom" required maxLength={200} /></Field></div>
                    <Field label={t.adresse} htmlFor="adresse_copro" required><Input id="adresse_copro" name="adresse" required maxLength={500} /></Field>
                    <Field label={t.ville} htmlFor="ville_copro" required><Input id="ville_copro" name="ville" required maxLength={100} /></Field>
                    <Field label={t.nbLots} htmlFor="nb_lots" required><Input id="nb_lots" name="nb_lots" type="number" min={1} max={10000} required dir="ltr" className="tnum text-start" /></Field>
                  </div>
                )}
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.gestionnairePrincipal} htmlFor="gestionnaire_principal_id" hint={t.gestionnairePrincipalAide} error={fieldError(state, "gestionnaire_principal_id")}><Select id="gestionnaire_principal_id" name="gestionnaire_principal_id" defaultValue={mandat?.gestionnairePrincipalId ?? gestionnaires[0]?.id ?? ""}>{gestionnaires.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}</Select></Field>
              {mandat ? null : <Field label={t.dateDebut} htmlFor="date_debut_mandat" required error={fieldError(state, "date_debut_mandat")}><Input id="date_debut_mandat" name="date_debut_mandat" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} dir="ltr" className="tnum text-start" /></Field>}
              <Field label={t.dateFin} htmlFor="date_fin_mandat" optionalLabel={dict.common.optional} error={fieldError(state, "date_fin_mandat")}><Input id="date_fin_mandat" name="date_fin_mandat" type="date" defaultValue={mandat?.dateFinMandat ?? ""} dir="ltr" className="tnum text-start" /></Field>
              <Field label={t.honoraires} htmlFor="honoraires_mensuels" hint={t.honorairesAide} optionalLabel={dict.common.optional} error={fieldError(state, "honoraires_mensuels")}><Input id="honoraires_mensuels" name="honoraires_mensuels" inputMode="decimal" placeholder="2500.00" defaultValue={mandat?.honorairesMensuels ?? ""} dir="ltr" className="tnum text-start" /></Field>
              {mandat ? null : <Field label={t.resolutionAg} htmlFor="resolution_ag_id" optionalLabel={dict.common.optional}><Input id="resolution_ag_id" name="resolution_ag_id" dir="ltr" className="font-mono text-[12px] text-start" /></Field>}
            </div>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={mandat ? dict.common.save : t.proposerMandat} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function TerminerMandatModal({ dict, locale, cabinetId, mandat }: { dict: Dict; locale: Locale; cabinetId: string; mandat: CabinetMandat }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(terminerMandat, IDLE);
  const t = dict.cabinet;
  return (
    <>
      <Button variant="dangerGhost" size="sm" onClick={() => setOpen(true)}>{t.terminerMandat}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.terminerMandat} subtitle={mandat.copropriete.nom} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.mandatTermine} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={cabinetId} /><input type="hidden" name="mandat_id" value={mandat.id} />
            <IrreversibleNotice>{t.terminerCorps}</IrreversibleNotice>
            <Field label={t.dateFin} htmlFor="date_fin_term" optionalLabel={dict.common.optional}><Input id="date_fin_term" name="date_fin" type="date" defaultValue={new Date().toISOString().slice(0, 10)} dir="ltr" className="tnum text-start" /></Field>
            <Field label={t.motif} htmlFor="motif_term" optionalLabel={dict.common.optional}><Textarea id="motif_term" name="motif" rows={2} maxLength={1000} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.terminerMandat} danger />
          </form>
        )}
      </Modal>
    </>
  );
}
export function PrestataireModeleModal({ dict, locale, cabinetId }: { dict: Dict; locale: Locale; cabinetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerPrestataireModele, IDLE);
  const t = dict.cabinet;
  return (
    <>
      <Button onClick={() => setOpen(true)}><IconPlus width={16} height={16} />{t.ajouterPrestataire}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.ajouterPrestataire} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={dict.cabinet.parametresEnregistres} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={cabinetId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.nom} htmlFor="nom_p" required><Input id="nom_p" name="nom" required maxLength={200} /></Field>
              <Field label={t.specialite} htmlFor="specialite_p" required><Input id="specialite_p" name="specialite" required maxLength={120} /></Field>
              <Field label={t.telephone} htmlFor="tel_p" optionalLabel={dict.common.optional}><Input id="tel_p" name="telephone" dir="ltr" className="text-start" /></Field>
              <Field label={t.email} htmlFor="email_p" optionalLabel={dict.common.optional}><Input id="email_p" name="email" type="email" dir="ltr" className="text-start" /></Field>
              <Field label="ICE" htmlFor="ice_p" optionalLabel={dict.common.optional}><Input id="ice_p" name="ice" dir="ltr" className="tnum text-start" /></Field>
              <Field label="RC" htmlFor="rc_p" optionalLabel={dict.common.optional}><Input id="rc_p" name="rc" dir="ltr" className="text-start" /></Field>
            </div>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.ajouterPrestataire} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function CopierPrestataireModal({ dict, locale, cabinetId, modele, coproprietes }: { dict: Dict; locale: Locale; cabinetId: string; modele: CabinetPrestataire; coproprietes: { id: string; nom: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(copierPrestataire, IDLE);
  const t = dict.cabinet;
  const r = state.status === "success" ? (state.data as { copie: boolean } | undefined) : undefined;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{t.copierDans}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.copierDans} subtitle={modele.nom} closeLabel={dict.common.close}>
        {r ? <Succes dict={dict} message={r.copie ? t.copie : t.dejaCopie} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={cabinetId} /><input type="hidden" name="modele_id" value={modele.id} />
            <Field label={t.coproprietes} htmlFor="copro_copie" required><Select id="copro_copie" name="copropriete_id" defaultValue={coproprietes[0]?.id ?? ""}>{coproprietes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.copierDans} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function ParametresCabinetForm({ dict, locale, cabinet }: { dict: Dict; locale: Locale; cabinet: Cabinet }) {
  const [state, action] = useActionState(modifierCabinet, IDLE);
  const t = dict.cabinet;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={cabinet.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.nom} htmlFor="nom_cab" required><Input id="nom_cab" name="nom" required defaultValue={cabinet.nom} maxLength={200} /></Field>
        <Field label={t.raisonSociale} htmlFor="rs_cab" optionalLabel={dict.common.optional}><Input id="rs_cab" name="raison_sociale" defaultValue={cabinet.raisonSociale ?? ""} maxLength={200} /></Field>
        <Field label={t.telephone} htmlFor="tel_cab" optionalLabel={dict.common.optional}><Input id="tel_cab" name="telephone" defaultValue={cabinet.telephone ?? ""} dir="ltr" className="text-start" /></Field>
        <Field label={t.email} htmlFor="email_cab" optionalLabel={dict.common.optional}><Input id="email_cab" name="email" type="email" defaultValue={cabinet.email ?? ""} dir="ltr" className="text-start" /></Field>
        <div className="sm:col-span-2"><Field label={t.adresse} htmlFor="adresse_cab" optionalLabel={dict.common.optional}><Input id="adresse_cab" name="adresse" defaultValue={cabinet.adresse ?? ""} maxLength={300} /></Field></div>
        <Field label={t.seuilRecouvrement} htmlFor="seuil" hint={t.seuilRecouvrementAide}><Input id="seuil" name="seuil_recouvrement" type="number" min={0} max={100} defaultValue={cabinet.parametres.seuil_recouvrement ?? ""} dir="ltr" className="tnum text-start" /></Field>
        <Field label={t.delaiJustificatifs} htmlFor="delai" hint={t.delaiJustificatifsAide}><Input id="delai" name="delai_justificatifs_jours" type="number" min={1} max={90} defaultValue={cabinet.parametres.delai_justificatifs_jours ?? ""} dir="ltr" className="tnum text-start" /></Field>
      </div>
      <FormAlert state={state} />
      {state.status === "success" ? <p className="text-sm text-ok">{t.parametresEnregistres}</p> : null}
      <div className="flex justify-end"><SubmitButton>{dict.common.save}</SubmitButton></div>
    </form>
  );
}
export function ConfirmerMandatModal({ dict, locale, mandat, coproprieteId }: { dict: Dict; locale: Locale; mandat: MandatCopropriete; coproprieteId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(confirmerMandat, IDLE);
  const t = dict.cabinet;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t.confirmer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.confirmer} subtitle={mandat.cabinet.nom} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.confirme} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="cabinet_id" value={mandat.cabinet.id} /><input type="hidden" name="copropriete_id" value={coproprieteId} />
            <IrreversibleNotice>{t.confirmerCorps}</IrreversibleNotice>
            <p className="text-sm text-body">{t.gestionnaireDesigne} : <strong>{mandat.gestionnairePrincipal ? `${mandat.gestionnairePrincipal.prenom ?? ""} ${mandat.gestionnairePrincipal.nom ?? ""}`.trim() : "—"}</strong>{mandat.honorairesMensuels ? ` · ${fill(t.honoraires, {})} ${mandat.honorairesMensuels} MAD` : ""}</p>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.confirmer} danger />
          </form>
        )}
      </Modal>
    </>
  );
}
