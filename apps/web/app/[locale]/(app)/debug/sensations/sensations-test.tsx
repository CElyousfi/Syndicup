"use client";

import type { Dict } from "../../../../../lib/i18n";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { SOUND_NAMES, haptic, playSound, type HapticIntent } from "../../../../../lib/feel";
import { signature } from "../../../../../lib/signature";
import { celebrate } from "../../../../../lib/success";

const HAPTICS: HapticIntent[] = ["tap", "select", "success", "warning", "error", "heavy"];

/** Démonstrations des moments signature — animation, vibration et son seuls, aucune écriture. */
const DEMOS = (a: Dict["alive"]): Record<string, () => void> => ({
  "1 · Paiement enregistré (écran de succès)": () => celebrate({ titre: a.paiementEnregistre, illustration: "ok-paiement", moment: "payment", amount: "1250.00" }),
  "1 bis · Paiement enregistré (calque, solde qui roule)": () => signature({ kind: "payment", amount: "1250.00", balanceBefore: "-1250.00", balanceAfter: "0.00" }),
  "2 · Les 12 annexes générées": () => signature({ kind: "annexes" }),
  "3 · Appel de fonds / relance envoyé": () => celebrate({ titre: a.envoye, illustration: "ok-general", moment: "sent" }),
  "4 · Vote d'AG": () => signature({ kind: "vote" }),
  "5 · Dépense justifiée": () => celebrate({ titre: a.justifiee, illustration: "ok-paiement", moment: "justified" }),
  "7 · Bienvenue": () => signature({ kind: "welcome" }),
});

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
      <Card className="lg:col-span-2">
        <SectionHeader title={a.testMoments} />
        <ul className="mt-4 divide-y divide-hairline rounded-[18px] bg-surface px-4">
          {Object.entries(DEMOS(a)).map(([nom, jouer]) => (
            <li key={nom} className="flex items-center justify-between gap-3 py-3 text-[14px]">
              <span className="text-ink">{nom}</span>
              <Button size="sm" variant="secondary" onClick={jouer}>
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
