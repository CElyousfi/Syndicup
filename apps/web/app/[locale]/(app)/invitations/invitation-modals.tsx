"use client";

import { useActionState, useMemo, useRef, useState, type ReactNode } from "react";
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
import { celebrate } from "../../../../lib/success";

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

/** Code d'invitation + QR sur un sous-bloc blanc — à poser dans une tuile greige (ou une carte). */
export function CodeInvitation({
  code,
  lien,
  titre,
  pied,
  qrLegende,
  actions,
}: {
  code: string;
  lien: string;
  titre?: ReactNode;
  pied?: ReactNode;
  /** Légende au-dessus du QR (ex. « ou faites-lui scanner ce QR code »). */
  qrLegende?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[20px] bg-surface p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-6">
      <div className="min-w-0 flex-1 text-center sm:order-last sm:text-start">
        {titre ? <p className="text-[13px] text-soft">{titre}</p> : null}
        <p className="mt-1 font-mono text-[28px] font-bold leading-tight tracking-[0.22em] text-ink sm:text-[30px]" dir="ltr">
          {code}
        </p>
        {pied ? <p className="mt-1 text-[12px] text-soft">{pied}</p> : null}
        {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">{actions}</div> : null}
      </div>
      {lien ? (
        <figure className="flex shrink-0 flex-col items-center gap-2">
          {qrLegende ? <figcaption className="max-w-[200px] text-center text-[12px] text-soft">{qrLegende}</figcaption> : null}
          <img
            src={`/api/qr?data=${encodeURIComponent(lien)}`}
            alt="QR"
            width={148}
            height={148}
            className="size-[148px] rounded-xl bg-surface"
          />
        </figure>
      ) : null}
    </div>
  );
}

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
      <div className="rounded-[24px] bg-tile p-3 sm:p-4">
        <CodeInvitation
          code={code}
          lien={lien}
          titre={inv.transmettre}
          qrLegende={inv.ouQr}
          actions={
            <>
              <CopyButton value={code} label={dict.common.copy} copiedLabel={dict.common.copied} />
              <CopyButton value={lien} label={inv.lienDirect} copiedLabel={dict.common.copied} />
            </>
          }
        />
        <p className="mt-3 truncate rounded-xl bg-wash px-3 py-2 font-mono text-[11px] text-soft" dir="ltr">
          {lien}
        </p>
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
  const inv = dict.invitations;
  // Code déjà célébré : l'écran de succès ne s'affiche qu'une fois par invitation.
  const celebre = useRef<string | null>(null);

  const lotRequis = !ROLES_SANS_LOT.includes(role);
  const resultat = useMemo(
    () => (state.status === "success" ? (state.data as { code: string }) : null),
    [state]
  );

  // Écran de succès plein écran à la fermeture : la modale (couche supérieure du navigateur)
  // le masquerait tant que le code et le QR y sont affichés pour être transmis.
  const fermer = () => {
    setOpen(false);
    if (resultat && celebre.current !== resultat.code) {
      celebre.current = resultat.code;
      celebrate({ titre: inv.creee, illustration: "ok-invitation" });
    }
  };

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
