import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type {
  LcdDeclaration,
  LcdDuJour,
  LcdReglement,
  LcdSejour,
  Lot,
} from "../../../../lib/api/types";
import { getDict, isLocale, type Dict } from "../../../../lib/i18n";
import { formatDate } from "../../../../lib/format";
import { trierSejours, vueLcd } from "../../../../lib/lcd";
import { nomsMembres } from "../../../../lib/lcd-server";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { ButtonLink } from "../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { CCalendar, CKey, CShield, IconCircle } from "../../../../components/ui/color-icons";
import { IconPlus, IconSettings } from "../../../../components/ui/icons";
import { declarationLcdVariant, regimeLcdVariant } from "../../../../lib/status";
import { SejourListe } from "../../../../components/lcd/sejour-list";
import { Ligne, Lignes } from "../../../../components/espaces/ligne-liste";
import { ConfirmerArriveeForm, ConfirmerDepartForm, DeclarerLotModal } from "./lcd-modals";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.locationCourteDuree };
}

const POIDS_DECLARATION = { EN_ATTENTE: 0, VALIDEE: 1, SUSPENDUE: 2, REFUSEE: 3, CLOTUREE: 4 } as const;

function BanniereRegime({
  regime,
  dict,
  lienReglement,
}: {
  regime: LcdReglement["regimeLcd"] | null;
  dict: Dict;
  lienReglement: string | null;
}) {
  const l = dict.lcd;
  if (regime === "NON_DEFINI") {
    return (
      <Banner
        variant="legal"
        title={l.regimeNonDefini}
        className="mb-5"
        action={
          lienReglement ? (
            <ButtonLink href={lienReglement} size="sm" variant="secondary">
              {l.configurerReglement}
            </ButtonLink>
          ) : undefined
        }
      >
        {lienReglement ? l.regimeNonDefiniSyndic : l.regimeNonDefiniCorps}
      </Banner>
    );
  }
  if (regime === "INTERDITE") {
    return (
      <Banner variant="danger" title={l.regimeInterdit} className="mb-5">
        {l.regimeInterditCorps}
      </Banner>
    );
  }
  return null;
}

