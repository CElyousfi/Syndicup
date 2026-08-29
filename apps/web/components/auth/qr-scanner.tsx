"use client";

/**
 * Lecteur de QR code d'invitation — caméra du téléphone directement dans l'app (page de
 * connexion et saisie de code). Décodage local (jsQR) : rien ne quitte l'appareil ; dès
 * qu'un QR d'invitation SyndicUp est reconnu, on ouvre la page d'acceptation du code.
 * Le QR encode l'URL /{locale}/invitation/{CODE} ; un QR ne contenant que le code est
 * accepté aussi. Libellés fournis par l'appelant — jamais de texte en dur.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { IconQr } from "../ui/icons";

/** Extrait le code d'invitation d'un contenu de QR (URL SyndicUp ou code brut). */
export function extraireCodeInvitation(texte: string): string | null {
  const t = texte.trim();
  const url = t.match(/\/invitation\/([A-Za-z0-9]{4,16})(?:[/?#]|$)/);
  if (url) return url[1]!.toUpperCase();
  if (/^[A-Za-z0-9]{4,16}$/.test(t)) return t.toUpperCase();
  return null;
}

export function QrScannerButton({
  locale,
  labels,
  variant = "secondary",
  className = "",
}: {
  locale: "fr" | "ar";
  labels: {
    scan: string;
    hint: string;
    denied: string;
    invalid: string;
    insecure: string;
    close: string;
  };
  variant?: "secondary" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const actifRef = useRef(false);

  const arreter = useCallback(() => {
    actifRef.current = false;
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      arreter();
      return;
    }
    let annule = false;
    setErreur(null);

    (async () => {
      // Hors contexte sécurisé (http:// sur une IP), le navigateur ne propose JAMAIS la
      // caméra : l'API n'existe pas. On l'explique plutôt que d'afficher un cadre noir.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setErreur(labels.insecure);
        return;
      }
      try {
        const flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (annule) {
          flux.getTracks().forEach((t) => t.stop());
          return;
        }
        fluxRef.current = flux;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = flux;
        await video.play();

        const { default: jsQR } = await import("jsqr");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        actifRef.current = true;

        const boucle = () => {
          if (!actifRef.current || !video.videoWidth || !ctx) {
            if (actifRef.current) requestAnimationFrame(boucle);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const resultat = jsQR(image.data, image.width, image.height, {
            inversionAttempts: "dontInvert",
          });
          if (resultat?.data) {
            const code = extraireCodeInvitation(resultat.data);
            if (code) {
              arreter();
              setOpen(false);
              router.push(`/${locale}/invitation/${encodeURIComponent(code)}`);
              return;
            }
            setErreur(labels.invalid);
          }
          requestAnimationFrame(boucle);
        };
        requestAnimationFrame(boucle);
      } catch {
        if (!annule) setErreur(labels.denied);
      }
    })();

    return () => {
      annule = true;
      arreter();
    };
  }, [open, arreter, labels.denied, labels.invalid, labels.insecure, locale, router]);

  return (
    <>
      <Button type="button" variant={variant} size="md" className={className} onClick={() => setOpen(true)}>
        <IconQr width={17} height={17} />
        {labels.scan}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={labels.scan} closeLabel={labels.close}>
        <p className="text-[13px] text-soft">{labels.hint}</p>
        <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-field bg-ink">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          {/* Viseur */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-sage shadow-[0_0_0_9999px_rgb(18_18_18/0.35)]"
          />
        </div>
        {erreur ? <p className="mt-3 text-[13px] text-danger">{erreur}</p> : null}
      </Modal>
    </>
  );
}
