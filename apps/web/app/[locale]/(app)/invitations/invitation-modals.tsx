"use client";

import { useActionState, useMemo, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { CopyButton } from "../../../../components/ui/copy";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { CanalInvitation, RoleType } from "../../../../lib/api/types";
import { creerInvitation, regenererInvitation } from "./actions";
import { IconPlus } from "../../../../components/ui/icons";
import { toast } from "../../../../lib/toast";
import { useEffect } from "react";

const ROLES_SANS_LOT: RoleType[] = ["SYNDIC", "GARDIEN", "PRESTATAIRE"];
// SYNDIC volontairement absent : un syndic n'invite jamais un autre syndic — seul le super
// administrateur attribue ce rôle (depuis la console). L'API refuse de toute façon (403).
const ROLES_INVITABLES: RoleType[] = [
  "PROPRIETAIRE",
  "INDIVISAIRE",
  "LOCATAIRE",
  "PERSONNE_MORALE_REPRESENTANT",
  "CONSEIL_SYNDICAL",
  "GARDIEN",
  "PRESTATAIRE",
];

/** Résultat commun : le code + QR + lien — le syndic transmet lui-même (envoi auto absent). */
function ResultatInvitation({
  dict,
  locale,
  code,
  onClose,
}: {
  dict: Dict;
  locale: Locale;
  code: string;
  onClose: () => void;
}) {
  const inv = dict.invitations;
  const lien = typeof window !== "undefined" ? `${window.location.origin}/${locale}/invitation/${code}` : "";
  return (
    <div className="space-y-4">
      <Banner variant="ok" title={inv.creee}>
        {inv.envoiManuel}
      </Banner>
      <p className="text-[13px] text-body">{inv.transmettre}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-hairline bg-ground px-4 py-3">
        <span className="font-mono text-xl font-semibold tracking-[0.3em] text-ink" dir="ltr">
          {code}
        </span>
        <CopyButton value={code} label={dict.common.copy} copiedLabel={dict.common.copied} />
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <img
          src={`/api/qr?data=${encodeURIComponent(lien)}`}
          alt="QR"
          width={132}
          height={132}
          className="rounded-xl border border-hairline"
        />
        <div className="min-w-0 space-y-2">
          <p className="text-[13px] text-body">{inv.ouQr}</p>
          <p className="truncate rounded-lg bg-ground px-3 py-1.5 font-mono text-[11px] text-soft" dir="ltr">
            {lien}
          </p>
          <CopyButton value={lien} label={inv.lienDirect} copiedLabel={dict.common.copied} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {dict.common.close}
        </Button>
      </div>
    </div>
  );
}

export function CreerInvitationModal({
  dict,
  locale,
  lots,
  ouvertInitialement = false,
}: {
  dict: Dict;
  locale: Locale;
  lots: Array<{ id: string; numero: string }>;
  ouvertInitialement?: boolean;
}) {
  const [open, setOpen] = useState(ouvertInitialement);
  const [role, setRole] = useState<RoleType>("PROPRIETAIRE");
  const [state, action] = useActionState(creerInvitation, IDLE);
  useEffect(() => {
    if (state.status === "success") toast({ titre: inv.creee, tone: "ok", duree: 3500 });
  }, [state.status]);
  const inv = dict.invitations;

  const lotRequis = !ROLES_SANS_LOT.includes(role);
  const resultat = useMemo(
    () => (state.status === "success" ? (state.data as { code: string }) : null),
    [state]
  );

  const fermer = () => setOpen(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {inv.nouvelle}
      </Button>
      <Modal open={open} onClose={fermer} title={inv.nouvelle} subtitle={inv.subtitle} closeLabel={dict.common.close} wide>
        {resultat ? (
          <ResultatInvitation dict={dict} locale={locale} code={resultat.code} onClose={fermer} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={inv.role} htmlFor="inv_role" hint={inv.roleAide} required>
                <Select
                  id="inv_role"
                  name="role_cible"
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleType)}
                  required
                >
                  {ROLES_INVITABLES.map((r) => (
                    <option key={r} value={r}>
                      {dict.roles[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={inv.canal} htmlFor="inv_canal" required>
                <Select id="inv_canal" name="canal" defaultValue="QR_CODE" required>
                  {(["EMAIL", "SMS", "QR_CODE", "WHATSAPP"] as CanalInvitation[]).map((c) => (
                    <option key={c} value={c}>
                      {dict.enums.canal[c]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {lotRequis ? (
              <Field label={inv.lot} htmlFor="inv_lot" required error={fieldError(state, "lot_id")}>
                <Select id="inv_lot" name="lot_id" required defaultValue={lots[0]?.id ?? ""}>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.numero}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="lot_id" value="" />
            )}
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={fermer}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.create}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function RegenererModal({
  dict,
  locale,
  invitationId,
}: {
  dict: Dict;
  locale: Locale;
  invitationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(regenererInvitation, IDLE);
  const inv = dict.invitations;
  const resultat = state.status === "success" ? (state.data as { code: string }) : null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {inv.regenerer}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={inv.regenerer} closeLabel={dict.common.close} wide={resultat !== null}>
        {resultat ? (
          <ResultatInvitation
            dict={dict}
            locale={locale}
            code={resultat.code}
            onClose={() => setOpen(false)}
          />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="invitation_id" value={invitationId} />
            <p className="text-sm text-body">{dict.auth.inviteExpired}</p>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{inv.regenerer}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
