"use client";

import { useEffect, useState } from "react";
import type { Dict } from "../../../../lib/i18n";
import { Segmented } from "../../../../components/ui/tabs";
import { Switch } from "../../../../components/ui/field";
import { Banner } from "../../../../components/ui/banner";
import { haptic, hapticsSupported, readSensations, useSensations, writeSensations } from "../../../../lib/feel";

/**
 * Réglages « Sensations » (couche Alive, décision D2) — gardés sur cet appareil, appliqués
 * immédiatement : animations complètes / réduites, vibrations (Android), sons.
 */
export function SensationsForm({ dict }: { dict: Dict }) {
  const a = dict.alive;
  const prefs = useSensations();
  const [vibrable, setVibrable] = useState(true);
  const [lite, setLite] = useState(false);
  useEffect(() => {
    setVibrable(hapticsSupported());
    setLite(document.documentElement.dataset.lite === "1");
  }, []);

  const set = (patch: Partial<typeof prefs>) => writeSensations({ ...readSensations(), ...patch });

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="mb-2 text-[14px] font-semibold text-ink">{a.animations}</p>
        <Segmented<"full" | "reduced">
          value={prefs.reducedMotion ? "reduced" : "full"}
          onChange={(v) => {
            set({ reducedMotion: v === "reduced" });
            haptic("select");
          }}
          options={[
            { value: "full", label: a.animationsCompletes },
            { value: "reduced", label: a.animationsReduites },
          ]}
        />
        <p className="mt-2 text-[13px] text-soft">{a.animationsAide}</p>
      </div>
      <Switch
        label={a.vibrations}
        hint={vibrable ? a.vibrationsAide : a.vibrationsWeb}
        checked={prefs.haptics}
        onChange={(e) => {
          set({ haptics: e.currentTarget.checked });
          if (e.currentTarget.checked) haptic("select");
        }}
      />
      <Switch label={a.sons} hint={a.sonsAide} checked={prefs.sounds} onChange={(e) => set({ sounds: e.currentTarget.checked })} />
      {lite ? <Banner variant="info">{a.lite}</Banner> : null}
    </div>
  );
}
