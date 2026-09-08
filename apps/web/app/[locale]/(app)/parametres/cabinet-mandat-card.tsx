/** Paramètres → Cabinet de syndic (M25) : mandat proposé / actif sur la copropriété, confirmation de la passation par le syndic en place. */
import { apiFetch } from "../../../../lib/api/client";
import type { MandatCopropriete } from "../../../../lib/api/types";
import type { Dict, Locale } from "../../../../lib/i18n";
import { formatDate, formatMontant, nomComplet } from "../../../../lib/format";
import { Badge } from "../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { mandatVariant } from "../../../../lib/status";
import { ConfirmerMandatModal } from "../cabinet/cabinet-client";

export async function CabinetMandatCard({ dict, locale, coproprieteId }: { dict: Dict; locale: Locale; coproprieteId: string }) {
  const t = dict.cabinet;
  const res = await apiFetch<MandatCopropriete | null>(`/coproprietes/${coproprieteId}/mandat`);
  const m = res.ok ? res.data : null;
  return (
    <Card>
      <SectionHeader title={t.mandatCopro} subtitle={t.mandatCoproAide} action={m?.peutConfirmer ? <ConfirmerMandatModal dict={dict} locale={locale} mandat={m} coproprieteId={coproprieteId} /> : undefined} />
      {!m ? <p className="mt-3 text-sm text-soft">{t.aucunMandatCopro}</p> : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><dt className="text-[12px] text-faint">{t.cabinetActif}</dt><dd className="text-sm font-medium text-ink-strong">{m.cabinet.nom}{m.cabinet.raison_sociale ? ` — ${m.cabinet.raison_sociale}` : ""}</dd><dd className="text-[12px] text-soft" dir="ltr">{[m.cabinet.telephone, m.cabinet.email].filter(Boolean).join(" · ")}</dd></div>
          <div><dt className="text-[12px] text-faint">{dict.lots.statut}</dt><dd><Badge variant={mandatVariant[m.statut]}>{t.statuts[m.statut]}</Badge></dd></div>
          <div><dt className="text-[12px] text-faint">{t.gestionnaireDesigne}</dt><dd className="text-sm text-ink-strong">{m.gestionnairePrincipal ? nomComplet(m.gestionnairePrincipal) ?? "—" : "—"}</dd></div>
          <div><dt className="text-[12px] text-faint">{t.dateDebut}</dt><dd className="text-sm text-ink-strong tnum">{formatDate(m.dateDebutMandat, locale)}{m.dateFinMandat ? ` → ${formatDate(m.dateFinMandat, locale)}` : ""}</dd></div>
          {m.honorairesMensuels ? <div><dt className="text-[12px] text-faint">{t.honoraires}</dt><dd className="text-sm text-ink-strong tnum">{formatMontant(m.honorairesMensuels)} MAD</dd></div> : null}
        </dl>
      )}
    </Card>
  );
}
