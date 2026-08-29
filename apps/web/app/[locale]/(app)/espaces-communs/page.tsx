import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { EspaceCommun, Lot } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Card } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { CHome, IconCircle } from "../../../../components/ui/color-icons";
import { EspaceImage } from "../../../../components/espaces/espace-image";
import { CreerEspaceModal, ModifierEspaceModal, ReserverModal } from "./espace-modals";
import { ConfirmDelete } from "../../../../components/ui/confirm-delete";
import { supprimerEspace } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.espaces };
}

export default async function EspacesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const e = dict.espaces;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const peutReserver = !["GARDIEN", "PRESTATAIRE", "CONSEIL_SYNDICAL"].includes(ctx.role) || gestion;

  const [espacesRes, lotsRes] = await Promise.all([
    apiFetch<EspaceCommun[]>("/espaces-communs"),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  const espaces = espacesRes.ok ? espacesRes.data : [];
  const lots = lotsRes.ok ? lotsRes.data : [];
  // Résident : ses lots ; syndic : tous (réservation au nom d'un lot).
  const mesLots = gestion
    ? lots
    : lots.filter((l) =>
        [...(l.proprietaires ?? []), ...(l.occupants ?? [])].some(
          (r) => !r.dateFin && r.utilisateurId === ctx.profil.id
        )
      );

  return (
    <div className="animate-fade">
      <PageHeader
        title={e.titre}
        subtitle={e.subtitle}
        actions={gestion ? <CreerEspaceModal dict={dict} locale={ctx.locale} /> : undefined}
      />

      {espaces.length === 0 ? (
        <EmptyState
          title={e.aucunEspace}
          hint={gestion ? e.aucunEspaceAide : undefined}
          icon={
            <IconCircle tone="sage" size={64}>
              <CHome width={30} height={30} />
            </IconCircle>
          }
          action={gestion ? <CreerEspaceModal dict={dict} locale={ctx.locale} /> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {espaces.map((esp) => (
            <Card key={esp.id} padded={false} className="flex flex-col overflow-hidden">
              {/* Photo de l'espace — la carte devient un lieu, pas une ligne de texte. */}
              <div className="relative">
                <EspaceImage nom={esp.nom} type={esp.type} className="h-36 w-full" />
                <span className="absolute end-3 top-3">
                  <Badge variant={esp.reservable ? "ok" : "neutral"}>
                    {esp.reservable ? e.reservable : e.nonReservable}
                  </Badge>
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
              <h2 className="truncate text-[15px] font-semibold text-ink">{esp.nom}</h2>
              <p className="mt-0.5 truncate text-[13px] text-soft">
                {esp.type}
                {esp.capacite ? ` · ${fill(e.personnes, { n: esp.capacite })}` : ""}
              </p>
              <p className="mt-1 text-[12px] text-faint">
                {esp.validationAutomatique ? e.validationAuto : e.validationManuelle}
              </p>
              {esp.reservable && peutReserver && mesLots.length > 0 ? (
                <div className="mt-4 border-t border-hairline pt-4">
                  <ReserverModal
                    dict={dict}
                    locale={ctx.locale}
                    espaceId={esp.id}
                    espaceNom={esp.nom}
                    mesLots={mesLots.map((l) => ({ id: l.id, numero: l.numero }))}
                  />
                </div>
              ) : null}
              {gestion ? (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-1.5 border-t border-hairline pt-3">
                  <ModifierEspaceModal dict={dict} locale={ctx.locale} espace={esp} />
                  <ConfirmDelete
                    dict={dict}
                    locale={ctx.locale}
                    action={supprimerEspace}
                    champs={{ espace_id: esp.id }}
                    nom={esp.nom}
                  />
                </div>
              ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
