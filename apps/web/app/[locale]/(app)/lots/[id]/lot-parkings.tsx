/** Onglet « Parkings & badges » d'un lot (M23) — attributions, véhicules déclarés, badges remis ; actions syndic. */
import Link from "next/link";
import { apiFetch } from "../../../../../lib/api/client";
import type { AttributionEmplacement, BadgeAcces, Lot, Vehicule } from "../../../../../lib/api/types";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { formatDate, formatMontant } from "../../../../../lib/format";
import { Badge } from "../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { badgeAccesVariant } from "../../../../../lib/status";
import { BadgeModal, BadgePerduModal, BadgeRestituerModal, RetirerVehiculeModal, VehiculeModal } from "../../parkings/parkings-client";

export async function LotParkingsSection({ dict, locale, lot, gestion }: { dict: Dict; locale: Locale; lot: Lot; gestion: boolean }) {
  const t = dict.parkings;
  const e = dict.enumsParkings;
  const [attrRes, vehRes, badgesRes] = await Promise.all([
    apiFetch<AttributionEmplacement[]>("/emplacements/attributions", { searchParams: { lot_id: lot.id } }),
    apiFetch<Vehicule[]>("/vehicules", { searchParams: { lot_id: lot.id } }),
    apiFetch<BadgeAcces[]>("/badges", { searchParams: { lot_id: lot.id } }),
  ]);
  const attributions = attrRes.ok ? attrRes.data : [];
  const vehicules = vehRes.ok ? vehRes.data : [];
  const badges = badgesRes.ok ? badgesRes.data : [];
  const lots = [{ id: lot.id, numero: lot.numero }];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <SectionHeader title={t.onglets.mesAttributions} action={<Link href={`/${locale}/parkings`} className="text-[13px] font-medium text-action hover:underline">{t.titre}</Link>} />
        {attributions.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucuneAttribution}</p> : (
          <ul className="mt-3 divide-y divide-hairline">
            {attributions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Link href={`/${locale}/parkings/${a.emplacementId}`} className="font-mono text-[15px] font-semibold text-action hover:underline" dir="ltr">{a.emplacement?.code ?? "—"}</Link>
                <span className="text-[13px] text-body">{a.emplacement ? e.typeEmplacement[a.emplacement.type] : ""} · {e.typeAttribution[a.type]}</span>
                <Badge variant={a.active ? "ok" : "neutral"}>{a.active ? t.active : t.terminee}</Badge>
                <span className="ms-auto text-[12px] text-soft tnum">{formatDate(a.dateDebut, locale)} → {a.dateFin ? formatDate(a.dateFin, locale) : t.sansFin}{a.redevanceMensuelle ? ` · ${formatMontant(a.redevanceMensuelle)} MAD` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <SectionHeader title={t.vehicules} action={gestion ? <VehiculeModal dict={dict} locale={locale} lots={lots} /> : undefined} />
        {vehicules.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunVehicule}</p> : (
          <ul className="mt-3 divide-y divide-hairline">
            {vehicules.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="font-mono text-[15px] font-semibold text-ink-strong" dir="ltr">{v.immatriculation}</span>
                <span className="text-[13px] text-body">{[e.typeVehicule[v.type], v.marque, v.couleur].filter(Boolean).join(" · ")}</span>
                <Badge variant={v.actif ? "ok" : "neutral"}>{v.actif ? t.actif : t.inactif}</Badge>
                {gestion && v.actif ? <span className="ms-auto"><RetirerVehiculeModal dict={dict} locale={locale} vehicule={v} /></span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <SectionHeader title={t.badges} action={gestion ? <BadgeModal dict={dict} locale={locale} lots={lots} /> : undefined} />
        {badges.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunBadge}</p> : (
          <ul className="mt-3 divide-y divide-hairline">
            {badges.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="font-mono text-[15px] font-semibold text-ink-strong" dir="ltr">{b.identifiant}</span>
                <span className="text-[13px] text-body">{e.typeBadge[b.type]}{b.cautionMontant ? ` · ${t.caution} ${formatMontant(b.cautionMontant)} MAD` : ""}</span>
                <Badge variant={badgeAccesVariant[b.statut]}>{e.statutBadge[b.statut]}</Badge>
                {gestion ? <span className="ms-auto inline-flex gap-1">{b.statut === "ACTIF" ? <BadgePerduModal dict={dict} locale={locale} badge={b} /> : null}{b.statut !== "RESTITUE" ? <BadgeRestituerModal dict={dict} locale={locale} badge={b} /> : null}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
