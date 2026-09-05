"use client";

import { useActionState, useState } from "react";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { CLES_PHOTO, PHOTOS_DEFAUT, type ClePhoto } from "../../../../lib/photos";
import { retirerPhoto, televerserPhoto } from "./actions";

export interface EspacePhoto {
  id: string;
  nom: string;
  cleDefaut: ClePhoto;
}

/**
 * Photos de la résidence — un emplacement par ligne (aperçu, où elle apparaît, remplacer,
 * retirer), puis une ligne par espace commun. Le rendu partout ailleurs suit dès l'enregistrement.
 */
export function PhotosForm({
  dict,
  locale,
  coproId,
  photos,
  espaces,
}: {
  dict: Dict;
  locale: Locale;
  coproId: string;
  photos: Record<string, string>;
  espaces: EspacePhoto[];
}) {
  const pa = dict.parametres;
  const LIBELLES: Record<ClePhoto, { titre: string; aide: string }> = {
    accueil: { titre: pa.photoAccueil, aide: pa.photoAccueilAide },
    entree: { titre: pa.photoEntree, aide: pa.photoEntreeAide },
    cour: { titre: pa.photoCour, aide: pa.photoCourAide },
    salle: { titre: pa.photoSalle, aide: pa.photoSalleAide },
    piscine: { titre: pa.photoPiscine, aide: pa.photoPiscineAide },
  };
  const src = (cle: string, defaut: string) =>
    photos[cle] ? `/api/copro-photo?id=${coproId}&cle=${encodeURIComponent(cle)}&v=${encodeURIComponent(photos[cle]!)}` : defaut;

  return (
    <div className="space-y-6">
      <p className="text-[13px] leading-relaxed text-soft">{pa.photosAide}</p>
      <div className="space-y-3">
        {CLES_PHOTO.map((cle) => (
          <PhotoSlot
            key={cle}
            dict={dict}
            locale={locale}
            coproId={coproId}
            cle={cle}
            titre={LIBELLES[cle].titre}
            aide={LIBELLES[cle].aide}
            src={src(cle, PHOTOS_DEFAUT[cle])}
            personnalisee={Boolean(photos[cle])}
          />
        ))}
      </div>
      {espaces.length > 0 ? (
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{pa.photosEspaces}</h3>
          <p className="mb-3 mt-1 text-[13px] leading-relaxed text-soft">{pa.photosEspacesAide}</p>
          <div className="space-y-3">
            {espaces.map((e) => {
              const cle = `espace:${e.id}`;
              return (
                <PhotoSlot
                  key={cle}
                  dict={dict}
                  locale={locale}
                  coproId={coproId}
                  cle={cle}
                  titre={e.nom}
                  aide={LIBELLES[e.cleDefaut].titre}
                  src={src(cle, src(e.cleDefaut, PHOTOS_DEFAUT[e.cleDefaut]))}
                  personnalisee={Boolean(photos[cle])}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhotoSlot({
  dict,
  locale,
  coproId,
  cle,
  titre,
  aide,
  src,
  personnalisee,
}: {
  dict: Dict;
  locale: Locale;
  coproId: string;
  cle: string;
  titre: string;
  aide: string;
  src: string;
  personnalisee: boolean;
}) {
  const pa = dict.parametres;
  const [state, action] = useActionState(televerserPhoto, IDLE);
  const [retraitState, retrait] = useActionState(retirerPhoto, IDLE);
  const [apercu, setApercu] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-ground/60 p-3 sm:flex-row sm:items-start">
      <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-2xl bg-ground sm:w-40">
        <img src={apercu ?? src} alt="" className="size-full object-cover" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-ink">{titre}</p>
          <Badge variant={personnalisee ? "info" : "neutral"}>{personnalisee ? pa.photoPersonnalisee : pa.photoDefaut}</Badge>
        </div>
        <p className="text-[13px] text-soft">{aide}</p>
        <form action={action} className="space-y-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="copro_id" value={coproId} />
          <input type="hidden" name="cle" value={cle} />
          <input type="hidden" name="message_succes" value={pa.photoMiseAJour} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-4 text-[13px] font-medium text-ink-strong hover:bg-hover">
              {pa.logoChoisir}
              <input
                type="file"
                name="fichier"
                accept="image/png,image/jpeg,image/webp"
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
            {nomFichier ? <span className="truncate text-[13px] text-soft">{nomFichier}</span> : null}
            {nomFichier ? <SubmitButton size="sm">{pa.photoEnregistrer}</SubmitButton> : null}
          </div>
          {fieldError(state, "fichier") ? <p className="text-[12px] text-danger">{fieldError(state, "fichier")}</p> : null}
          <FormAlert state={state} />
        </form>
        {personnalisee ? (
          <form action={retrait}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="copro_id" value={coproId} />
            <input type="hidden" name="cle" value={cle} />
            <input type="hidden" name="message_succes" value={pa.photoRetiree} />
            <FormAlert state={retraitState} />
            <Button type="submit" variant="dangerGhost" size="sm">
              {pa.photoRetirer}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
