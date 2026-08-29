"use client";

/**
 * Aperçu de document DANS l'application — bouton « Voir » qui ouvre le fichier dans une
 * modale, via le proxy même-origine /api/document-inline. Rendu universel (mobile inclus) :
 *  - PDF : rendu page par page sur canvas via pdf.js (les navigateurs mobiles n'ont pas
 *    de visionneuse PDF intégrée dans les iframes) ;
 *  - image : balise <img> ;
 *  - autre : message + téléchargement.
 * Libellés fournis par l'appelant (dictionnaire) — jamais de texte en dur.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { Spinner } from "../ui/form";
import { IconDownload, IconEye } from "../ui/icons";

export interface ViewerLabels {
  see: string;
  close: string;
  download: string;
}

export function DocumentViewerButton({
  documentId,
  nom,
  labels,
  size = "sm",
  variant = "secondary",
  iconOnly = false,
}: {
  documentId: string;
  nom: string;
  labels: ViewerLabels;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const src = `/api/document-inline?id=${encodeURIComponent(documentId)}`;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        aria-label={`${labels.see} · ${nom}`}
        title={labels.see}
        data-tour="doc-view"
      >
        <IconEye width={15} height={15} />
        {iconOnly ? null : labels.see}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={nom} wide closeLabel={labels.close}>
        {open ? <DocumentPreview src={src} nom={nom} downloadLabel={labels.download} /> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <a
            href={`${src}&download=1`}
            className="inline-flex h-9 items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-4 text-[13px] font-medium text-ink-strong transition-colors hover:bg-hover"
          >
            <IconDownload width={15} height={15} />
            {labels.download}
          </a>
        </div>
      </Modal>
    </>
  );
}

type Apercu =
  | { etat: "chargement" }
  | { etat: "pdf" }
  | { etat: "image"; url: string }
  | { etat: "autre" };

function DocumentPreview({
  src,
  nom,
  downloadLabel,
}: {
  src: string;
  nom: string;
  downloadLabel: string;
}) {
  const [apercu, setApercu] = useState<Apercu>({ etat: "chargement" });
  const conteneurRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let annule = false;
    let urlObjet: string | null = null;

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(String(res.status));
        const type = res.headers.get("Content-Type") ?? "";
        const blob = await res.blob();
        if (annule) return;

        if (type.includes("pdf")) {
          const pdfjs = await import("pdfjs-dist");
          // URL absolue (origine incluse) : pdf.js résout sinon le chemin relativement
          // à la route courante (/fr/… → 404).
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "/pdf.worker.min.mjs",
            window.location.origin
          ).toString();
          const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
          if (annule) return;
          setApercu({ etat: "pdf" });
          // Rendu après que le conteneur est monté.
          await new Promise((r) => requestAnimationFrame(r));
          const conteneur = conteneurRef.current;
          if (!conteneur || annule) return;
          conteneur.replaceChildren();
          const largeur = conteneur.clientWidth || 320;
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          for (let n = 1; n <= doc.numPages && !annule; n++) {
            const page = await doc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const echelle = largeur / base.width;
            const viewport = page.getViewport({ scale: echelle * dpr });
            const canvas = document.createElement("canvas");
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = "100%";
            canvas.style.display = "block";
            canvas.style.borderRadius = "10px";
            canvas.style.boxShadow = "0 1px 3px rgb(32 31 35 / 0.12)";
            canvas.style.marginBlockEnd = "12px";
            canvas.setAttribute("role", "img");
            canvas.setAttribute("aria-label", `${nom} — ${n}/${doc.numPages}`);
            conteneur.appendChild(canvas);
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
        } else if (type.startsWith("image/")) {
          urlObjet = URL.createObjectURL(blob);
          setApercu({ etat: "image", url: urlObjet });
        } else {
          setApercu({ etat: "autre" });
        }
      } catch {
        if (!annule) setApercu({ etat: "autre" });
      }
    })();

    return () => {
      annule = true;
      if (urlObjet) URL.revokeObjectURL(urlObjet);
    };
  }, [src, nom]);

  if (apercu.etat === "chargement") {
    return (
      <div className="flex h-[50vh] items-center justify-center rounded-field bg-ground">
        <Spinner className="size-6 text-soft" />
      </div>
    );
  }

  if (apercu.etat === "image") {
    return (
      <div className="max-h-[68vh] overflow-y-auto rounded-field bg-ground p-3 scroll-thin">
        {/* Aperçu d'un fichier utilisateur via URL d'objet locale — next/image inapplicable. */}
        <img src={apercu.url} alt={nom} className="mx-auto h-auto max-w-full rounded-[10px]" />
      </div>
    );
  }

  if (apercu.etat === "autre") {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-3 rounded-field bg-ground px-6 text-center">
        <p className="text-sm text-soft">{nom}</p>
        <a
          href={`${src}&download=1`}
          className="inline-flex h-10 items-center gap-2 rounded-btn bg-ink px-5 text-sm font-medium text-white"
        >
          <IconDownload width={15} height={15} />
          {downloadLabel}
        </a>
      </div>
    );
  }

  return (
    <div
      ref={conteneurRef}
      className="max-h-[68vh] overflow-y-auto rounded-field bg-ground p-3 scroll-thin"
    />
  );
}
