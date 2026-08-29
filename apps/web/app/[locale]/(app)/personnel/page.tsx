import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Lot, Personnel, Profil } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDate, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { Card } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Avatar } from "../../../../components/ui/avatar";
import { personnelVariant } from "../../../../lib/status";
import { IconUsers } from "../../../../components/ui/icons";
import { ChangerPresenceModal, CreerFicheModal } from "./personnel-modals";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.personnel };
}

export default async function PersonnelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const pe = dict.personnel;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));

  const [personnelRes, lotsRes] = await Promise.all([
    apiFetch<Personnel[]>("/personnel"),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  const fiches = personnelRes.ok ? personnelRes.data : [];
  const lots = lotsRes.ok ? lotsRes.data : [];
  const loges = lots.filter((l) => l.typeLot === "LOGE_GARDIEN");
  const lotParId = new Map(lots.map((l) => [l.id, l.numero]));

  // Le registre ne porte que l'utilisateurId — la fiche membre donne le nom (syndic).
  const profils = new Map<string, Profil | null>(
    gestion
      ? await Promise.all(
          fiches.map(async (f) => {
            const u = await apiFetch<Profil>(`/users/${f.utilisateurId}`);
            return [f.utilisateurId, u.ok ? u.data : null] as const;
          })
        )
      : []
  );

  const absent = fiches.some((f) => f.statut === "ABSENT");

  return (
    <div className="animate-fade">
      <PageHeader
        title={pe.titre}
        subtitle={pe.subtitle}
        actions={
          gestion ? (
            <CreerFicheModal
              dict={dict}
              locale={ctx.locale}
              loges={loges.map((l) => ({ id: l.id, numero: l.numero }))}
            />
          ) : undefined
        }
      />

      {absent ? (
        <Banner variant="warn" className="mb-4">
          {pe.absentAlerte}
        </Banner>
      ) : null}

      {fiches.length === 0 ? (
        <EmptyState
          title={pe.aucuneFiche}
          hint={gestion ? pe.aucuneFicheAide : undefined}
          icon={<IconUsers width={44} height={44} />}
          action={
            gestion ? (
              <CreerFicheModal
                dict={dict}
                locale={ctx.locale}
                loges={loges.map((l) => ({ id: l.id, numero: l.numero }))}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fiches.map((f) => {
            const profil = profils.get(f.utilisateurId);
            const nom = nomComplet(profil) ?? dict.roles.GARDIEN;
            const estMoi = f.utilisateurId === ctx.profil.id;
            return (
              <Card key={f.id}>
                <div className="flex items-start justify-between gap-3">
                  <Avatar nom={nom} size={44} solid={estMoi} />
                  <Badge variant={personnelVariant[f.statut]} pulse={f.statut === "ABSENT"}>
                    {dict.enums.statutPersonnel[f.statut]}
                  </Badge>
                </div>
                <h2 className="mt-4 truncate text-[15px] font-semibold text-ink">
                  {gestion ? (
                    <Link
                      href={`/${ctx.locale}/membres/${f.utilisateurId}`}
                      className="hover:text-action"
                    >
                      {nom}
                    </Link>
                  ) : (
                    nom
                  )}
                  {estMoi ? (
                    <span className="ms-2 text-[12px] font-normal text-soft">({pe.maFiche})</span>
                  ) : null}
                </h2>
                <p className="mt-1 text-[13px] text-soft">
                  {pe.logement} :{" "}
                  {f.logementLotId ? (lotParId.get(f.logementLotId) ?? "—") : pe.aucuneLoge}
                </p>
                <p className="mt-0.5 text-[12px] text-faint">
                  {formatDate(f.creeLe, ctx.locale)}
                </p>
                {gestion ? (
                  <div className="mt-4 border-t border-hairline pt-4">
                    <ChangerPresenceModal
                      dict={dict}
                      locale={ctx.locale}
                      personnelId={f.id}
                      statutActuel={f.statut}
                      logementActuel={f.logementLotId}
                      loges={loges.map((l) => ({ id: l.id, numero: l.numero }))}
                    />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
