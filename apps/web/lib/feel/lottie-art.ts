"use client";

/**
 * Illustrations animées (Lottie) — lecteur partagé par <Illustration> et les affiches.
 *
 * Chaque illustration existe en deux fichiers frères dans public/illustrations/ :
 *   <nom>.png   l'image de repos (rendue depuis l'animation elle-même : pixel pour pixel la même)
 *   <nom>.json  l'animation (scripts/illustrations → docs/ALIVE_ILLUSTRATIONS.md)
 * Contrat de la frise : marqueur « intro » [0, repos) joué une fois, marqueur « idle »
 * [repos, fin) boucle douce, plafonnée (IDLE_CYCLES) puis l'image se pose sur le repos.
 *
 * Coût : le lecteur (lottie-web « light » : rendu SVG, sans expressions ni eval) et le JSON ne
 * sont chargés qu'à la première illustration VISIBLE, jamais sur le premier chargement de page.
 * Sans mouvement (alive_v1 coupé, « Animations réduites », préférence système) : rien n'est
 * chargé, l'image de repos suffit. Hors écran : l'animation se met en pause.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { ambientOn, motionOn } from "./prefs";

type LottieLib = typeof import("lottie-web/build/player/lottie_light").default;
type Anim = ReturnType<LottieLib["loadAnimation"]>;

interface Marker {
  tm: number;
  cm: string;
  dr: number;
}
interface LottieData {
  op: number;
  markers?: Marker[];
}

/** Boucles d'ambiance avant de se poser (≈ 12 s) : vivant, jamais insistant. */
export const IDLE_CYCLES = 3;
/** Au-delà, l'intro est abandonnée : l'image de repos s'affiche (réseau lent). */
const INTRO_DEADLINE_MS = 700;

let libP: Promise<LottieLib | null> | null = null;
const dataP = new Map<string, Promise<LottieData | null>>();

function loadLib(): Promise<LottieLib | null> {
  libP ??= import("lottie-web/build/player/lottie_light")
    .then((m) => m.default)
    .catch((e) => {
      console.warn(JSON.stringify({ niveau: "warn", message: "lecteur Lottie indisponible", erreur: String(e) }));
      return null;
    });
  return libP;
}

function loadData(name: string): Promise<LottieData | null> {
  let p = dataP.get(name);
  if (!p) {
    p = fetch(`/illustrations/${name}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<LottieData>) : null))
      .catch(() => null);
    dataP.set(name, p);
  }
  return p;
}

/** Instances rendues pendant l'hydratation : déjà peintes par le serveur → pas d'intro. */
let hydrated = false;

export type ArtPhase = "rest" | "waiting" | "live";

/**
 * Anime `name` dans `box` (conteneur vide, posé sur l'image de repos).
 *  - phase "waiting" : l'intro va jouer — l'image de repos reste cachée (≤ 700 ms) ;
 *  - phase "live"    : l'animation est à l'écran — l'image de repos se retire ;
 *  - phase "rest"    : image de repos seule (mouvement coupé, échec, ou avant chargement).
 */
export function useLottieArt(
  box: RefObject<HTMLElement | null>,
  name: string,
  { fit = "contain", idle = true }: { fit?: "contain" | "cover-end"; idle?: boolean } = {},
): ArtPhase {
  // Décidé une fois, au montage : identique côté serveur et à l'hydratation ("rest").
  const [intro] = useState(() => hydrated && typeof window !== "undefined" && motionOn());
  const [phase, setPhase] = useState<ArtPhase>(intro ? "waiting" : "rest");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    hydrated = true;
    const el = box.current;
    if (!el || !motionOn()) {
      setPhase("rest");
      return;
    }
    let anim: Anim | null = null;
    let disposed = false;
    let late = !intro;
    let cycles = 0;
    let stage: "intro" | "idle" | "done" = "intro";
    let visible = false;
    let started = false;

    const deadline = intro
      ? window.setTimeout(() => {
          late = true;
          if (phaseRef.current === "waiting") setPhase("rest");
        }, INTRO_DEADLINE_MS)
      : 0;

    const start = async () => {
      if (started) return;
      started = true;
      const [lib, data] = await Promise.all([loadLib(), loadData(name)]);
      if (disposed || !lib || !data) {
        if (!disposed) setPhase("rest");
        return;
      }
      const marks = data.markers ?? [];
      const restF = marks.find((m) => m.cm === "idle")?.tm ?? data.op - 1;
      const idleM = marks.find((m) => m.cm === "idle");
      const loops = idle && !!idleM && ambientOn();
      anim = lib.loadAnimation({
        container: el,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: JSON.parse(JSON.stringify(data)), // le lecteur mute ses données
        rendererSettings: {
          preserveAspectRatio: fit === "cover-end" ? "xMaxYMid slice" : "xMidYMid meet",
          progressiveLoad: false,
          hideOnTransparent: true,
        },
      });
      const a = anim;
      const playIdle = () => {
        if (!loops || cycles >= IDLE_CYCLES) {
          stage = "done";
          a.goToAndStop(restF, true);
          return;
        }
        stage = "idle";
        cycles += 1;
        a.playSegments([restF, data.op], true);
        if (!visible) a.pause();
      };
      a.addEventListener("complete", () => {
        if (disposed) return;
        if (stage === "intro" || stage === "idle") playIdle();
      });
      a.addEventListener("DOMLoaded", () => {
        if (disposed) return;
        window.clearTimeout(deadline);
        if (late) {
          // Image de repos déjà affichée : on prend le relais sur la même image, sans saut.
          a.goToAndStop(restF, true);
          setPhase("live");
          if (loops) window.setTimeout(() => !disposed && visible && playIdle(), 600);
          else stage = "done";
          return;
        }
        setPhase("live");
        stage = "intro";
        a.playSegments([0, restF], true);
        if (!visible) a.pause();
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) {
          void start();
          if (anim && stage !== "done") anim.play();
        } else if (anim && stage !== "done") {
          anim.pause();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    return () => {
      disposed = true;
      window.clearTimeout(deadline);
      io.disconnect();
      anim?.destroy();
      anim = null;
    };
    // `intro` est figé au montage (même décision qu'au premier rendu, sans re-déclenchement).
  }, [box, intro, name, fit, idle]);

  return phase;
}
