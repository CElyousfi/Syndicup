"use client";

/** Couche « Alive » côté web — point d'entrée client (docs/ALIVE_GUIDE.md). */
export { haptic, hapticsSupported, type HapticIntent } from "./haptics";
export { playSound, armSounds, SOUND_NAMES, type SoundName } from "./sounds";
export {
  readSensations,
  writeSensations,
  useSensations,
  aliveOn,
  motionOn,
  ambientOn,
  DEFAULT_SENSATIONS,
  SENSATIONS_EVENT,
  type SensationsPrefs,
} from "./prefs";
