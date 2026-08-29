/**
 * Fiche client (console opérateur, super admin) : santé d'une copropriété en un écran —
 * indicateurs, invitations, finances, prochaine AG, dernière activité — et le bouton
 * « Ouvrir l'espace » pour entrer dans l'application du client (bascule auditée).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { AdminSynthese, Copropriete, Invitation } from "../../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../../lib/i18n";
import { formatDateCourte, formatDateHeure, formatMAD } from "../../../../../../lib/format";
import { ratio, versCentimes, versChaine } from "../../../../../../lib/centimes";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { StatCard } from "../../../../../../components/ui/stat-card";
import { Donut } from "../../../../../../components/ui/charts";
import {
  IconCircle,
  CBuilding,
  CKey,
  CMoneyBag,
  CUsers,
  CVote,
  CWrench,
} from "../../../../../../components/ui/color-icons";
import { coproVariant, agVariant, invitationVariant } from "../../../../../../lib/status";
import { InviterSyndicModal } from "./inviter-syndic-modal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").admin.ficheClient };
}

export default async function FicheClientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const ad = dict.admin;

  const [coprosRes, syntheseRes, invitationsRes] = await Promise.all([
    apiFetch<Copropriete[]>("/coproprietes"),
    apiFetch<AdminSynthese>(`/coproprietes/${id}/synthese-admin`),
    // Visibilité opérateur : qui a (ou n'a pas encore) accès — invitations de la copropriété.
    apiFetch<Invitation[]>("/invitations", { coproprieteId: id, searchParams: { limit: 50 } }),
  ]);
  const copro = coprosRes.ok ? coprosRes.data.find((c) => c.id === id) : undefined;
  if (!copro || !syntheseRes.ok) notFound();
  const s = syntheseRes.data;
  const invitations = invitationsRes.ok ? invitationsRes.data : [];

  const du = versCentimes(s.montant_du);
  const paye = versCentimes(s.montant_paye);
  const taux = ratio(paye, du);

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${locale}/admin`} label={ad.titre} />}
        title={copro.nom}
        badge={
          <Badge variant={coproVariant[copro.statut]}>
            {dict.enums.statutCopropriete[copro.statut]}
          </Badge>
        }
        subtitle={`${copro.adresse} · ${copro.ville} · ${dict.enums.typeResidence[copro.typeResidence]}`}
        actions={
          <InviterSyndicModal
            dict={dict}
            locale={ctx.locale}
            coproprieteId={copro.id}
            coproprieteNom={copro.nom}
          />
        }
      />

      {/* Santé en un coup d'œil */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CBuilding />}
          tone="sage"
          label={dict.nav.lots}
          value={s.lots}
          hint={fill(ad.lotsDeclares, { n: copro.nbLots })}
        />
        <StatCard icon={<CUsers />} tone="lilac" label={ad.residentsActifs} value={s.residents_actifs} />
        <StatCard
          icon={<CMoneyBag />}
          tone="sage"
          label={dict.finances.tauxPaiement}
          value={`${Math.round(taux * 100)}%`}
          trendTone={taux >= 0.85 ? "ok" : taux >= 0.6 ? "warn" : "danger"}
        />
        <StatCard
          icon={<CWrench />}
          tone="tosca"
          label={dict.dash.incidentsOuverts}
          value={s.incidents_ouverts}
          trend={s.sla_depasses > 0 ? `${s.sla_depasses} · ${dict.dash.slaDepasse}` : undefined}
          trendTone="danger"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Finances */}
        <Card className="lg:col-span-2">
          <SectionHeader title={dict.dash.recouvrement} />
          <div className="mt-6">
            <Donut
              size={168}
              centerLabel={formatMAD(versChaine(du - paye), ctx.locale)}
              centerSub={dict.dash.impayes}
              items={[
                {
                  label: ad.encaisse,
                  value: Number(paye),
                  display: formatMAD(versChaine(paye), ctx.locale),
                  color: "var(--color-sage)",
                },
                {
                  label: dict.dash.impayes,
                  value: Number(du - paye),
                  display: formatMAD(versChaine(du - paye), ctx.locale),
                  color: "var(--color-danger)",
                },
              ]}
            />
          </div>
        </Card>

        {/* Invitations + AG + activité */}
        <div className="min-w-0 space-y-4">
          <Card>
            <SectionHeader title={dict.nav.invitations} />
            <div className="mt-4 flex items-center gap-3.5">
              <IconCircle tone="sand" size={44}>
                <CKey />
              </IconCircle>
              <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-soft">{ad.invitationsEnAttente}</dt>
                  <dd className="tnum font-semibold text-ink">{s.invitations_en_attente}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-soft">{ad.invitationsAcceptees}</dt>
                  <dd className="tnum font-semibold text-ink">{s.invitations_acceptees}</dd>
                </div>
              </dl>
            </div>
            {invitations.length > 0 ? (
              <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                {invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[13px]">
                    <span className="font-medium text-ink">{dict.roles[i.roleCible]}</span>
                    <Badge variant={invitationVariant[i.statut]}>
                      {dict.enums.statutInvitation[i.statut]}
                    </Badge>
                    <span className="ms-auto text-[12px] text-soft">
                      {i.statut === "EN_ATTENTE"
                        ? fill(dict.invitations.expire, { date: formatDateCourte(i.expireLe, ctx.locale) })
                        : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[13px] text-soft">{ad.syndicAide}</p>
            )}
          </Card>

          <Card>
            <SectionHeader title={dict.dash.prochaineAg} />
            {s.prochaine_ag ? (
              <div className="mt-4 flex items-center gap-3.5">
                <IconCircle tone="lilac" size={44}>
                  <CVote />
                </IconCircle>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {formatDateHeure(s.prochaine_ag.date_ag, ctx.locale)}
                  </p>
                  <Badge
                    variant={agVariant[s.prochaine_ag.statut as keyof typeof agVariant] ?? "neutral"}
                    className="mt-1.5"
                  >
                    {dict.enums.statutAg[s.prochaine_ag.statut as keyof typeof dict.enums.statutAg] ??
                      s.prochaine_ag.statut}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-soft">{dict.dash.aucuneAg}</p>
            )}
          </Card>

          <Card>
            <SectionHeader title={ad.derniereActivite} />
            <p className="mt-3 text-sm text-body">
              {s.derniere_activite
                ? formatDateHeure(s.derniere_activite, ctx.locale)
                : ad.aucuneActivite}
            </p>
            <p className="mt-2 text-[13px] text-soft">
              {dict.nav.documents} · <span className="tnum font-medium text-ink">{s.documents}</span>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
