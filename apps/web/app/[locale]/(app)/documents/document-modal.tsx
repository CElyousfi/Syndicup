"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { VisibiliteDocument } from "../../../../lib/api/types";
import { televerserFichierDocument } from "./actions";
import { IconFile, IconPlus } from "../../../../components/ui/icons";

export function DocumentModal({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [visibilite, setVisibilite] = useState<VisibiliteDocument>("PUBLIC_COPROPRIETE");
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [state, action] = useActionState(televerserFichierDocument, IDLE);
  const d = dict.documents;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {d.televerser}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.televerser} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{d.ajoute}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />

            {/* Fichier — zone de dépôt cliquable */}
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-strong">
                {d.fichier}
              </span>
              <label className="flex cursor-pointer items-center gap-3 rounded-field border border-dashed border-hairline-strong bg-ground/50 px-4 py-4 transition-colors hover:border-action/50 hover:bg-action-wash">
                <IconFile width={20} height={20} className="shrink-0 text-soft" />
                <span className="min-w-0 flex-1 truncate text-sm text-body">
                  {nomFichier ?? d.fichierAide}
                </span>
                <input
                  type="file"
                  name="fichier"
                  required
                  className="sr-only"
                  onChange={(e) => setNomFichier(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              {fieldError(state, "fichier") ? (
                <p className="mt-1.5 text-[13px] text-danger">{fieldError(state, "fichier")}</p>
              ) : null}
            </div>

            <Field label={d.nom} htmlFor="d_nom" error={fieldError(state, "nom")}>
              <Input
                id="d_nom"
                name="nom"
                maxLength={200}
                placeholder={nomFichier ?? undefined}
              />
            </Field>
            <Field label={d.type} htmlFor="d_type" hint={d.typeHint} required>
              <Input id="d_type" name="type" required maxLength={80} />
            </Field>
            <Field label={d.visibilite} htmlFor="d_visibilite" hint={d.visibiliteAide[visibilite]} required>
              <Select
                id="d_visibilite"
                name="visibilite"
                value={visibilite}
                onChange={(e) => setVisibilite(e.target.value as VisibiliteDocument)}
                required
              >
                {(Object.keys(dict.enums.visibiliteDocument) as VisibiliteDocument[]).map((vis) => (
                  <option key={vis} value={vis}>
                    {dict.enums.visibiliteDocument[vis]}
                  </option>
                ))}
              </Select>
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.add}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
