"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "../../lib/toast";
import { NOTIF_LUE_EVENT, lienNotification } from "../../lib/notifications-link";

const REFRESH_MS = 25_000;
const POLL_FALLBACK_MS = 15_000;

interface NotificationLive {
  id: string;
  titre: string;
  corps: string;
  lu: boolean;
  href?: string;
  templateCode?: string;
  contenuJson?: Record<string, unknown> | null;
}

/**
 * Données vivantes — comme un fil d'actualité :
 *  1. flux temps réel (SSE) `/api/notifications-stream` : chaque notification créée côté
 *     serveur arrive à l'instant → toast (cliquable vers l'objet concerné), cloche, et
 *     re-synchronisation de la page ;
 *  2. repli : si le flux tombe, sondage toutes les 15 s, et retour automatique au flux ;
 *  3. re-synchronisation périodique (25 s) + au retour sur l'onglet ;
 *  4. le compteur réagit instantanément aux marquages « lu » faits dans l'interface.
 */
export function useLive(unreadInitial: number, locale: string) {
  const router = useRouter();
  const [unread, setUnread] = useState(unreadInitial);
  const vus = useRef<Set<string>>(new Set());
  const lues = useRef<Set<string>>(new Set());

  useEffect(() => setUnread(unreadInitial), [unreadInitial]);

  // 4. Marquage optimiste depuis n'importe quel écran (page notifications, toast…).
  useEffect(() => {
    const onLue = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      if (lues.current.has(id)) return;
      lues.current.add(id);
      setUnread((u) => Math.max(0, u - 1));
    };
    window.addEventListener(NOTIF_LUE_EVENT, onLue);
    return () => window.removeEventListener(NOTIF_LUE_EVENT, onLue);
  }, []);

  // 1 + 2. Flux temps réel avec repli.
  useEffect(() => {
    let source: EventSource | null = null;
    let timerPoll: ReturnType<typeof setInterval> | null = null;
    let timerReconnexion: ReturnType<typeof setTimeout> | null = null;
    let arrete = false;

    const hrefDe = (n: NotificationLive) =>
      n.href ?? lienNotification(n.templateCode ?? "", n.contenuJson ?? null, locale);

    const recevoir = (n: NotificationLive) => {
      if (vus.current.has(n.id)) return;
      vus.current.add(n.id);
      if (!n.lu) {
        toast({
          titre: n.titre,
          corps: n.corps,
          href: hrefDe(n),
          notificationId: n.id,
          tone: "info",
        });
      }
    };

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/notifications-live?locale=${locale}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { unread: number; items: NotificationLive[] };
        setUnread(data.unread);
        if (vus.current.size === 0) {
          data.items.forEach((n) => vus.current.add(n.id));
          return;
        }
        let nouveau = false;
        for (const n of data.items) {
          if (!vus.current.has(n.id)) nouveau = true;
          recevoir(n);
        }
        if (nouveau) router.refresh();
      } catch {
        /* réseau indisponible : prochain tick */
      }
    };

    const connecter = () => {
      if (arrete || typeof EventSource === "undefined") return;
      source = new EventSource("/api/notifications-stream");
      source.addEventListener("open", () => {
        if (timerPoll) {
          clearInterval(timerPoll);
          timerPoll = null;
        }
      });
      source.addEventListener("etat", (e) => {
        const data = JSON.parse((e as MessageEvent).data) as { unread: number; connus: string[] };
        setUnread(data.unread);
        data.connus.forEach((id) => vus.current.add(id));
      });
      source.addEventListener("notification", (e) => {
        const data = JSON.parse((e as MessageEvent).data) as NotificationLive & { unread: number };
        setUnread(data.unread);
        recevoir(data);
        router.refresh();
      });
      source.addEventListener("error", () => {
        source?.close();
        source = null;
        if (!timerPoll) {
          void poll();
          timerPoll = setInterval(poll, POLL_FALLBACK_MS);
        }
        timerReconnexion = setTimeout(connecter, 10_000);
      });
    };

    // Amorce : une lecture pour connaître l'état, puis le flux.
    void poll().then(connecter);

    return () => {
      arrete = true;
      source?.close();
      if (timerPoll) clearInterval(timerPoll);
      if (timerReconnexion) clearTimeout(timerReconnexion);
    };
  }, [locale, router]);

  // 3. Re-synchronisation des données de page.
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const id = setInterval(() => {
      if (visible()) router.refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (visible()) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return unread;
}
