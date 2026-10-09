"use client";

/**
 * Haptique sémantique côté web — même vocabulaire que le mobile (tap / select / success /
 * warning / error / heavy). `navigator.vibrate` n'existe que sur Android (Chrome, Firefox) :
 * ailleurs (iPhone, ordinateur) chaque appel est un no-op silencieux. Anti-rafale 80 ms, muet si
 * le réglage « Vibrations » est coupé ou si alive_v1 est désactivé.
 */
import { HAPTIC_THROTTLE_MS } from "../motion-tokens";
import { aliveOn, readSensations } from "./prefs";

export type HapticIntent = "tap" | "select" | "success" | "warning" | "error" | "heavy";

const PATTERNS: Record<HapticIntent, number | number[]> = {
  tap: 10,
  select: 6,
  success: [12, 70, 18],
  warning: [18, 90, 10],
  error: [24, 70, 24],
  heavy: 32,
};

let dernier = 0;

export function haptic(intent: HapticIntent, opts: { ignorePrefs?: boolean } = {}) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (!opts.ignorePrefs && (!aliveOn() || !readSensations().haptics)) return;
  const now = performance.now();
  if (now - dernier < HAPTIC_THROTTLE_MS) return;
  dernier = now;
  try {
    navigator.vibrate(PATTERNS[intent]);
  } catch {
    // Certains navigateurs refusent la vibration hors geste utilisateur : sans conséquence.
  }
}

export const hapticsSupported = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
