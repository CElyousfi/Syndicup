"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { TOAST_EVENT, type ToastInput } from "../../lib/toast";
import { marquerLueEnFond } from "../../lib/notifications-link";
import { IconBell, IconCheck, IconAlert, IconX } from "../ui/icons";

interface ToastItem extends ToastInput {
  id: number;
  duree: number;
}

/** Pastille d'icône teintée — le ton s'exprime par la couleur, la carte reste blanche (système). */
const PASTILLE: Record<NonNullable<ToastInput["tone"]>, string> = {
  ok: "bg-ok-tint text-ok",
  info: "bg-action-tint text-action",
  warn: "bg-warn-tint text-warn",
  danger: "bg-danger-tint text-danger",
};

/**
 * Pile de toasts EN BAS de l'écran (rendue sous le <LazyMotion> de la coque) : entrée en ressort,
 * les autres toasts se réorganisent en glissant, un geste latéral en écarte un, un filet discret
 * montre le temps restant. : au-dessus de la barre d'onglets sur mobile, en bas à
 * l'extrémité sur desktop. Même langage que les cartes de l'app (blanc, liseré, rayon 20).
 * Un clic ouvre la page cible ET marque la notification lue ; la croix ferme seulement.
 */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const router = useRouter();
  const seq = useRef(0);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  // Un glissé ne doit jamais valoir clic (le clic navigue vers l'objet).
  const glisse = useRef(false);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastInput>).detail;
      const id = ++seq.current;
      const duree = detail.duree ?? 6500;
      setItems((prev) => [...prev.slice(-2), { ...detail, id, duree }]);
      timers.current.push(setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), duree));
    };
    window.addEventListener(TOAST_EVENT, onToast);
    const pending = timers.current;
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      pending.forEach(clearTimeout);
    };
  }, []);

  const fermer = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-stretch gap-2.5 sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[380px] lg:bottom-6 lg:end-6"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
      {items.map((t) => {
        const tone = t.tone ?? "info";
        const Icone = tone === "ok" ? IconCheck : tone === "info" ? IconBell : IconAlert;
        const ouvrir = () => {
          if (glisse.current) return;
          if (t.notificationId) marquerLueEnFond(t.notificationId);
          fermer(t.id);
          if (t.href) router.push(t.href);
        };
        return (
          <m.div
            key={t.id}
            role="status"
            layout
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 32 } }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            whileHover={{ y: -2 }}
            drag="x"
            dragSnapToOrigin
            dragElastic={0.6}
            onDragStart={() => {
              glisse.current = true;
            }}
            onDragEnd={(_, info) => {
              setTimeout(() => (glisse.current = false), 60);
              if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) fermer(t.id);
            }}
            onClick={ouvrir}
            className="pointer-events-auto relative flex cursor-pointer touch-pan-y items-start gap-3 overflow-hidden rounded-card border border-hairline bg-surface px-4 py-3.5 shadow-pop"
          >
            <span
              className={`animate-pop mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${PASTILLE[tone]}`}
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
              className="su-btn shrink-0 rounded-full p-1 text-faint hover:rotate-90 hover:bg-ground hover:text-ink"
            >
              <IconX width={14} height={14} />
            </button>
            {/* Temps restant : filet qui se vide (sens de lecture). */}
            <span
              aria-hidden
              className="toast-timer absolute inset-x-0 bottom-0 h-[2px] bg-action/25"
              style={{ animationDuration: `${t.duree}ms` }}
            />
          </m.div>
        );
      })}
      </AnimatePresence>
    </div>
  );
}
