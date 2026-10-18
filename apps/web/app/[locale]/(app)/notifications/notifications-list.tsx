"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EnvoiDiffere } from "../../../../lib/deferred-commit";
import { toast } from "../../../../lib/toast";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { LiveList } from "../../../../components/ui/live-list";
import { CBell, IconCircle } from "../../../../components/ui/color-icons";
import { IconCheck, IconChevronEnd } from "../../../../components/ui/icons";
import { marquerLueEnFond, signalerLue } from "../../../../lib/notifications-link";

/**
 * Envoi d'une lecture différée (relais /api/notifications-read, `keepalive` pour survivre à la
 * navigation). La cloche ne baisse (signalerLue) qu'après succès ; `false` = échec, géré par
 * l'appelant (ligne remise en « non lue » + toast).
 */
async function envoyerLecture(id: string): Promise<boolean> {
  try {
    const r = await fetch("/api/notifications-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      keepalive: true,
    });
    if (!r.ok) return false;
    signalerLue(id);
    return true;
  } catch (err: unknown) {
    console.error("notifications-read", err);
    return false;
  }
}

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

/** Délai d'« Annuler » — identique à la durée du toast. */
const DELAI_ANNULER_MS = 6000;

/**
 * Liste des notifications — chaque ligne est un lien vers l'objet concerné.
 *
 * - Ouvrir une notification la marque lue IMMÉDIATEMENT (pas d'annulation : on navigue).
 * - « Marquer comme lu » bascule l'UI tout de suite mais la requête est DIFFÉRÉE (~6 s) : le
 *   toast propose « Annuler », qui retire l'envoi avant qu'il parte. La ligne `notification`
 *   est append-only (Master Spec 7.2) — il n'existe pas de « non lu » serveur, donc l'annulation
 *   ne peut être que côté client. Tout ce qui attend part au démontage et sur `pagehide`.
 * - La cloche ne baisse qu'après succès de l'envoi ; un échec remet la ligne en « non lue ».
 */
export function NotificationsList({
  items: initiaux,
  marquerLuLabel,
  marqueeLabel,
  annulerLabel,
  echecLabel,
}: {
  items: NotificationItem[];
  marquerLuLabel: string;
  /** Toast après « Marquer comme lu ». */
  marqueeLabel: string;
  annulerLabel: string;
  /** Toast si l'envoi différé échoue. */
  echecLabel: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initiaux);
  const monte = useRef(true);
  const echecRef = useRef(echecLabel);
  echecRef.current = echecLabel;

  const basculer = (ids: string[], lu: boolean) => {
    const set = new Set(ids);
    setItems((prev) => prev.map((n) => (set.has(n.id) ? { ...n, lu } : n)));
  };

  // Envoi effectif d'un lot échu (ou vidé) : `keepalive` pour survivre à la navigation.
  const differe = useRef<EnvoiDiffere<string> | null>(null);
  if (differe.current === null) {
    differe.current = new EnvoiDiffere<string>((ids) => {
      void Promise.all(ids.map((id) => envoyerLecture(id))).then((resultats) => {
        const echecs = ids.filter((_, i) => !resultats[i]);
        if (echecs.length === 0 || !monte.current) return;
        basculer(echecs, false);
        toast({ titre: echecRef.current, tone: "danger" });
      });
    }, DELAI_ANNULER_MS);
  }

  useEffect(() => {
    monte.current = true;
    const d = differe.current;
    const vider = () => d?.vider();
    window.addEventListener("pagehide", vider);
    return () => {
      window.removeEventListener("pagehide", vider);
      monte.current = false;
      vider();
    };
  }, []);

  const marquer = (id: string) => {
    const lot = differe.current?.programmer([id]) ?? null;
    if (lot === null) return;
    basculer([id], true);
    toast({
      titre: marqueeLabel,
      tone: "ok",
      duree: DELAI_ANNULER_MS,
      action: {
        label: annulerLabel,
        onClick: () => {
          const rendues = differe.current?.annuler(lot);
          if (rendues) basculer(rendues, false);
        },
      },
    });
  };

  const ouvrir = (n: NotificationItem) => {
    // Ouvrir = lu tout de suite (pas d'annulation) ; jamais un second envoi différé.
    const enAttente = differe.current?.enAttente(n.id) ?? false;
    differe.current?.retirer(n.id);
    if (!n.lu || enAttente) {
      basculer([n.id], true);
      marquerLueEnFond(n.id);
    }
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
