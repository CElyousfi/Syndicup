"use client";

import { useActionState } from "react";
import { Button } from "../../../../../components/ui/button";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { IDLE } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { lireRib } from "../../finances/depenses/actions";

/** Affiche le RIB complet à la demande (syndic) — chaque lecture est auditée côté API. */
export function RibButton({ dict, locale, prestataireId, ribMasque }: { dict: Dict; locale: Locale; prestataireId: string; ribMasque: string | null }) {
  const [state, action] = useActionState(lireRib, IDLE);
  const d = dict.depenses;
  const rib = state.status === "success" ? ((state.data as { rib?: string | null } | undefined)?.rib ?? null) : null;
  return (
    <div className="mt-2">
      {rib ? (
        <p className="tnum rounded-field bg-hover px-3 py-2 font-mono text-[14px] text-ink" dir="ltr">
          {rib.replace(/(\d{3})(\d{3})(\d{16})(\d{2})/, "$1 $2 $3 $4")}
        </p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="prestataire_id" value={prestataireId} />
          <span className="tnum text-sm text-body" dir="ltr">{ribMasque ?? d.ribNonRenseigne}</span>
          {ribMasque ? (
            <SubmitButton variant="secondary" size="sm">
              {d.ribAfficher}
            </SubmitButton>
          ) : null}
          <span className="text-[12px] text-faint">{d.ribAfficherAide}</span>
        </form>
      )}
      {state.status === "error" ? <FormAlert state={state} /> : null}
      {rib ? <Button variant="ghost" size="sm" className="mt-1" onClick={() => window.location.reload()}>{dict.common.hide}</Button> : null}
    </div>
  );
}
