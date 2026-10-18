"use client";

import { useActionState, useState } from "react";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { ConfirmAction } from "../../../../components/ui/confirm-action";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { IconCircle, CBuilding } from "../../../../components/ui/color-icons";
import { retirerLogo, televerserLogo } from "./actions";
import { FadeImg } from "../../../../components/ui/motion/fade-img";

/**
 * Logo de la résidence — aperçu immédiat de l'image choisie, envoi en un geste, retrait
 * possible. Le rendu partout ailleurs (menu, barre mobile) suit dès l'enregistrement.
 */
export function LogoForm({ dict, locale, coproId, logoActuel }: { dict: Dict; locale: Locale; coproId: string; logoActuel: string | null }) {
  const pa = dict.parametres;
  const [state, action] = useActionState(televerserLogo, IDLE);

  const [apercu, setApercu] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const src = apercu ?? (logoActuel ? `/api/copro-logo?id=${coproId}&v=${encodeURIComponent(logoActuel)}` : null);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-surface">
        {src ? (
          <FadeImg src={src} alt="" className="size-24 object-cover" />
        ) : (
          <IconCircle tone="sage" size={56}>
            <CBuilding width={28} height={28} />
          </IconCircle>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-[14px] leading-relaxed text-soft">{pa.logoAide}</p>
        <form action={action} className="space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="copro_id" value={coproId} />
          <input type="hidden" name="succes" value="logoEnregistre" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="su-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-btn border-[1.5px] border-link px-4 text-[14px] font-semibold text-link transition-colors hover:bg-action-wash">
              {pa.logoChoisir}
              <input type="file"
                name="fichier"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setNomFichier(f.name);
                  const r = new FileReader();
                  r.onload = () => setApercu(String(r.result));
                  r.readAsDataURL(f);
                }}
              />
            </label>
            {nomFichier ? <span className="truncate text-[13px] text-soft">{nomFichier}</span> : logoActuel ? null : <span className="text-[13px] text-faint">{pa.logoAucun}</span>}
          </div>
          {fieldError(state, "fichier") ? <p className="text-[12px] text-danger">{fieldError(state, "fichier")}</p> : null}
          <FormAlert state={state} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton disabled={!nomFichier}>{pa.logoEnregistrer}</SubmitButton>
          </div>
        </form>
        {logoActuel ? (
          <ConfirmAction
            action={retirerLogo}
            fields={{ locale, copro_id: coproId, succes: "logoRetire" }}
            triggerLabel={pa.logoRetirer}
            title={pa.logoRetirer}
            question={dict.formulaires.confirmer.logoRetirerQuestion}
            consequence={dict.formulaires.confirmer.logoRetirerConsequence}
            confirmLabel={dict.formulaires.confirmer.logoRetirerConfirmer}
            closeLabel={dict.common.close}
            success={pa.logoRetire}
          />
        ) : null}
      </div>
    </div>
  );
}
