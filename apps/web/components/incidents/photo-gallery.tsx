"use client";

/**
 * Galerie des photos d'un signalement — vignettes + visionneuse plein cadre dans une
 * modale (navigation précédent/suivant, tactile et clavier). URLs signées 15 min
 * fournies par le serveur (GET /incidents/:id/photos).
 */
import { useState } from "react";
import { Modal } from "../ui/modal";
import { IconButton, Pressable } from "../ui/pressable";
import { Figure } from "../ui/amount";
import { FadeImg } from "../ui/motion/fade-img";
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
      <ul className="grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
        {photos.map((p, i) => (
          <li key={p.path}>
            <Pressable
              type="button"
              onClick={() => setOuverte(i)}
              className="su-btn block w-full overflow-hidden rounded-2xl bg-tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-2"
              aria-label={fill(altTemplate, { n: i + 1 })}
            >
              {/* URL signée courte durée — next/image inapplicable. */}
              <FadeImg
                src={p.url}
                alt={fill(altTemplate, { n: i + 1 })}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-105 sm:size-32"
              />
            </Pressable>
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
            <FadeImg
              key={ouverte}
              src={photos[ouverte]!.url}
              alt={fill(altTemplate, { n: ouverte + 1 })}
              className="mx-auto max-h-[68vh] w-auto max-w-full rounded-field animate-fade"
            />
            {photos.length > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-3">
                <IconButton
                  tone="none"
                  label={fill(altTemplate, { n: ((ouverte - 1 + photos.length) % photos.length) + 1 })}
                  onClick={() => naviguer(-1)}
                  className="size-11 bg-tile text-link transition-colors hover:bg-wash-strong"
                >
                  <IconChevronEnd width={16} height={16} className="rotate-180" />
                </IconButton>
                <span className="tnum text-[13px] font-medium text-soft">
                  <Figure value={`${ouverte + 1} / ${photos.length}`} />
                </span>
                <IconButton
                  tone="none"
                  label={fill(altTemplate, { n: ((ouverte + 1) % photos.length) + 1 })}
                  onClick={() => naviguer(1)}
                  className="size-11 bg-tile text-link transition-colors hover:bg-wash-strong"
                >
                  <IconChevronEnd width={16} height={16} />
                </IconButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
