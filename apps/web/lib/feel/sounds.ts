"use client";

/**
 * Sons sémantiques côté web (mêmes fichiers que le mobile : public/sounds/*.wav, < 30 Ko).
 * Web Audio : décodés une fois, joués sans latence ; le contexte audio n'est créé qu'au premier
 * geste de l'utilisateur (règle d'autoplay des navigateurs) — un son demandé avant reste muet.
 * Jamais sur un clic ordinaire : uniquement aux moments importants (docs/ALIVE_GUIDE.md).
 */
import { aliveOn, readSensations } from "./prefs";

export type SoundName = "confirm" | "success" | "sent" | "notify" | "error" | "signature";
export const SOUND_NAMES: SoundName[] = ["confirm", "success", "sent", "notify", "error", "signature"];

const VOLUME = 0.5;

let ctx: AudioContext | null = null;
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>();

function contexte(): AudioContext | null {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function charger(name: SoundName): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    p = (async () => {
      const c = contexte();
      if (!c) return null;
      try {
        const r = await fetch(`/sounds/${name}.wav`);
        return await c.decodeAudioData(await r.arrayBuffer());
      } catch {
        return null;
      }
    })();
    buffers.set(name, p);
  }
  return p;
}

let deverrouille = false;
/** À appeler une fois (coque) : crée le contexte au premier geste puis précharge les sons. */
export function armSounds() {
  if (typeof window === "undefined" || deverrouille) return;
  const unlock = () => {
    deverrouille = true;
    const c = contexte();
    void c?.resume();
    SOUND_NAMES.forEach((n) => void charger(n));
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export async function playSound(name: SoundName, opts: { ignorePrefs?: boolean } = {}) {
  if (!opts.ignorePrefs && (!aliveOn() || !readSensations().sounds)) return;
  const c = contexte();
  if (!c || (c.state !== "running" && !deverrouille)) return;
  const buf = await charger(name);
  if (!buf) return;
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = VOLUME;
  src.buffer = buf;
  src.connect(gain).connect(c.destination);
  src.start();
}
