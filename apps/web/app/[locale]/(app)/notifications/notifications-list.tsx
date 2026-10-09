"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { LiveList } from "../../../../components/ui/live-list";
import { CBell, IconCircle } from "../../../../components/ui/color-icons";
import { IconCheck, IconChevronEnd } from "../../../../components/ui/icons";
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

  // Liste Wise à plat sur la toile : pastille cloche, titre gras (non lue), date grise,
  // action et chevron vert à l'extrémité — aucune boîte autour.
  return (
    <LiveList as="ul" className="-mx-3 space-y-1">
      {items.map((n) => (
        <li key={n.id}>
          <div
            role="link"
            tabIndex={0}
            onClick={() => ouvrir(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                ouvrir(n);
              }
            }}
            className="group flex cursor-pointer items-start gap-4 rounded-[20px] px-3 py-3.5 transition-colors duration-300 hover:bg-wash"
          >
            <span className="relative shrink-0">
              <IconCircle tone={n.lu ? "surface" : "sand"} size={46}>
                <CBell width={22} height={22} />
              </IconCircle>
              <span
                aria-hidden
                className={`absolute -top-0.5 -end-0.5 size-3 rounded-full border-2 border-surface bg-brand transition-transform duration-300 ${
                  n.lu ? "scale-0" : "scale-100"
                }`}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[15px] leading-snug transition-colors duration-300 ${
                  n.lu ? "font-medium text-body" : "font-bold text-ink"
                }`}
              >
                {n.titre}
              </p>
              {n.corps ? (
                <p className="mt-1 text-[14px] leading-relaxed text-soft">{n.corps}</p>
              ) : null}
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-soft">
                {n.date}
                {n.canal ? <Badge variant="outline">{n.canal}</Badge> : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 self-center">
              {!n.lu ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    marquer(n.id);
                  }}
                  className="px-3 text-link hover:bg-action-tint"
                >
                  <IconCheck width={15} height={15} />
                  <span className="hidden sm:inline">{marquerLuLabel}</span>
                  <span className="sr-only sm:hidden">{marquerLuLabel}</span>
                </Button>
              ) : null}
              <IconChevronEnd
                width={18}
                height={18}
                className="text-link transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
              />
            </div>
          </div>
        </li>
      ))}
    </LiveList>
  );
}
