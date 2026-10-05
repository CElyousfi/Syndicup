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
import { IconChevronEnd } from "../../../../../components/ui/icons";
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
    <div className="page-root">
      <PageHeader
        back={<BackLink href={`/${locale}/lots`} label={dict.nav.lots} />}
        title={nomComplet(profil) ?? m.titre}
        badge={
          <Badge variant={compteVariant[profil.statut_compte]}>
            {dict.enums.statutCompte[profil.statut_compte]}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:gap-4">
        <div className="min-w-0 space-y-8 lg:col-span-2">
          {/* Synthèse du membre : identité, statut, coordonnées */}
          <Card className="p-5 sm:p-7">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar nom={nomComplet(profil) ?? m.titre} size={64} />
              <div className="min-w-0">
                <p className="truncate text-[22px] font-bold leading-tight tracking-tight text-ink">
                  {nomComplet(profil) ?? m.titre}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={compteVariant[profil.statut_compte]}>
                    {dict.enums.statutCompte[profil.statut_compte]}
                  </Badge>
                  {profil.raison_sociale ? <Badge variant="neutral">{profil.raison_sociale}</Badge> : null}
                </div>
              </div>
            </div>
            <dl className="mt-5 divide-y divide-wash-strong rounded-[20px] bg-surface px-4 sm:mt-6 sm:px-5">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="shrink-0 text-[14px] text-soft">{dict.auth.emailLabel}</dt>
                <dd className="min-w-0 truncate text-[14px] font-semibold text-ink" dir="ltr">
                  {profil.email ?? dict.common.none}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="shrink-0 text-[14px] text-soft">{dict.auth.phoneLabel}</dt>
                <dd className="tnum min-w-0 truncate text-[14px] font-semibold text-ink" dir="ltr">
                  {formatTelephone(profil.telephone)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="shrink-0 text-[14px] text-soft">{dict.profil.langue}</dt>
                <dd className="text-[14px] font-semibold text-ink">
                  {profil.langue_preferee === "AR" ? dict.common.arabic : dict.common.french}
                </dd>
              </div>
              {profil.raison_sociale ? (
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="shrink-0 text-[14px] text-soft">{dict.roles.PERSONNE_MORALE_REPRESENTANT}</dt>
                  <dd className="min-w-0 truncate text-[14px] font-semibold text-ink">{profil.raison_sociale}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <section>
            <SectionHeader title={m.roles} />
            {rattachements.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{dict.common.emptyDefault}</p>
            ) : (
              <ul className="-mx-3 mt-2">
                {rattachements.map((r, i) => (
                  <li key={i}>
                    <Link
                      href={`/${locale}/lots/${r.lot.id}`}
                      className="flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-wash"
                    >
                      <IconCircle tone="sage" size={44}>
                        <CBuilding width={20} height={20} />
                      </IconCircle>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-ink">
                          {dict.enums.typeLot[r.lot.typeLot]} {r.lot.numero}
                        </span>
                        <span className="block truncate text-[13px] text-soft">{r.role}</span>
                      </span>
                      {r.detail ? <span className="tnum shrink-0 text-[15px] font-bold text-ink">{r.detail}</span> : null}
                      <IconChevronEnd width={18} height={18} className="icon-flip shrink-0 text-link" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Zone sensible */}
        <Card className="self-start bg-danger-tint">
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
