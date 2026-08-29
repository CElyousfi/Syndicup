"use client";

/**
 * Fiche client — (ré)émission de l'invitation SYNDIC depuis la console, sans jamais entrer
 * dans l'espace de la copropriété : la cible est passée explicitement à l'API.
 */
import { useActionState, useMemo, useState } from "react";
import { Button } from "../../../../../../components/ui/button";
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
        onClose={() => setOpen(false)}
        title={ad.inviterSyndic}
        subtitle={coproprieteNom}
        closeLabel={dict.common.close}
      >
        {resultat ? (
          <div className="space-y-4 text-center">
            <p className="text-[13px] text-soft">{ad.codePret}</p>
            <p className="tnum text-3xl font-semibold tracking-[0.2em] text-ink" dir="ltr">
              {resultat.code}
            </p>
            <p className="text-[12px] text-faint">
              {fill(dict.auth.inviteExpireLe, { date: formatDateHeure(resultat.expireLe, locale) })}
            </p>
            {lien ? (
              <img
                src={`/api/qr?data=${encodeURIComponent(lien)}`}
                alt=""
                width={168}
                height={168}
                className="mx-auto rounded-xl border border-hairline"
              />
            ) : null}
            <div className="flex flex-wrap justify-center gap-2">
              <CopyButton value={resultat.code} label={dict.common.copy} copiedLabel={dict.common.copied} />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  fill(ad.messageWhatsApp, { nom: coproprieteNom, lien, code: resultat.code })
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-btn bg-ok px-4 text-[13px] font-medium text-white"
              >
                {ad.partagerWhatsApp}
              </a>
            </div>
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
