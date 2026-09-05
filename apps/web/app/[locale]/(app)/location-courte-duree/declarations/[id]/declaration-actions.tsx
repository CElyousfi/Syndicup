"use client";

import { useActionState, useState } from "react";
import { IrreversibleNotice, Modal } from "../../../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { Banner } from "../../../../../../components/ui/banner";
import { Segmented } from "../../../../../../components/ui/tabs";
import { CopyButton } from "../../../../../../components/ui/copy";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import type { CanalInvitation, LcdDeclaration, StatutDeclarationLcd } from "../../../../../../lib/api/types";
import {
  cloturerDeclaration,
  deciderDeclaration,
  designerGestionnaire,
  modifierDeclaration,
} from "../../actions";

type Decision = "VALIDEE" | "REFUSEE" | "SUSPENDUE";

/** Panneau syndic : les transitions offertes dépendent du statut courant (l'API re-vérifie). */
export function DecisionPanel({
  dict,
  locale,
  declarationId,
  statut,
}: {
  dict: Dict;
  locale: Locale;
  declarationId: string;
  statut: StatutDeclarationLcd;
}) {
  const l = dict.lcd;
  const [state, action] = useActionState(deciderDeclaration, IDLE);
  const options: Array<{ value: Decision; label: string; variant: "primary" | "danger" | "secondary" }> =
    statut === "EN_ATTENTE"
      ? [
          { value: "VALIDEE", label: l.valider, variant: "primary" },
          { value: "REFUSEE", label: l.refuser, variant: "danger" },
        ]
      : statut === "VALIDEE"
        ? [{ value: "SUSPENDUE", label: l.suspendre, variant: "danger" }]
        : statut === "SUSPENDUE"
          ? [
              { value: "VALIDEE", label: l.retablir, variant: "primary" },
              { value: "REFUSEE", label: l.refuser, variant: "danger" },
            ]
          : [{ value: "VALIDEE", label: l.valider, variant: "primary" }];
  const [decision, setDecision] = useState<Decision>(options[0]!.value);
  const motifRequis = decision !== "VALIDEE";

  if (state.status === "success") {
    return <Banner variant="ok">{l.decisionEnregistree}</Banner>;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="declaration_id" value={declarationId} />
      <input type="hidden" name="decision" value={decision} />
      <p className="text-[13px] text-soft">{l.decisionAide}</p>
      {options.length > 1 ? (
        <Segmented
          value={decision}
          onChange={setDecision}
          options={options.map((o) => ({ value: o.value, label: o.label }))}
        />
      ) : null}
      <Field
        label={l.motif}
        htmlFor="dec_motif"
        hint={l.motifAide}
        required={motifRequis}
        optionalLabel={dict.common.optional}
        error={fieldError(state, "motif")}
      >
        <Textarea id="dec_motif" name="motif" rows={3} maxLength={1000} required={motifRequis} />
      </Field>
      <FormAlert state={state} />
      <div className="flex justify-end">
        <SubmitButton variant={options.find((o) => o.value === decision)?.variant ?? "primary"}>
          {options.find((o) => o.value === decision)?.label ?? l.valider}
        </SubmitButton>
      </div>
    </form>
  );
}

const CANAUX: CanalInvitation[] = ["SMS", "WHATSAPP", "EMAIL", "QR_CODE"];

