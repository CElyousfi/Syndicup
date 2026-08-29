import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Lot, Profil } from "../../../../../lib/api/types";
import { formatTelephone, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Avatar } from "../../../../../components/ui/avatar";
import { IconCircle, CBuilding } from "../../../../../components/ui/color-icons";
import { compteVariant } from "../../../../../lib/status";
import { AnonymiserModal } from "./anonymiser-modal";

/** J3 — fiche membre (syndic) : profil, rattachements aux lots, zone sensible CNDP. */
export default async function MembrePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const m = dict.membres;

  const [profilRes, lotsRes] = await Promise.all([
    apiFetch<Profil>(`/users/${id}`),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  if (!profilRes.ok) notFound();
  const profil = profilRes.data;
  const lots = lotsRes.ok ? lotsRes.data : [];

  const rattachements = lots.flatMap((lot) => [
    ...(lot.proprietaires ?? [])
      .filter((p) => p.utilisateurId === id && !p.dateFin)
      .map((p) => ({
        lot,
        role: dict.enums.typePropriete[p.typePropriete],
        detail: `${p.quotePart} %`,
      })),
    ...(lot.occupants ?? [])
      .filter((o) => o.utilisateurId === id && !o.dateFin)
      .map((o) => ({
        lot,
        role: dict.enums.typeOccupation[o.typeOccupation],
        detail: "",
      })),
  ]);

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${locale}/lots`} label={dict.nav.lots} />}
        title={nomComplet(profil) ?? m.titre}
        badge={
          <Badge variant={compteVariant[profil.statut_compte]}>
            {dict.enums.statutCompte[profil.statut_compte]}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-3.5">
            <Avatar nom={nomComplet(profil) ?? m.titre} size={44} />
            <SectionHeader
              title={m.compte}
              subtitle={<span className="truncate">{nomComplet(profil) ?? m.titre}</span>}
              className="min-w-0 flex-1"
            />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[13px] text-soft">{dict.auth.emailLabel}</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink" dir="ltr">
                {profil.email ?? dict.common.none}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-soft">{dict.auth.phoneLabel}</dt>
              <dd className="tnum mt-0.5 text-sm font-medium text-ink" dir="ltr">
                {formatTelephone(profil.telephone)}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-soft">{dict.profil.langue}</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">
                {profil.langue_preferee === "AR" ? dict.common.arabic : dict.common.french}
              </dd>
            </div>
            {profil.raison_sociale ? (
              <div>
                <dt className="text-[13px] text-soft">
                  {dict.roles.PERSONNE_MORALE_REPRESENTANT}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-ink">{profil.raison_sociale}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 border-t border-hairline pt-5">
            <SectionHeader title={m.roles} />
            {rattachements.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{dict.common.emptyDefault}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {rattachements.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-sm">
                    <Link
                      href={`/${locale}/lots/${r.lot.id}`}
                      className="inline-flex min-w-0 items-center gap-2.5 font-medium text-ink hover:text-action"
                    >
                      <IconCircle tone="sage" size={32}>
                        <CBuilding width={17} height={17} />
                      </IconCircle>
                      <span className="truncate">
                        {dict.enums.typeLot[r.lot.typeLot]} {r.lot.numero}
                      </span>
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.detail ? <span className="tnum text-[13px] text-soft">{r.detail}</span> : null}
                      <Badge variant="outline">{r.role}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Zone sensible */}
        <Card className="self-start border-danger/25">
          <SectionHeader title={m.zoneDanger} />
          <p className="mt-3 text-[13px] leading-relaxed text-body">{m.anonymiserCorps}</p>
          <div className="mt-4">
            <AnonymiserModal
              dict={dict}
              locale={ctx.locale}
              utilisateurId={id}
              desactive={profil.statut_compte === "DESACTIVE"}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
