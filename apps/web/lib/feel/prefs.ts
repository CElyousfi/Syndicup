"use client";

/**
 * Préférences « Sensations » (décision D2 : sur l'appareil) — animations complètes / réduites,
 * vibrations, sons. Tout est activé par défaut ; un stockage indisponible ne casse rien.
 */
import { useEffect, useState } from "react";
import { FEEL_STORAGE } from "./boot";

export interface SensationsPrefs {
  reducedMotion: boolean;
  haptics: boolean;
  sounds: boolean;
}

export const DEFAULT_SENSATIONS: SensationsPrefs = { reducedMotion: false, haptics: true, sounds: true };
export const SENSATIONS_EVENT = "su:sensations";

export function readSensations(): SensationsPrefs {
  try {
    const raw = window.localStorage.getItem(FEEL_STORAGE.prefs);
    const p = raw ? (JSON.parse(raw) as Partial<SensationsPrefs>) : {};
    return {
      reducedMotion: p.reducedMotion === true,
      haptics: p.haptics !== false,
      sounds: p.sounds !== false,
    };
  } catch {
    return DEFAULT_SENSATIONS;
  }
}

export function writeSensations(next: SensationsPrefs) {
  try {
    window.localStorage.setItem(FEEL_STORAGE.prefs, JSON.stringify(next));
  } catch {
    // Stockage bloqué : le réglage vaut pour cette page seulement.
  }
  const d = document.documentElement;
  if (next.reducedMotion) d.setAttribute("data-motion", "reduced");
  else d.removeAttribute("data-motion");
  window.dispatchEvent(new CustomEvent<SensationsPrefs>(SENSATIONS_EVENT, { detail: next }));
}

/** Drapeau serveur alive_v1 (posé sur <html> par la mise en page + script d'amorçage). */
export function aliveOn(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.alive !== "0";
}

/** Mouvement « alive » permis : drapeau ON, ni réglage « Réduites » ni préférence système. */
export function motionOn(): boolean {
  if (!aliveOn()) return false;
  if (document.documentElement.dataset.motion === "reduced") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Effets d'ambiance : en plus, pas d'appareil modeste. */
export function ambientOn(): boolean {
  return motionOn() && document.documentElement.dataset.lite !== "1";
}

/** Préférences courantes, mises à jour à chaque changement (réglages, autre onglet). */
export function useSensations(): SensationsPrefs {
  const [prefs, setPrefs] = useState<SensationsPrefs>(DEFAULT_SENSATIONS);
  useEffect(() => {
    setPrefs(readSensations());
    const onChange = (e: Event) => setPrefs((e as CustomEvent<SensationsPrefs>).detail);
    const onStorage = (e: StorageEvent) => {
      if (e.key === FEEL_STORAGE.prefs) {
        const next = readSensations();
        writeSensations(next);
      }
    };
    window.addEventListener(SENSATIONS_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SENSATIONS_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return prefs;
}
