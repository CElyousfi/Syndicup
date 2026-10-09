"use client";

import type { Dict } from "../../../../../lib/i18n";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { SOUND_NAMES, haptic, playSound, type HapticIntent } from "../../../../../lib/feel";

const HAPTICS: HapticIntent[] = ["tap", "select", "success", "warning", "error", "heavy"];

/** Démonstrations des moments signature, enregistrées par les composants (phase 4). */
export const SIGNATURE_DEMOS: Record<string, () => void> = {};

export function SensationsTest({ dict }: { dict: Dict }) {
  const a = dict.alive;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionHeader title={a.testSons} />
        <ul className="mt-4 divide-y divide-hairline rounded-[18px] bg-surface px-4">
          {SOUND_NAMES.map((s) => (
            <li key={s} className="flex items-center justify-between gap-3 py-3 text-[14px]">
              <span className="font-mono text-ink">/sounds/{s}.wav</span>
              <Button size="sm" variant="secondary" onClick={() => void playSound(s, { ignorePrefs: true })}>
                {a.jouer}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <SectionHeader title={a.testVibrations} subtitle={a.vibrationsWeb} />
        <ul className="mt-4 divide-y divide-hairline rounded-[18px] bg-surface px-4">
          {HAPTICS.map((h) => (
            <li key={h} className="flex items-center justify-between gap-3 py-3 text-[14px]">
              <span className="font-mono text-ink">haptic(&quot;{h}&quot;)</span>
              <Button size="sm" variant="secondary" onClick={() => haptic(h, { ignorePrefs: true })}>
                {a.jouer}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
