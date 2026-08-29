import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Lot, Visite } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDateHeure } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { CBell, CDoor, IconCircle } from "../../../../components/ui/color-icons";
import { visiteVariant } from "../../../../lib/status";
import { EnregistrerVisiteModal, RepondreVisiteForm } from "./visite-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.visites };
}

export default async function VisitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ enregistrer?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const v = dict.visites;
  const gardien = ctx.roles.includes("GARDIEN");
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const resident = !gardien && !gestion && !ctx.roles.includes("CONSEIL_SYNDICAL");

  const [visitesRes, lotsRes] = await Promise.all([
    apiFetch<Visite[]>("/visites"),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  const visites = visitesRes.ok ? visitesRes.data : [];
  const lots = lotsRes.ok ? lotsRes.data : [];
  const lotParId = new Map(lots.map((l) => [l.id, l.numero]));

  // Lots où le résident connecté peut répondre (propriétaire ou occupant actif).
  const mesLotIds = new Set(
    lots
      .filter((l) =>
        [...(l.proprietaires ?? []), ...(l.occupants ?? [])].some(
          (r) => !r.dateFin && r.utilisateurId === ctx.profil.id
        )
      )
      .map((l) => l.id)
  );

  const aujourdhui = new Date().toDateString();
  const duJour = visites.filter((x) => new Date(x.horodatage).toDateString() === aujourdhui);
  const historique = visites.filter(
    (x) => new Date(x.horodatage).toDateString() !== aujourdhui
  );

  const CarteVisite = ({ visite }: { visite: Visite }) => {
    const peutRepondre =
      visite.statut === "EN_ATTENTE" && (resident ? mesLotIds.has(visite.lotId) : false);
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <IconCircle tone={visite.statut === "EN_ATTENTE" ? "warn" : "sand"} size={40}>
          <CDoor width={20} height={20} />
        </IconCircle>
        <div className="min-w-0 flex-1">
          {peutRepondre ? (
            <p className="text-sm font-semibold text-ink">
              {fill(v.demandeAcces, {
                nom: visite.visiteurNom,
                lot: lotParId.get(visite.lotId) ?? "—",
              })}
            </p>
          ) : (
            <p className="text-sm font-semibold text-ink">{visite.visiteurNom}</p>
          )}
          <p className="mt-0.5 text-[13px] text-soft">
            {dict.invitations.lot} {lotParId.get(visite.lotId) ?? "—"} ·{" "}
            {formatDateHeure(visite.horodatage, ctx.locale)}
          </p>
        </div>
        {peutRepondre ? (
          <RepondreVisiteForm dict={dict} locale={ctx.locale} visiteId={visite.id} />
        ) : (
          <Badge variant={visiteVariant[visite.statut]} pulse={visite.statut === "EN_ATTENTE"}>
            {dict.enums.statutVisite[visite.statut]}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={resident ? v.mesVisites : v.titre}
        actions={
          gardien || gestion ? (
            <EnregistrerVisiteModal
              dict={dict}
              locale={ctx.locale}
              lots={lots.map((l) => ({ id: l.id, numero: l.numero }))}
              ouvertInitialement={sp.enregistrer === "1"}
              grand
            />
          ) : undefined
        }
      />

      {(gardien || gestion) && visites.length > 0 ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard icon={<CDoor />} tone="sand" label={v.titre} value={visites.length} />
          <StatCard icon={<CDoor />} tone="tosca" label={v.duJour} value={duJour.length} />
          <StatCard
            icon={<CBell />}
            tone="warn"
            label={dict.enums.statutVisite.EN_ATTENTE}
            value={visites.filter((x) => x.statut === "EN_ATTENTE").length}
          />
        </div>
      ) : null}

      {visites.length === 0 ? (
        <EmptyState
          title={v.aucuneVisite}
          hint={gardien || gestion ? v.aucuneVisiteAide : undefined}
          icon={
            <IconCircle tone="sand" size={64}>
              <CDoor width={30} height={30} />
            </IconCircle>
          }
        />
      ) : (
        <div className="space-y-6">
          {duJour.length > 0 ? (
            <div>
              <SectionHeader title={v.duJour} className="mb-3" />
              <Card padded={false} className="divide-y divide-hairline">
                {duJour.map((x) => (
                  <CarteVisite key={x.id} visite={x} />
                ))}
              </Card>
            </div>
          ) : null}
          {historique.length > 0 ? (
            <div>
              <SectionHeader title={v.historique} className="mb-3" />
              <Card padded={false} className="divide-y divide-hairline">
                {historique.map((x) => (
                  <CarteVisite key={x.id} visite={x} />
                ))}
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
