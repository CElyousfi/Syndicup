"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { SUCCESS_EVENT, type SuccessInput } from "../../lib/success";
import { Illustration } from "../ui/illustration";
import { EASE_IN, EASE_OUT } from "../../lib/motion";

/** Écran de succès plein écran (Wise) — écoute `celebrate()` (lib/success.ts). */
export function SuccessOverlay({ doneLabel }: { doneLabel: string }) {
  const [item, setItem] = useState<SuccessInput | null>(null);
  const router = useRouter();
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = (e: Event) => setItem((e as CustomEvent<SuccessInput>).detail);
    window.addEventListener(SUCCESS_EVENT, on);
    return () => window.removeEventListener(SUCCESS_EVENT, on);
  }, []);

  useEffect(() => {
    if (!item) return;
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setItem(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);

  return (
    <AnimatePresence>
      {item ? (
        <m.div
          key="success"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="su-success-title"
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-surface px-6 pb-[env(safe-area-inset-bottom)] text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE_IN } }}
        >
          <m.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 18, delay: 0.05 } }}
          >
            <Illustration name={item.illustration ?? "ok-general"} size={220} fallback={<SuccessBurst />} />
          </m.div>
          <m.h2
            id="su-success-title"
            className="mt-6 max-w-md text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { delay: 0.15, duration: 0.4, ease: EASE_OUT } }}
          >
            {item.titre}
          </m.h2>
          {item.corps ? (
            <m.p
              className="mt-3 max-w-md text-[15px] leading-relaxed text-soft"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { delay: 0.22, duration: 0.4, ease: EASE_OUT } }}
            >
              {item.corps}
            </m.p>
          ) : null}
          <m.div
            className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { delay: 0.3, duration: 0.4, ease: EASE_OUT } }}
          >
            <button
              ref={done}
              type="button"
              onClick={() => setItem(null)}
              className="su-btn inline-flex h-12 items-center justify-center rounded-btn bg-cta px-7 text-[15px] font-semibold text-ink hover:bg-lime-hover"
            >
              {doneLabel}
            </button>
            {item.href && item.hrefLabel ? (
              <button
                type="button"
                onClick={() => {
                  const href = item.href!;
                  setItem(null);
                  router.push(href);
                }}
                className="link mx-auto py-2 text-[15px]"
              >
                {item.hrefLabel}
              </button>
            ) : null}
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Repli dessiné : disque lime, coche encre, éclats (en attendant l'illustration 2D). */
function SuccessBurst() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden>
      <circle cx="100" cy="100" r="78" fill="#E2EEE7" />
      <circle cx="100" cy="100" r="54" fill="#E3EF8D" />
      <path d="M76 101l16 16 33-34" fill="none" stroke="#121212" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect key={a} x="97" y="6" width="6" height="14" rx="3" fill={a % 90 === 0 ? "#1E7552" : "#E3EF8D"} transform={`rotate(${a} 100 100)`} />
      ))}
    </svg>
  );
}
