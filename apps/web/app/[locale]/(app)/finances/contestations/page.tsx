import type { Metadata } from "next";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../lib/membres";
import type { Contestation } from "../../../../../lib/api/types";
import { contexteLignes, getLots, getSynthese } from "../../../../../lib/finances-data";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDateHeure, formatPeriode } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Card } from "../../../../../components/ui/card";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { StatCard } from "../../../../../components/ui/stat-card";
import { Avatar } from "../../../../../components/ui/avatar";
import { CAlert, CScale, IconCircle } from "../../../../../components/ui/color-icons";
import { contestationVariant } from "../../../../../lib/status";
import { RepondreModal } from "./repondre-modal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.contestations };
}

export default async function ContestationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const f = dict.finances;

  const [contestationsRes, synthese, lots, membres] = await Promise.all([
    apiFetch<Contestation[]>("/finances/contestations"),
    getSynthese(),
    getLots(),
    gestion ? annuaireMembres() : Promise.resolve([]),
  ]);
  const contestations = contestationsRes.ok ? contestationsRes.data : [];

  // Contexte des lignes contestées (lot + période) depuis la synthèse partagée.
  const lotParId = new Map(lots.map((l) => [l.id, l.numero]));
  const cx = contexteLignes(synthese);
  const ligneContexte = new Map(
    [...cx.entries()].map(([id, c]) => [
      id,
      { lotNumero: lotParId.get(c.lotId) ?? null, periode: c.periode },
    ])
  );
  const membreParId = new Map(membres.map((m) => [m.id, m.nom]));
  const ouvertes = contestations.filter((c) => c.statut === "OUVERTE").length;

  return (
    <div className="animate-fade">
      <PageHeader
        title={f.contestations}
        subtitle={gestion ? f.contestationsSubtitle : undefined}
      />

      {contestations.length === 0 ? (
        <EmptyState title={f.aucuneContestation} />
      ) : (
        <>
          {/* Indicateurs — comptes dérivés de la liste déjà chargée. */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={<CScale />}
              tone="lilac"
              label={f.contestations}
              value={contestations.length}
            />
            <StatCard
              icon={<CAlert />}
              tone="warn"
              label={dict.enums.statutContestation.OUVERTE}
              value={ouvertes}
              trendTone="warn"
            />
          </div>
          <div className="space-y-4">
          {contestations.map((c) => {
            const cx = ligneContexte.get(c.appelDeFondsLotId);
            const nomMembre = gestion ? membreParId.get(c.utilisateurId) : undefined;
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    {nomMembre ? (
                      <Avatar nom={nomMembre} size={40} className="mt-0.5" />
                    ) : (
                      <IconCircle tone="lilac" size={40} className="mt-0.5">
                        <CScale width={20} height={20} />
                      </IconCircle>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={contestationVariant[c.statut]}>
                          {dict.enums.statutContestation[c.statut]}
                        </Badge>
                        {cx ? (
                          <span className="truncate text-[13px] font-medium text-ink">
                            {cx.lotNumero ? `${dict.invitations.lot} ${cx.lotNumero} · ` : ""}
                            {formatPeriode(cx.periode, ctx.locale)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-body">{c.motif}</p>
                      <p className="mt-2 text-[12px] text-faint">
                        {nomMembre ? `${f.deposeePar} ${nomMembre} · ` : ""}
                        {formatDateHeure(c.creeLe, ctx.locale)}
                      </p>
                    </div>
                  </div>
                  {gestion && c.statut === "OUVERTE" ? (
                    <RepondreModal
                      dict={dict}
                      locale={ctx.locale}
                      contestationId={c.id}
                      motif={c.motif}
                    />
                  ) : null}
                </div>
                {c.reponseSyndic ? (
                  <div className="mt-4 rounded-field bg-ground px-4 py-3 sm:ms-[54px]">
                    <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-faint">
                      {f.reponseSyndic}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-body">{c.reponseSyndic}</p>
                  </div>
                ) : null}
              </Card>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
