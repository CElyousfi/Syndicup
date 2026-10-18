"use client";

import { useActionState, useState } from "react";
import { ActionModal } from "../../../../../../components/ui/action-modal";
import { ConfirmAction } from "../../../../../../components/ui/confirm-action";
import { IrreversibleNotice } from "../../../../../../components/ui/irreversible-notice";
import { Field, Textarea } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import { formValue } from "../../../../../../lib/form-values";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import { annulerSejour, ajouterPiecesJointes, retirerPieceJointe } from "../../actions";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { FileViewerButton } from "../../../../../../components/documents/document-viewer";
import { IconCamera, IconFile } from "../../../../../../components/ui/icons";
import { FadeImg } from "../../../../../../components/ui/motion/fade-img";

/** Annulation d'un séjour PREVU — confirmation explicite, motif facultatif, gardien notifié. */
export function AnnulerSejourModal({
  dict,
  locale,
  sejourId,
  voyageurNom,
}: {
  dict: Dict;
  locale: Locale;
  sejourId: string;
  voyageurNom: string;
}) {
  const l = dict.lcd;
  return (
    <ActionModal
      action={annulerSejour}
      title={l.annuler}
      closeLabel={dict.common.close}
      success={{ message: l.annule, closeAndToast: true }}
      trigger={(open) => (
        <Button variant="dangerGhost" onClick={open}>
          {l.annuler}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="sejour_id" value={sejourId} />
          <p className="text-[15px] font-semibold text-ink">{fill(l.annulerQuestion, { nom: voyageurNom })}</p>
          <Field label={l.motifAnnulation} htmlFor="a_motif" optionalLabel={dict.common.optional} error={fieldError(state, "motif")}>
            <Textarea id="a_motif" name="motif" rows={3} maxLength={500} defaultValue={formValue(state, "motif")} />
          </Field>
          <IrreversibleNotice>{l.annulerAide}</IrreversibleNotice>
          <FormAlert state={state} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              {dict.common.close}
            </Button>
            <SubmitButton variant="danger">{l.annuler}</SubmitButton>
          </div>
        </form>
      )}
    </ActionModal>
  );
}

/**
 * Pièces jointes du séjour — galerie (image : aperçu + visionneuse intégrée ; PDF : visionneuse),
 * ajout par photo prise / fichier, retrait. Tout reste dans l'application.
 */
export function PiecesJointesCard({
  dict,
  locale,
  sejourId,
  pieces,
  peutJoindre,
  peutRetirer,
}: {
  dict: Dict;
  locale: Locale;
  sejourId: string;
  pieces: Array<{ path: string; nom: string; type: "IMAGE" | "PDF"; src: string }>;
  peutJoindre: boolean;
  peutRetirer: boolean;
}) {
  const l = dict.lcd;
  const [state, action] = useActionState(ajouterPiecesJointes, IDLE);
  const [nb, setNb] = useState(0);
  const labels = { see: dict.common.see, close: dict.common.close, download: dict.common.download };

  return (
    <Card>
      <SectionHeader title={l.piecesJointes} subtitle={l.piecesJointesAide} />
      {pieces.length === 0 ? (
        <EmptyState className="py-6" title={l.aucunePiece} illustration="empty-documents" />
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {pieces.map((pj) => (
            <li key={pj.path} className="flex items-center gap-3 rounded-2xl bg-surface p-2.5">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-wash">
                {pj.type === "IMAGE" ? (
                  <FadeImg src={pj.src} alt="" className="size-16 object-cover" />
                ) : (
                  <IconFile width={22} height={22} className="text-soft" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink" dir="ltr">
                  {pj.nom}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <FileViewerButton src={pj.src} nom={pj.nom} labels={labels} size="sm" variant="secondary" tour="lcd-piece" />
                  {peutRetirer ? (
                    <ConfirmAction
                      action={retirerPieceJointe}
                      fields={{ locale, sejour_id: sejourId, chemin: pj.path }}
                      triggerLabel={l.retirerPiece}
                      title={dict.formulaires.confirmer.pieceRetirerTitre}
                      question={fill(dict.formulaires.confirmer.pieceRetirerQuestion, { nom: pj.nom })}
                      consequence={dict.formulaires.confirmer.pieceRetirerConsequence}
                      confirmLabel={dict.formulaires.confirmer.pieceRetirerConfirmer}
                      closeLabel={dict.common.close}
                      success={l.pieceRetiree}
                    />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {peutJoindre && pieces.length < 10 ? (
        <form action={action} className="mt-5 space-y-2 border-t border-wash-strong pt-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="sejour_id" value={sejourId} />

          <div className="flex flex-wrap items-center gap-2">
            <label className="su-btn inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-btn border-[1.5px] border-link px-4 text-[13px] font-semibold text-link hover:bg-action-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action">
              <IconCamera width={15} height={15} />
              {l.prendrePhoto}
              <input type="file" name="pieces_jointes" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setNb((n) => n + (e.target.files?.length ?? 0))} />
            </label>
            <label className="su-btn inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-btn border-[1.5px] border-link px-4 text-[13px] font-semibold text-link hover:bg-action-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action">
              <IconFile width={15} height={15} />
              {l.choisirFichier}
              <input type="file" name="pieces_jointes" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" multiple className="sr-only" onChange={(e) => setNb((n) => n + (e.target.files?.length ?? 0))} />
            </label>
            {nb > 0 ? (
              <>
                <span className="text-[13px] text-soft">{fill(l.fichiersSelectionnes, { n: nb })}</span>
                <SubmitButton size="sm">{l.ajouterPieces}</SubmitButton>
              </>
            ) : null}
          </div>
          {fieldError(state, "pieces_jointes") ? <p className="text-[12px] text-danger">{fieldError(state, "pieces_jointes")}</p> : null}
          <FormAlert state={state} />
        </form>
      ) : null}
    </Card>
  );
}
