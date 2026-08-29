"use client";

/**
 * Sélecteur de photos de signalement — caméra directe (mobile) OU galerie, aperçus
 * retirables, compression côté client (max 1600 px, JPEG) avant envoi : un signalement
 * photo depuis un téléphone marocain 3G doit rester léger. Le champ réel du formulaire
 * est un <input type="file"> synchronisé (DataTransfer) : la Server Action reçoit les
 * fichiers en multipart, sans JavaScript de soumission particulier.
 */
import { useEffect, useRef, useState } from "react";
import { IconCamera, IconImage, IconX } from "../ui/icons";

const MAX_PHOTOS = 5;
const MAX_COTE = 1600;

async function compresser(fichier: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(fichier);
    const echelle = Math.min(1, MAX_COTE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * echelle);
    canvas.height = Math.round(bitmap.height * echelle);
    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= fichier.size) return fichier;
    const nom = fichier.name.replace(/\.[a-z0-9]+$/i, "") || "photo";
    return new File([blob], `${nom}.jpg`, { type: "image/jpeg" });
  } catch {
    // format non décodable (HEIC selon navigateur…) : on envoie l'original
    return fichier;
  }
}

export function PhotoPicker({
  name,
  labels,
}: {
  name: string;
  labels: {
    photos: string;
    aide: string;
    prendre: string;
    galerie: string;
    /** Libellé accessible du retrait — {n} déjà rempli par l'appelant via une fonction. */
    retirer: (n: number) => string;
  };
}) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [apercus, setApercus] = useState<string[]>([]);
  const champRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);

  // Synchroniser le champ réel du formulaire + les URLs d'aperçu.
  useEffect(() => {
    const dt = new DataTransfer();
    fichiers.forEach((f) => dt.items.add(f));
    if (champRef.current) champRef.current.files = dt.files;
    const urls = fichiers.map((f) => URL.createObjectURL(f));
    setApercus(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [fichiers]);

  const ajouter = async (liste: FileList | null) => {
    if (!liste) return;
    const images = [...liste].filter((f) => f.type.startsWith("image/") || f.type === "");
    const compresses = await Promise.all(images.map(compresser));
    setFichiers((prev) => [...prev, ...compresses].slice(0, MAX_PHOTOS));
  };

  const boutonCls =
    "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-btn border border-hairline-strong bg-surface px-4 text-[13px] font-medium text-ink-strong transition-colors hover:bg-hover sm:flex-none";

  return (
    <div>
      <p className="text-[13px] font-medium text-ink-strong">{labels.photos}</p>
      <p className="mt-0.5 text-[13px] text-soft">{labels.aide}</p>

      {/* Champ réel (multipart) + déclencheurs cachés caméra / galerie */}
      <input ref={champRef} type="file" name={name} multiple hidden tabIndex={-1} aria-hidden />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void ajouter(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galerieRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void ajouter(e.target.files);
          e.target.value = "";
        }}
      />

      {fichiers.length < MAX_PHOTOS ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className={boutonCls}>
            <IconCamera width={17} height={17} className="text-action" />
            {labels.prendre}
          </button>
          <button type="button" onClick={() => galerieRef.current?.click()} className={boutonCls}>
            <IconImage width={17} height={17} className="text-action" />
            {labels.galerie}
          </button>
        </div>
      ) : null}

      {apercus.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {apercus.map((url, i) => (
            <li key={url} className="relative animate-in-up">
              {/* Aperçu local (URL d'objet) — next/image inapplicable. */}
              <img
                src={url}
                alt=""
                className="size-20 rounded-xl border border-hairline object-cover"
              />
              <button
                type="button"
                onClick={() => setFichiers((prev) => prev.filter((_, j) => j !== i))}
                aria-label={labels.retirer(i + 1)}
                className="absolute -end-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-ink text-white shadow-pop transition-transform hover:scale-110"
              >
                <IconX width={12} height={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
