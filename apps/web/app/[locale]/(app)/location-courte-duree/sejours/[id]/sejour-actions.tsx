"use client";

import { useActionState, useState } from "react";
import { IrreversibleNotice, Modal } from "../../../../../../components/ui/modal";
import { Field, Textarea } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { Banner } from "../../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import { annulerSejour, ajouterPiecesJointes, retirerPieceJointe } from "../../actions";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { FileViewerButton } from "../../../../../../components/documents/document-viewer";
import { IconFile } from "../../../../../../components/ui/icons";

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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(annulerSejour, IDLE);

  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>
        {l.annuler}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={l.annuler} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <Banner variant="ok">{l.annule}</Banner>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sejour_id" value={sejourId} />
            <p className="text-[15px] font-semibold text-ink">{fill(l.annulerQuestion, { nom: voyageurNom })}</p>
            <Field label={l.motifAnnulation} htmlFor="a_motif" optionalLabel={dict.common.optional} error={fieldError(state, "motif")}>
              <Textarea id="a_motif" name="motif" rows={3} maxLength={500} />
            </Field>
            <IrreversibleNotice>{l.annulerAide}</IrreversibleNotice>
            <FormAlert state={state} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger">{l.annuler}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
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
  const [retraitState, retrait] = useActionState(retirerPieceJointe, IDLE);
  const [nb, setNb] = useState(0);
  const labels = { see: dict.common.see, close: dict.common.close, download: dict.common.download };

  return (
    <Card>
      <SectionHeader title={l.piecesJointes} subtitle={l.piecesJointesAide} />
      {pieces.length === 0 ? (
        <p className="mt-4 text-[13px] text-faint">{l.aucunePiece}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {pieces.map((pj) => (
            <li key={pj.path} className="flex items-center gap-3 rounded-2xl border border-hairline bg-ground/60 p-2">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
                {pj.type === "IMAGE" ? (
                  <img src={pj.src} alt="" className="size-16 object-cover" />
                ) : (
                  <IconFile width={22} height={22} className="text-soft" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink" dir="ltr">
                  {pj.nom}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <FileViewerButton src={pj.src} nom={pj.nom} labels={labels} size="sm" variant="secondary" tour="lcd-piece" />
                  {peutRetirer ? (
                    <form action={retrait}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="sejour_id" value={sejourId} />
                      <input type="hidden" name="chemin" value={pj.path} />
                      <input type="hidden" name="message_succes" value={l.pieceRetiree} />
                      <Button type="submit" variant="dangerGhost" size="sm">
                        {l.retirerPiece}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormAlert state={retraitState} />
      {peutJoindre && pieces.length < 10 ? (
        <form action={action} className="mt-4 space-y-2 border-t border-hairline pt-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="sejour_id" value={sejourId} />
          <input type="hidden" name="message_succes" value={l.pieceAjoutee} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-strong hover:bg-hover">
              {l.prendrePhoto}
              <input type="file" name="pieces_jointes" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setNb((n) => n + (e.target.files?.length ?? 0))} />
            </label>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-strong hover:bg-hover">
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