/** Propriétaire / syndic : désigne un gestionnaire (compte connu, ou invitation email/téléphone). */
export function DesignerGestionnaireModal({
  dict,
  locale,
  declarationId,
  dejaDesigne,
}: {
  dict: Dict;
  locale: Locale;
  declarationId: string;
  dejaDesigne: boolean;
}) {
  const l = dict.lcd;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"compte" | "email" | "telephone">("telephone");
  const [state, action] = useActionState(designerGestionnaire, IDLE);
  const invitation =
    state.status === "success"
      ? ((state.data as { invitation: { code: string; expireLe: string } | null } | undefined)?.invitation ?? null)
      : null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {dejaDesigne ? l.changerGestionnaire : l.designerGestionnaire}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={dejaDesigne ? l.changerGestionnaire : l.designerGestionnaire}
        subtitle={l.gestionnaireAide}
        closeLabel={dict.common.close}
      >
        {state.status === "success" ? (
          <div className="space-y-4">
            {invitation ? (
              <>
                <Banner variant="ok">{l.gestionnaireInvite}</Banner>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-ground px-4 py-3">
                  <span className="font-mono text-lg font-semibold tracking-wider text-ink" dir="ltr">
                    {invitation.code}
                  </span>
                  <CopyButton value={invitation.code} label={dict.common.copy} copiedLabel={dict.common.copied} />
                </div>
                <p className="text-[13px] text-soft">{dict.invitations.envoiManuel}</p>
              </>
            ) : (
              <Banner variant="ok">{l.gestionnaireDesigne}</Banner>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="declaration_id" value={declarationId} />
            <input type="hidden" name="mode" value={mode} />
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "telephone", label: l.gestionnaireTelephone },
                { value: "email", label: l.gestionnaireEmail },
                { value: "compte", label: l.gestionnaireCompte },
              ]}
            />
            {mode === "compte" ? (
              <Field label={l.gestionnaireId} htmlFor="g_id" hint={l.gestionnaireIdAide} required error={fieldError(state, "utilisateur_id")}>
                <Input id="g_id" name="utilisateur_id" required dir="ltr" className="font-mono text-[13px]" />
              </Field>
            ) : mode === "email" ? (
              <Field label={l.gestionnaireEmail} htmlFor="g_email" required error={fieldError(state, "email")}>
                <Input id="g_email" name="email" type="email" required dir="ltr" maxLength={200} />
              </Field>
            ) : (
              <Field label={l.gestionnaireTelephone} htmlFor="g_tel" required error={fieldError(state, "telephone")}>
                <Input id="g_tel" name="telephone" type="tel" required dir="ltr" placeholder="+2126…" maxLength={20} />
              </Field>
            )}
            {mode !== "compte" ? (
              <Field label={l.canalInvitation} htmlFor="g_canal" required>
                <Select id="g_canal" name="canal" defaultValue={mode === "email" ? "EMAIL" : "SMS"}>
                  {CANAUX.map((c) => (
                    <option key={c} value={c}>
                      {dict.enums.canal[c]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="canal" value="SMS" />
            )}
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.confirm}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/** Propriétaire / gestionnaire / syndic : plateformes + contact d'urgence (PATCH). */
export function ModifierContactsModal({
  dict,
  locale,
  declaration,
}: {
  dict: Dict;
  locale: Locale;
  declaration: LcdDeclaration;
}) {
  const l = dict.lcd;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(modifierDeclaration, IDLE);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {l.modifierContacts}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={l.modifierContacts} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <Banner variant="ok">{l.contactsModifies}</Banner>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="declaration_id" value={declaration.id} />
            <Field label={l.plateformes} htmlFor="m_plateformes" hint={l.plateformesAide} optionalLabel={dict.common.optional} error={fieldError(state, "plateformes")}>
              <Input id="m_plateformes" name="plateformes" maxLength={200} defaultValue={(declaration.plateformesJson ?? []).join(", ")} />
            </Field>
            <Field label={l.contactUrgenceNom} htmlFor="m_cu_nom" optionalLabel={dict.common.optional} error={fieldError(state, "contact_urgence_nom")}>
              <Input id="m_cu_nom" name="contact_urgence_nom" maxLength={120} defaultValue={declaration.contactUrgenceNom ?? ""} />
            </Field>
            <Field label={l.contactUrgenceTelephone} htmlFor="m_cu_tel" optionalLabel={dict.common.optional} error={fieldError(state, "contact_urgence_telephone")}>
              <Input id="m_cu_tel" name="contact_urgence_telephone" type="tel" dir="ltr" maxLength={20} defaultValue={declaration.contactUrgenceTelephone ?? ""} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.save}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/** Clôture — confirmation explicite ; l'API refuse (409) si un séjour est prévu ou en cours. */
export function CloturerModal({
  dict,
  locale,
  declarationId,
  lotNumero,
}: {
  dict: Dict;
  locale: Locale;
  declarationId: string;
  lotNumero: string;
}) {
  const l = dict.lcd;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cloturerDeclaration, IDLE);

  return (
    <>
      <Button variant="dangerGhost" size="sm" onClick={() => setOpen(true)}>
        {l.cloturer}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={l.cloturer} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <Banner variant="ok">{l.cloturee}</Banner>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="declaration_id" value={declarationId} />
            <p className="text-[15px] font-semibold text-ink">{fill(l.cloturerQuestion, { lot: lotNumero })}</p>
            <Field label={l.dateFin} htmlFor="c_fin" optionalLabel={dict.common.optional} error={fieldError(state, "date_fin")}>
              <Input id="c_fin" name="date_fin" type="date" className="tnum" />
            </Field>
            <IrreversibleNotice>{l.cloturerAide}</IrreversibleNotice>
            <FormAlert state={state} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger">{l.cloturer}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