export default async function LocationCourteDureePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ declarer?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const l = dict.lcd;
  const vue = vueLcd(ctx);
  if (vue === "aucune") redirect(`/${locale}/tableau-de-bord`);

  const p = (path: string) => `/${locale}${path}`;
  const gestion = vue === "gestion";
  const voitDuJour = gestion || vue === "gardien";
  const peutConfirmer = gestion || vue === "gardien";

  const [reglementRes, declarationsRes, duJourRes, sejoursRes, lotsRes, nomMembre] =
    await Promise.all([
      apiFetch<LcdReglement>("/lcd/reglement"),
      apiFetch<LcdDeclaration[]>("/lcd/declarations"),
      voitDuJour ? apiFetch<LcdDuJour>("/lcd/sejours/du-jour") : Promise.resolve(null),
      vue === "gardien"
        ? apiFetch<LcdSejour[]>("/lcd/sejours", { searchParams: { statut: "PREVU" } })
        : vue === "resident" || vue === "gestionnaire"
          ? apiFetch<LcdSejour[]>("/lcd/sejours")
          : Promise.resolve(null),
      vue === "resident" || gestion
        ? apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } })
        : Promise.resolve(null),
      gestion || vue === "conseil" ? nomsMembres(vue) : Promise.resolve(new Map<string, string>()),
    ]);

  const reglement = reglementRes.ok ? reglementRes.data : null;
  const regime = reglement?.regimeLcd ?? null;
  const declarations = (declarationsRes.ok ? declarationsRes.data : []).sort(
    (a, b) => POIDS_DECLARATION[a.statut] - POIDS_DECLARATION[b.statut] || b.creeLe.localeCompare(a.creeLe)
  );
  const duJour = duJourRes?.ok ? duJourRes.data : null;
  const sejours = trierSejours(sejoursRes?.ok ? sejoursRes.data : []);
  const lots = lotsRes?.ok ? lotsRes.data : [];
  const nom = (id: string | null) => (id ? (nomMembre.get(id) ?? `${id.slice(0, 8)}…`) : null);
  const erreurChargement = !reglementRes.ok || !declarationsRes.ok || (sejoursRes !== null && !sejoursRes.ok);

  // Lots déclarables : ceux que je possède (résident) ou tous (syndic), sans déclaration ouverte.
  const ouvertes = new Set(
    declarations.filter((d) => d.statut !== "CLOTUREE" && d.statut !== "REFUSEE").map((d) => d.lotId)
  );
  const lotsDeclarables = lots
    .filter((lot) =>
      gestion
        ? true
        : (lot.proprietaires ?? []).some((r) => !r.dateFin && r.utilisateurId === ctx.profil.id)
    )
    .filter((lot) => !ouvertes.has(lot.id))
    .map((lot) => ({ id: lot.id, numero: lot.numero }));
  const regimeOuvert = regime === "AUTORISEE" || regime === "ENCADREE";
  const aValidee = declarations.some((d) => d.statut === "VALIDEE");
  const peutDeclarerSejour = regimeOuvert && aValidee && vue !== "conseil" && vue !== "gardien";

  const boutonsSejour = (s: LcdSejour) =>
    peutConfirmer ? (
      s.statut === "PREVU" ? (
        <ConfirmerArriveeForm dict={dict} locale={ctx.locale} sejourId={s.id} nbVoyageurs={s.nbVoyageurs} />
      ) : s.statut === "EN_COURS" ? (
        <ConfirmerDepartForm dict={dict} locale={ctx.locale} sejourId={s.id} />
      ) : null
    ) : null;

  const titre = vue === "resident" || vue === "gestionnaire" ? l.mesLocations : l.titre;

  return (
    <div className="page-root">
      <PageHeader
        title={titre}
        subtitle={l.subtitle}
        actions={
          <>
            {peutDeclarerSejour ? (
              <ButtonLink href={p("/location-courte-duree/sejours/nouveau")}>
                <IconPlus width={16} height={16} />
                {l.declarerSejour}
              </ButtonLink>
            ) : null}
            {regimeOuvert && (vue === "resident" || gestion) && lotsDeclarables.length > 0 ? (
              <DeclarerLotModal
                dict={dict}
                locale={ctx.locale}
                lots={lotsDeclarables}
                ouvertInitialement={sp.declarer === "1"}
                variant={peutDeclarerSejour ? "secondary" : "primary"}
              />
            ) : null}
            {gestion ? (
              <ButtonLink href={p("/location-courte-duree/reglement")} variant="secondary">
                <IconSettings width={16} height={16} />
                {l.configurerReglement}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {erreurChargement ? (
        <Banner variant="warn" className="mb-5">
          {l.chargementImpossible}
        </Banner>
      ) : null}

      <BanniereRegime
        regime={regime}
        dict={dict}
        lienReglement={gestion ? p("/location-courte-duree/reglement") : null}
      />

      {/* ── Syndic / conseil : régime + indicateurs ── */}
      {(gestion || vue === "conseil") && reglement ? (
        <div className="mb-10 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <IconCircle tone={regime === "INTERDITE" ? "danger" : regime === "NON_DEFINI" ? "sand" : "sage"} size={44}>
                <CShield width={22} height={22} />
              </IconCircle>
              <Badge variant={regimeLcdVariant[reglement.regimeLcd]}>
                {dict.enums.regimeLcd[reglement.regimeLcd]}
              </Badge>
            </div>
            <p className="mt-4 text-[17px] font-bold text-ink">{l.regime}</p>
            <p className="mt-0.5 text-[13px] text-soft">{l.regimeAide}</p>
            {regime === "ENCADREE" && reglement.parametresLcdJson ? (
              <dl className="mt-3 divide-y divide-wash-strong text-[13px]">
                {reglement.parametresLcdJson.nb_nuits_max_par_an !== null ? (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-soft">{l.nuitsMax}</dt>
                    <dd className="tnum font-semibold text-ink">{reglement.parametresLcdJson.nb_nuits_max_par_an}</dd>
                  </div>
                ) : null}
                {reglement.parametresLcdJson.nb_voyageurs_max_par_lot !== null ? (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-soft">{l.voyageursMax}</dt>
                    <dd className="tnum font-semibold text-ink">{reglement.parametresLcdJson.nb_voyageurs_max_par_lot}</dd>
                  </div>
                ) : null}
                {reglement.parametresLcdJson.delai_declaration_heures !== null ? (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-soft">{l.delaiDeclaration}</dt>
                    <dd className="tnum font-semibold text-ink">{reglement.parametresLcdJson.delai_declaration_heures}</dd>
                  </div>
                ) : null}
              </dl>
            ) : regime === "AUTORISEE" ? (
              <p className="mt-3 text-[13px] text-body">{l.regimeAutorisee}</p>
            ) : null}
            {gestion ? (
              <Link href={p("/location-courte-duree/reglement")} className="link mt-auto inline-block pt-4 text-[14px]">
                {l.configurerReglement}
              </Link>
            ) : null}
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            icon={<CKey />}
            tone="warn"
            label={dict.enums.statutDeclarationLcd.EN_ATTENTE}
            value={declarations.filter((d) => d.statut === "EN_ATTENTE").length}
          />
          <StatCard
            icon={<CCalendar />}
            tone="tosca"
            label={l.enCours}
            value={duJour ? duJour.enCours.length : declarations.filter((d) => d.statut === "VALIDEE").length}
          />
          </div>
        </div>
      ) : null}

      <div className="space-y-10">
        {/* ── Aujourd'hui (syndic, gardien) ── */}
        {duJour ? (
          <div>
            <SectionHeader
              title={l.duJour}
              subtitle={formatDate(duJour.date, ctx.locale)}
              className="mb-3"
            />
            {duJour.arrivees.length + duJour.departs.length + duJour.enCours.length === 0 ? (
              <div className="card flex items-center gap-4 p-5">
                <IconCircle tone="surface" size={46}>
                  <CCalendar width={22} height={22} />
                </IconCircle>
                <p className="text-[15px] font-semibold text-ink-strong">{l.rienAujourdhui}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {duJour.arrivees.length > 0 ? (
                  <div>
                    <h3 className="mb-1 text-[15px] font-bold text-ink">{l.arrivees}</h3>
                    <SejourListe sejours={duJour.arrivees} dict={dict} locale={ctx.locale} actions={boutonsSejour} />
                  </div>
                ) : null}
                {duJour.departs.length > 0 ? (
                  <div>
                    <h3 className="mb-1 text-[15px] font-bold text-ink">{l.departs}</h3>
                    <SejourListe sejours={duJour.departs} dict={dict} locale={ctx.locale} actions={boutonsSejour} />
                  </div>
                ) : null}
                {duJour.enCours.length > 0 ? (
                  <div>
                    <h3 className="mb-1 text-[15px] font-bold text-ink">{l.enCours}</h3>
                    <SejourListe sejours={duJour.enCours} dict={dict} locale={ctx.locale} actions={boutonsSejour} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {/* ── Gardien : séjours à venir ── */}
        {vue === "gardien" && sejours.length > 0 ? (
          <div>
            <SectionHeader title={l.aVenir} className="mb-3" />
            <SejourListe sejours={sejours} dict={dict} locale={ctx.locale} actions={boutonsSejour} />
          </div>
        ) : null}

        {/* ── Syndic / conseil : table des déclarations ── */}
        {gestion || vue === "conseil" ? (
          <div>
            <SectionHeader title={l.declarations} className="mb-3" />
            {declarations.length === 0 ? (
              <EmptyState title={l.aucuneDeclaration} hint={l.aucuneDeclarationAide} illustration="empty-lcd" />
            ) : (
              <TableCard>
                <Table>
                  <THead>
                    <TH>{l.lot}</TH>
                    <TH>{l.declarant}</TH>
                    <TH>{l.gestionnaire}</TH>
                    <TH>{l.plateformes}</TH>
                    <TH>{l.statut}</TH>
                    <TH>{l.dateDebut}</TH>
                  </THead>
                  <tbody>
                    {declarations.map((d) => (
                      <TR key={d.id}>
                        <TD>
                          <Link
                            href={p(`/location-courte-duree/declarations/${d.id}`)}
                            className="font-semibold text-ink hover:text-link"
                          >
                            {d.lot?.numero ?? "—"}
                          </Link>
                          {d.lot ? (
                            <p className="mt-0.5 text-[12px] text-soft">{dict.enums.typeLot[d.lot.typeLot]}</p>
                          ) : null}
                        </TD>
                        <TD className="text-[13px] text-body">{nom(d.declareParId)}</TD>
                        <TD className="text-[13px] text-body">
                          {d.gestionnaireId ? nom(d.gestionnaireId) : <span className="text-faint">{l.aucunGestionnaire}</span>}
                        </TD>
                        <TD className="text-[13px] text-body">
                          {d.plateformesJson && d.plateformesJson.length > 0 ? d.plateformesJson.join(", ") : <span className="text-faint">{dict.common.none}</span>}
                        </TD>
                        <TD>
                          <Badge variant={declarationLcdVariant[d.statut]} pulse={d.statut === "EN_ATTENTE"}>
                            {dict.enums.statutDeclarationLcd[d.statut]}
                          </Badge>
                        </TD>
                        <TD className="tnum text-[13px] text-soft">{formatDate(d.dateDebut, ctx.locale)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableCard>
            )}
          </div>
        ) : null}

        {/* ── Résident / gestionnaire : mes déclarations ── */}
        {vue === "resident" || vue === "gestionnaire" ? (
          <div>
            <SectionHeader title={l.declarations} className="mb-3" />
            {declarations.length === 0 ? (
              <EmptyState
                title={l.aucuneDeclarationResident}
                hint={regimeOuvert && vue === "resident" ? l.declarerLotAide : undefined}
                illustration="empty-lcd"
              />
            ) : (
              <Lignes>
                {declarations.map((d) => (
                  <Ligne
                    key={d.id}
                    icon={<CKey width={22} height={22} />}
                    tone={d.statut === "VALIDEE" ? "sage" : d.statut === "EN_ATTENTE" ? "warn" : "sand"}
                    href={p(`/location-courte-duree/declarations/${d.id}`)}
                    title={`${l.lot} ${d.lot?.numero ?? "—"}`}
                    subtitle={
                      <>
                        {d.plateformesJson && d.plateformesJson.length > 0 ? `${d.plateformesJson.join(", ")} · ` : ""}
                        {d.gestionnaireId ? l.gestionnaire : l.aucunGestionnaire}
                        {" · "}
                        <span className="tnum">{formatDate(d.dateDebut, ctx.locale)}</span>
                      </>
                    }
                    extra={
                      d.motifDecision && (d.statut === "REFUSEE" || d.statut === "SUSPENDUE") ? (
                        <p className="mt-1 text-[13px] text-danger">{d.motifDecision}</p>
                      ) : undefined
                    }
                    end={
                      <Badge variant={declarationLcdVariant[d.statut]} pulse={d.statut === "EN_ATTENTE"}>
                        {dict.enums.statutDeclarationLcd[d.statut]}
                      </Badge>
                    }
                  />
                ))}
              </Lignes>
            )}
          </div>
        ) : null}

        {/* ── Résident / gestionnaire : mes séjours ── */}
        {vue === "resident" || vue === "gestionnaire" ? (
          <div>
            <SectionHeader
              title={l.mesSejours}
              className="mb-3"
              action={
                peutDeclarerSejour ? (
                  <Link href={p("/location-courte-duree/sejours/nouveau")} className="link text-[14px]">
                    {l.declarerSejour}
                  </Link>
                ) : undefined
              }
            />
            {sejours.length === 0 ? (
              <EmptyState
                title={l.aucunSejour}
                hint={aValidee ? l.aucunSejourAide : regimeOuvert ? l.aucunLotValide : undefined}
                illustration="empty-lcd"
              />
            ) : (
              <SejourListe sejours={sejours} dict={dict} locale={ctx.locale} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
