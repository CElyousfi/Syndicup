"use client";

/**
 * Galerie des photos d'un signalement — vignettes + visionneuse plein cadre dans une
 * modale (navigation précédent/suivant, tactile et clavier). URLs signées 15 min
 * fournies par le serveur (GET /incidents/:id/photos).
 */
import { useState } from "react";
import { Modal } from "../ui/modal";
import { IconChevronEnd } from "../ui/icons";
import { fill } from "../../lib/i18n";

export function PhotoGallery({
  photos,
  altTemplate,
  closeLabel,
}: {
  photos: Array<{ path: string; url: string }>;
  /** Gabarit du libellé accessible d'une photo — contient {n} (interpolé ici : une
      fonction ne passerait pas la frontière serveur→client). */
  altTemplate: string;
  closeLabel: string;
}) {
  const [ouverte, setOuverte] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const naviguer = (delta: number) => {
    setOuverte((i) => (i === null ? null : (i + delta + photos.length) % photos.length));
  };

  return (
    <>
      <ul className="flex flex-wrap gap-2.5">
        {photos.map((p, i) => (
          <li key={p.path}>
            <button
              type="button"
              onClick={() => setOuverte(i)}
              className="block overflow-hidden rounded-xl border border-hairline transition-all hover:shadow-float focus-visible:ring-2 focus-visible:ring-action"
              aria-label={fill(altTemplate, { n: i + 1 })}
            >
              {/* URL signée courte durée — next/image inapplicable. */}
              <img
                src={p.url}
                alt={fill(altTemplate, { n: i + 1 })}
                loading="lazy"
                className="size-24 object-cover transition-transform duration-300 hover:scale-105 sm:size-28"
              />
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={ouverte !== null}
        onClose={() => setOuverte(null)}
        title={ouverte !== null ? fill(altTemplate, { n: ouverte + 1 }) : ""}
        wide
        closeLabel={closeLabel}
      >
        {ouverte !== null ? (
          <div
            className="relative"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") naviguer(1);
              if (e.key === "ArrowLeft") naviguer(-1);
            }}
          >
            <img
              key={ouverte}
              src={photos[ouverte]!.url}
              alt={fill(altTemplate, { n: ouverte + 1 })}
              className="mx-auto max-h-[68vh] w-auto max-w-full rounded-field animate-fade"
            />
            {photos.length > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => naviguer(-1)}
                  className="flex size-10 items-center justify-center rounded-full border border-hairline-strong bg-surface text-body transition-colors hover:bg-hover"
                >
                  <IconChevronEnd width={16} height={16} className="rotate-180" />
                </button>
                <span className="tnum text-[13px] font-medium text-soft">
                  {ouverte + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  onClick={() => naviguer(1)}
                  className="flex size-10 items-center justify-center rounded-full border border-hairline-strong bg-surface text-body transition-colors hover:bg-hover"
                >
                  <IconChevronEnd width={16} height={16} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
