/** Checklist de démarrage (M24) — carte serveur réutilisée par le tableau de bord syndic et l'onglet « Démarrer » ; disparaît quand tout est fait. */
import Link from "next/link";
import { apiFetch } from "../../../../lib/api/client";
import type { OnboardingChecklist } from "../../../../lib/api/types";
import type { Dict, Locale } from "../../../../lib/i18n";
import { fill } from "../../../../lib/i18n";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { ProgressBar } from "../../../../components/ui/progress";
import { Badge } from "../../../../components/ui/badge";
import { IconCheck } from "../../../../components/ui/icons";

export async function chargerOnboarding(coproprieteId: string): Promise<OnboardingChecklist | null> {
  const res = await apiFetch<OnboardingChecklist>(`/coproprietes/${coproprieteId}/onboarding`);
  return res.ok ? res.data : null;
}

export function OnboardingCard({ dict, locale, checklist, compact = false }: { dict: Dict; locale: Locale; checklist: OnboardingChecklist; compact?: boolean }) {
  const t = dict.importation;
  const p = (path: string) => `/${locale}${path}`;
  return (
    <Card>
      <SectionHeader title={t.onboarding} subtitle={checklist.complet ? t.onboardingComplet : t.onboardingAide} action={<Badge variant={checklist.complet ? "ok" : "info"}>{fill(t.progressionOnboarding, { faites: checklist.faites, total: checklist.total })}</Badge>} />
      <div className="mt-3"><ProgressBar ratio={checklist.progression / 100} tone={checklist.complet ? "ok" : "action"} /></div>
      <ul className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-1"}`}>
        {checklist.etapes.map((e) => (
          <li key={e.cle}>
            <Link href={p(e.lien)} className={`flex items-center gap-3 rounded-field border px-3 py-2 transition-colors hover:bg-hover ${e.fait ? "border-ok/30 bg-ok/5" : "border-hairline"}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${e.fait ? "bg-ok text-white" : "border border-hairline-strong text-faint"}`}>{e.fait ? <IconCheck width={14} height={14} /> : <span className="text-[11px] font-semibold">{checklist.etapes.indexOf(e) + 1}</span>}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13.5px] ${e.fait ? "text-body line-through decoration-hairline-strong" : "font-medium text-ink-strong"}`}>{t.etapesOnboarding[e.cle]}</span>
                {e.detail ? <span className="block text-[12px] text-soft">{e.detail}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
