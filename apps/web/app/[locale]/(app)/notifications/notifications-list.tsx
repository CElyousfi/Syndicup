"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "../../../../components/ui/badge";
import { Card } from "../../../../components/ui/card";
import { IconArrowEnd, IconCheck } from "../../../../components/ui/icons";
import { marquerLueEnFond } from "../../../../lib/notifications-link";

export interface NotificationItem {
  id: string;
  titre: string;
  corps: string | null;
  lu: boolean;
  href: string;
  date: string;
  /** Badge canal (hors in-app), déjà libellé. */
  canal: string | null;
}

/**
 * Liste des notifications — chaque ligne est un lien vers l'objet concerné ; le clic (ou le
 * bouton « Marquer comme lu ») bascule l'état INSTANTANÉMENT (optimiste), l'API est mise à
 * jour en arrière-plan et la cloche réagit dans le même instant.
 */
export function NotificationsList({
  items: initiaux,
  marquerLuLabel,
}: {
  items: NotificationItem[];
  marquerLuLabel: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initiaux);

  const marquer = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
    marquerLueEnFond(id);
  };

  const ouvrir = (n: NotificationItem) => {
    if (!n.lu) marquer(n.id);
    router.push(n.href);
  };

  return (
    <Card padded={false} className="divide-y divide-hairline overflow-hidden">
      {items.map((n) => (
        <div
          key={n.id}
          role="link"
          tabIndex={0}
          onClick={() => ouvrir(n)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ouvrir(n);
            }
          }}
          className={`group flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors duration-300 sm:px-6 ${
            n.lu ? "bg-surface hover:bg-hover" : "bg-action-wash/70 hover:bg-action-wash"
          }`}
        >
          <span
            className={`mt-2 size-2 shrink-0 rounded-full transition-all duration-300 ${
              n.lu ? "scale-0 bg-transparent" : "scale-100 bg-action"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm transition-colors duration-300 ${
                n.lu ? "text-body" : "font-semibold text-ink"
              }`}
            >
              {n.titre}
            </p>
            {n.corps ? (
              <p className="mt-0.5 text-[13px] leading-relaxed text-soft">{n.corps}</p>
            ) : null}
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-faint">
              {n.date}
              {n.canal ? <Badge variant="outline">{n.canal}</Badge> : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 self-center">
            {!n.lu ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  marquer(n.id);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-btn px-2.5 text-[12px] font-medium text-action transition-colors hover:bg-action-tint"
              >
                <IconCheck width={14} height={14} />
                {marquerLuLabel}
              </button>
            ) : null}
            <IconArrowEnd
              width={16}
              height={16}
              className="text-faint transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            />
          </div>
        </div>
      ))}
    </Card>
  );
}
