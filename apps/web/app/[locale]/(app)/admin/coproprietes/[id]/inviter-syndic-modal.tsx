"use client";

/**
 * Fiche client — (ré)émission de l'invitation SYNDIC depuis la console, sans jamais entrer
 * dans l'espace de la copropriété : la cible est passée explicitement à l'API.
 */
import { useActionState, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "../../../../../../components/ui/button";
import { Modal } from "../../../../../../components/ui/modal";
import { Field, Select } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { CopyButton } from "../../../../../../components/ui/copy";
import { IconKey } from "../../../../../../components/ui/icons";
import { IDLE } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import { formatDateHeure } from "../../../../../../lib/format";
import type { CanalInvitation } from "../../../../../../lib/api/types";
import { inviterSyndicAdmin } from "../../actions";
import { CodeInvitation } from "../../../invitations/invitation-modals";
import { celebrate } from "../../../../../../lib/success";

export function InviterSyndicModal({
  dict,
  locale,
  coproprieteId,
  coproprieteNom,
}: {
  dict: Dict;
  locale: Locale;
  coproprieteId: string;
  coproprieteNom: string;
}) {
  const ad = dict.admin;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(inviterSyndicAdmin, IDLE);
  const resultat = useMemo(
    () => (state.status === "success" ? (state.data as { code: string; expireLe: string }) : null),
    [state]
  );
  const canaux = Object.keys(dict.enums.canal) as CanalInvitation[];
  // Écran de succès à la fermeture (une fois par code) : la modale le masquerait sinon.
  const celebre = useRef<string | null>(null);
  const fermer = () => {
    setOpen(false);
    if (resultat && celebre.current !== resultat.code) {
      celebre.current = resultat.code;
      celebrate({ titre: ad.codePret, illustration: "ok-invitation" });
    }
  };
  const lien =
    resultat && typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/invitation/${resultat.code}`
      : "";

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconKey width={15} height={15} />
        {ad.inviterSyndic}
      </Button>
      <Modal
        open={open}
        onClose={fermer}
        title={ad.inviterSyndic}
        subtitle={coproprieteNom}
        closeLabel={dict.common.close}
      >
        {resultat ? (
          <div className="rounded-[24px] bg-tile p-3 sm:p-4">
            <CodeInvitation
              code={resultat.code}
              lien={lien}
              titre={ad.codePret}
              pied={fill(dict.auth.inviteExpireLe, { date: formatDateHeure(resultat.expireLe, locale) })}
              actions={
                <>
                  <CopyButton value={resultat.code} label={dict.common.copy} copiedLabel={dict.common.copied} />
                  <ButtonLink
                    href={`https://wa.me/?text=${encodeURIComponent(
                      fill(ad.messageWhatsApp, { nom: coproprieteNom, lien, code: resultat.code })
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                    size="sm"
                  >
                    {ad.partagerWhatsApp}
                  </ButtonLink>
                </>
              }
            />
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="copropriete_id" value={coproprieteId} />
            <p className="text-[13px] text-soft">{ad.syndicAide}</p>
            <Field label={dict.invitations.canal} htmlFor="fc_canal" required>
              <Select id="fc_canal" name="canal" defaultValue="WHATSAPP" required>
                {canaux.map((c) => (
                  <option key={c} value={c}>
                    {dict.enums.canal[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{ad.inviterSyndic}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
