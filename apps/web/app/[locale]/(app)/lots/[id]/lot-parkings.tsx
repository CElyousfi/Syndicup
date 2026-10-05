/** Onglet « Parkings & badges » d'un lot (M23) — attributions, véhicules déclarés, badges remis ; actions syndic. */
import Link from "next/link";
import { apiFetch } from "../../../../../lib/api/client";
import type { AttributionEmplacement, BadgeAcces, Lot, Vehicule } from "../../../../../lib/api/types";
import type { Dict, Locale } from "../../../../../lib/i18n";
import { formatDate, formatMontant } from "../../../../../lib/format";
import { Badge } from "../../../../../components/ui/badge";
import { SectionHeader } from "../../../../../components/ui/card";
import { IconCircle, CKey } from "../../../../../components/ui/color-icons";
import { IconCar, IconChevronEnd } from "../../../../../components/ui/icons";
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
  const ligne = "flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-2xl px-3 py-3 transition-colors hover:bg-wash";
  return (
    <div className="space-y-8">
      <section>
        <SectionHeader title={t.onglets.mesAttributions} action={<Link href={`/${locale}/parkings`} className="link text-[14px]">{t.titre}</Link>} />
        {attributions.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucuneAttribution}</p> : (
          <ul className="-mx-3 mt-2">
            {attributions.map((a) => (
              <li key={a.id}>
                <Link href={`/${locale}/parkings/${a.emplacementId}`} className={ligne}>
                  <IconCircle tone="sage" size={44}><IconCar width={20} height={20} className="text-link" /></IconCircle>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[15px] font-bold text-ink" dir="ltr">{a.emplacement?.code ?? "—"}</span>
                    <span className="block truncate text-[13px] text-soft">{a.emplacement ? e.typeEmplacement[a.emplacement.type] : ""} · {e.typeAttribution[a.type]}</span>
                  </span>
                  <span className="text-[12px] text-soft tnum">{formatDate(a.dateDebut, locale)} → {a.dateFin ? formatDate(a.dateFin, locale) : t.sansFin}{a.redevanceMensuelle ? ` · ${formatMontant(a.redevanceMensuelle)} MAD` : ""}</span>
                  <Badge variant={a.active ? "ok" : "neutral"}>{a.active ? t.active : t.terminee}</Badge>
                  <IconChevronEnd width={18} height={18} className="icon-flip shrink-0 text-link" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionHeader title={t.vehicules} action={gestion ? <VehiculeModal dict={dict} locale={locale} lots={lots} /> : undefined} />
          {vehicules.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunVehicule}</p> : (
            <ul className="-mx-3 mt-2">
              {vehicules.map((v) => (
                <li key={v.id} className={ligne}>
                  <IconCircle tone="sand" size={44}><IconCar width={20} height={20} className="text-sand" /></IconCircle>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[15px] font-bold text-ink" dir="ltr">{v.immatriculation}</span>
                    <span className="block truncate text-[13px] text-soft">{[e.typeVehicule[v.type], v.marque, v.couleur].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Badge variant={v.actif ? "ok" : "neutral"}>{v.actif ? t.actif : t.inactif}</Badge>
                  {gestion && v.actif ? <RetirerVehiculeModal dict={dict} locale={locale} vehicule={v} /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="min-w-0">
          <SectionHeader title={t.badges} action={gestion ? <BadgeModal dict={dict} locale={locale} lots={lots} /> : undefined} />
          {badges.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunBadge}</p> : (
            <ul className="-mx-3 mt-2">
              {badges.map((b) => (
                <li key={b.id} className={ligne}>
                  <IconCircle tone="tosca" size={44}><CKey width={20} height={20} /></IconCircle>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[15px] font-bold text-ink" dir="ltr">{b.identifiant}</span>
                    <span className="block truncate text-[13px] text-soft">{e.typeBadge[b.type]}{b.cautionMontant ? ` · ${t.caution} ${formatMontant(b.cautionMontant)} MAD` : ""}</span>
                  </span>
                  <Badge variant={badgeAccesVariant[b.statut]}>{e.statutBadge[b.statut]}</Badge>
                  {gestion ? <span className="inline-flex gap-1">{b.statut === "ACTIF" ? <BadgePerduModal dict={dict} locale={locale} badge={b} /> : null}{b.statut !== "RESTITUE" ? <BadgeRestituerModal dict={dict} locale={locale} badge={b} /> : null}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
