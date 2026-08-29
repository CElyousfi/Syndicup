"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TOAST_EVENT, type ToastInput } from "../../lib/toast";
import { marquerLueEnFond } from "../../lib/notifications-link";
import { IconBell, IconCheck, IconAlert, IconX } from "../ui/icons";

interface ToastItem extends ToastInput {
  id: number;
  sortant?: boolean;
}

/** Pastille d'icône teintée — le ton s'exprime par la couleur, la carte reste blanche (système). */
const PASTILLE: Record<NonNullable<ToastInput["tone"]>, string> = {
  ok: "bg-ok-tint text-ok",
  info: "bg-action-tint text-action",
  warn: "bg-warn-tint text-warn",
  danger: "bg-danger-tint text-danger",
};

/**
 * Pile de toasts EN BAS de l'écran : au-dessus de la barre d'onglets sur mobile, en bas à
 * l'extrémité sur desktop. Même langage que les cartes de l'app (blanc, liseré, rayon 20).
 * Un clic ouvre la page cible ET marque la notification lue ; la croix ferme seulement.
 */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const router = useRouter();
  const seq = useRef(0);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastInput>).detail;
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-2), { ...detail, id }]);
      const duree = detail.duree ?? 6500;
      setTimeout(
        () => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, sortant: true } : t))),
        duree
      );
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), duree + 320);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  const fermer = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  if (items.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-stretch gap-2.5 sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[380px] lg:bottom-6 lg:end-6"
      aria-live="polite"
    >
      {items.map((t) => {
        const tone = t.tone ?? "info";
        const Icone = tone === "ok" ? IconCheck : tone === "info" ? IconBell : IconAlert;
        const ouvrir = () => {
          if (t.notificationId) marquerLueEnFond(t.notificationId);
          fermer(t.id);
          if (t.href) router.push(t.href);
        };
        return (
          <div
            key={t.id}
            role="status"
            onClick={ouvrir}
            className={`pointer-events-auto flex cursor-pointer items-start gap-3 rounded-card border border-hairline bg-surface px-4 py-3.5 shadow-pop transition-transform duration-200 hover:-translate-y-0.5 ${
              t.sortant ? "animate-toast-out" : "animate-toast-in"
            }`}
          >
            <span
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${PASTILLE[tone]}`}
            >
              <Icone width={17} height={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold leading-snug text-ink">
                {t.titre}
              </span>
              {t.corps ? (
                <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-soft">
                  {t.corps}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fermer(t.id);
              }}
              aria-label="×"
              className="shrink-0 rounded-full p-1 text-faint transition-colors hover:bg-ground hover:text-ink"
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
