import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type {
  Incident,
  LcdDeclaration,
  LcdSejour,
  LcdSejourEvenement,
} from "../../../../../../lib/api/types";
import { fill, getDict, isLocale } from "../../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatTelephone } from "../../../../../../lib/format";
import { nbNuits, vueLcd } from "../../../../../../lib/lcd";
import { nomsMembres } from "../../../../../../lib/lcd-server";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { CCalendar, CUsers, CWrench, IconCircle } from "../../../../../../components/ui/color-icons";
import { incidentVariant, sejourVariant } from "../../../../../../lib/status";
import { ConfirmerArriveeForm, ConfirmerDepartForm } from "../../lcd-modals";
import { AnnulerSejourModal, PiecesJointesCard } from "./sejour-actions";
import type { LcdPieceJointe } from "../../../../../../lib/api/types";

type SejourDetail = LcdSejour & { evenements?: LcdSejourEvenement[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").lcd.sejour };
}

const TONE_EVENEMENT: Record<LcdSejourEvenement["type"], { fond: string; point: string }> = {
  DECLARE: { fond: "bg-tosca-tint", point: "bg-action" },
  MODIFIE: { fond: "bg-tosca-tint", point: "bg-action" },
  GARDIEN_NOTIFIE: { fond: "bg-tosca-tint", point: "bg-action" },
  ARRIVEE_CONFIRMEE: { fond: "bg-ok-tint", point: "bg-ok" },
  DEPART_CONFIRME: { fond: "bg-ok-tint", point: "bg-ok" },
  INCIDENT_LIE: { fond: "bg-warn-tint", point: "bg-warn" },
  ANNULE: { fond: "bg-danger-tint", point: "bg-danger" },
};

export default async function SejourDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ declare?: string; modifie?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const l = dict.lcd;
  const vue = vueLcd(ctx);
  if (vue === "aucune") redirect(`/${locale}/tableau-de-bord`);
  const p = (path: string) => `/${locale}${path}`;

  const sejourRes = await apiFetch<SejourDetail>(`/lcd/sejours/${id}`);
  if (!sejourRes.ok) notFound();
  const s = sejourRes.data;

  const [declRes, incidentsRes, nomMembre] = await Promise.all([
    apiFetch<LcdDeclaration>(`/lcd/declarations/${s.declarationLcdId}`),
    vue === "gestionnaire"
      ? Promise.resolve(null)
      : apiFetch<Incident[]>("/incidents", { searchParams: { sejour_id: id, limit: 20 } }),
    vue === "gestion" || vue === "conseil" || vue === "gardien" ? nomsMembres(vue) : Promise.resolve(new Map<string, string>()),
  ]);
  const declaration = declRes.ok ? declRes.data : null;
  const incidents = incidentsRes?.ok ? incidentsRes.data : [];
  const piecesRes = s.piecesJointes?.length ? await apiFetch<LcdPieceJointe[]>(`/lcd/sejours/${id}/pieces-jointes`) : null;
  const pieces = (piecesRes?.ok ? piecesRes.data : []).map((pj, n) => ({ ...pj, src: `/api/lcd-piece?sejour=${encodeURIComponent(id)}&n=${n}` }));
  const rolesJoint = ["SYNDIC", "SUPER_ADMIN", "PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT", "GESTIONNAIRE_LCD"];
  const peutRetirer = ctx.roles.some((r) => rolesJoint.includes(r)) && s.statut !== "ANNULE";
  const peutJoindre = (peutRetirer || ctx.roles.includes("GARDIEN")) && s.statut !== "ANNULE";
  const nom = (uid: string | null) => {
    if (!uid) return null;
    if (uid === ctx.profil.id) return [ctx.profil.prenom, ctx.profil.nom].filter(Boolean).join(" ") || null;
    return nomMembre.get(uid) ?? null;
  };

  const gestion = vue === "gestion";
  const moi = ctx.profil.id;
  const acteurDuSejour =
    gestion ||
    s.declareParId === moi ||
    (declaration ? declaration.declareParId === moi || declaration.gestionnaireId === moi : false);
  const peutConfirmer = gestion || vue === "gardien";
  const peutModifier = s.statut === "PREVU" && acteurDuSejour;
  const nuits = nbNuits(s.dateArrivee, s.dateDepart);
  const evenements = [...(s.evenements ?? [])].sort((a, b) => a.horodatage.localeCompare(b.horodatage));

  return (
    <div className="animate-fade">
      {sp.declare === "1" ? (
        <Banner variant="ok" className="mb-5">
          {l.sejourDeclare}
        </Banner>
      ) : sp.modifie === "1" ? (
        <Banner variant="ok" className="mb-5">
          {l.sejourModifie}
        </Banner>
      ) : null}

      <PageHeader
        back={<BackLink href={p("/location-courte-duree")} label={dict.nav.locationCourteDuree} />}
        title={s.voyageurPrincipalNom}
        badge={
          <Badge variant={sejourVariant[s.statut]} pulse={s.statut === "EN_COURS"}>
            {dict.enums.statutSejour[s.statut]}
          </Badge>
        }
        subtitle={
          <>
            {l.lot} {s.lot?.numero ?? "—"} ·{" "}
            <span className="tnum inline-block" dir="ltr">
              {formatDate(s.dateArrivee, ctx.locale)} → {formatDate(s.dateDepart, ctx.locale)}
            </span>{" "}
            · {nuits === 1 ? l.nuit : fill(l.nuits, { n: nuits })} ·{" "}
            {s.nbVoyageurs === 1 ? l.voyageur : fill(l.voyageurs, { n: s.nbVoyageurs })}
          </>
        }
        actions={
          <>
            {peutConfirmer && s.statut === "PREVU" ? (
              <ConfirmerArriveeForm dict={dict} locale={ctx.locale} sejourId={s.id} nbVoyageurs={s.nbVoyageurs} size="md" />
            ) : null}
            {peutConfirmer && s.statut === "EN_COURS" ? (
              <ConfirmerDepartForm dict={dict} locale={ctx.locale} sejourId={s.id} size="md" />
            ) : null}
            {s.statut === "EN_COURS" && vue !== "conseil" ? (
              <ButtonLink href={p(`/incidents/nouveau?sejour=${s.id}`)} variant="secondary">
                {l.signalerNuisance}
              </ButtonLink>
            ) : null}
            {peutModifier ? (
              <ButtonLink href={p(`/location-courte-duree/sejours/${s.id}/modifier`)} variant="secondary">
                {dict.common.modify}
              </ButtonLink>
            ) : null}
            {peutModifier ? (
              <AnnulerSejourModal dict={dict} locale={ctx.locale} sejourId={s.id} voyageurNom={s.voyageurPrincipalNom} />
            ) : null}
          </>
        }
      />

      {s.statut === "ANNULE" ? (
        <Banner variant="warn" className="mb-5" title={fill(l.annuleLe, { date: formatDateHeure(s.annuleLe, ctx.locale) })}>
          {s.motifAnnulation ?? ""}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title={l.voyageurPrincipal} />
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[12px] uppercase tracking-[0.06em] text-soft">{l.voyageurNom}</dt>
                <dd className="mt-1 font-medium text-ink">{s.voyageurPrincipalNom}</dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-[0.06em] text-soft">{l.nbVoyageurs}</dt>
                <dd className="tnum mt-1 text-body">{s.nbVoyageurs}</dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-[0.06em] text-soft">{l.voyageurTelephone}</dt>
                <dd className="mt-1 text-body">
                  {s.voyageurTelephone ? (
                    <a href={`tel:${s.voyageurTelephone}`} className="tnum text-action hover:underline" dir="ltr">
                      {formatTelephone(s.voyageurTelephone)}
                    </a>
                  ) : (
                    <span className="text-faint">{dict.common.none}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-[0.06em] text-soft">{l.voyageurNationalite}</dt>
                <dd className="mt-1 text-body" dir="ltr">
                  {s.voyageurNationalite ?? <span className="text-faint">{dict.common.none}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-[0.06em] text-soft">{l.pieceIdentite}</dt>
                <dd className="mt-1 text-body">
                  {s.pieceIdentiteType ? dict.enums.typePieceIdentite[s.pieceIdentiteType] : <span className="text-faint">{dict.common.none}</span>}
                  {s.pieceIdentiteFin ? (
                    <span className="ms-2 font-mono text-[13px] text-soft" dir="ltr">
                      ····{s.pieceIdentiteFin}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-[0.06em] text-soft">{l.plaqueVehicule}</dt>
                <dd className="mt-1 font-mono text-body" dir="ltr">
                  {s.plaqueVehicule ?? <span className="font-sans text-faint">{dict.common.none}</span>}
                </dd>
              </div>
            </dl>
          </Card>

          <PiecesJointesCard dict={dict} locale={ctx.locale} sejourId={s.id} pieces={pieces} peutJoindre={peutJoindre} peutRetirer={peutRetirer} />

          <Card>
            <SectionHeader title={l.journal} />
            {evenements.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{l.journalVide}</p>
            ) : (
              <ol className="mt-6 ms-2">
                {evenements.map((ev, idx) => {
                  const dernier = idx === evenements.length - 1;
                  const tone = TONE_EVENEMENT[ev.type];
                  const constate =
                    ev.detailsJson && typeof ev.detailsJson.nb_voyageurs_constate === "number"
                      ? (ev.detailsJson.nb_voyageurs_constate as number)
                      : null;
                  const motif =
                    ev.detailsJson && typeof ev.detailsJson.motif === "string" ? (ev.detailsJson.motif as string) : null;
                  return (
                    <li key={ev.id} className={`relative ps-7 ${dernier ? "pb-0" : "border-s border-hairline pb-7"}`}>
                      <span className={`absolute -start-[9px] top-0 flex size-[18px] items-center justify-center rounded-full ${tone.fond}`}>
                        <span className={`size-2 rounded-full ${tone.point}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{dict.enums.typeEvenementSejour[ev.type]}</p>
                        {constate !== null ? (
                          <p className="mt-0.5 text-[13px] text-body">
                            {l.nbVoyageursConstate} : <span className="tnum">{constate}</span>
                          </p>
                        ) : null}
                        {motif ? <p className="mt-0.5 text-[13px] text-body">{motif}</p> : null}
                        <p className="mt-1 text-[12px] text-faint">
                          {nom(ev.acteurId) ? `${nom(ev.acteurId)} · ` : ""}
                          {formatDateHeure(ev.horodatage, ctx.locale)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title={l.sejour} />
            <div className="mt-3 flex items-start gap-3">
              <IconCircle tone={s.statut === "EN_COURS" ? "ok" : "tosca"} size={40}>
                <CCalendar width={20} height={20} />
              </IconCircle>
              <div className="min-w-0 text-sm">
                <p className="tnum font-medium text-ink">
                  {formatDate(s.dateArrivee, ctx.locale)}
                  {s.heureArriveePrevue ? ` · ${s.heureArriveePrevue}` : ""}
                </p>
                <p className="tnum mt-0.5 text-body">→ {formatDate(s.dateDepart, ctx.locale)}</p>
                <p className="mt-1.5 text-[13px] text-soft">
                  {s.gardienInformeLe
                    ? fill(l.gardienInforme, { date: formatDateHeure(s.gardienInformeLe, ctx.locale) })
                    : l.gardienNonInforme}
                </p>
              </div>
            </div>
          </Card>
          {declaration ? (
            <Card>
              <SectionHeader title={l.declaration} />
              <div className="mt-3 flex items-start gap-3">
                <IconCircle tone="sage" size={40}>
                  <CUsers width={20} height={20} />
                </IconCircle>
                <div className="min-w-0 text-sm">
                  <Link href={p(`/location-courte-duree/declarations/${declaration.id}`)} className="font-medium text-ink hover:text-action">
                    {l.lot} {declaration.lot?.numero ?? s.lot?.numero ?? "—"}
                  </Link>
                  {declaration.contactUrgenceNom ? (
                    <p className="mt-0.5 text-[13px] text-body">
                      {l.contactUrgence} : {declaration.contactUrgenceNom}
                      {declaration.contactUrgenceTelephone ? (
                        <a href={`tel:${declaration.contactUrgenceTelephone}`} className="tnum ms-1 text-action hover:underline" dir="ltr">
                          {formatTelephone(declaration.contactUrgenceTelephone)}
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}
          {incidentsRes ? (
            <Card>
              <SectionHeader title={l.incidentsLies} />
              {incidents.length === 0 ? (
                <p className="mt-3 text-sm text-soft">{dict.common.none}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {incidents.map((inc) => (
                    <li key={inc.id} className="flex items-center gap-3">
                      <IconCircle tone="tosca" size={32}>
                        <CWrench width={16} height={16} />
                      </IconCircle>
                      <Link href={p(`/incidents/${inc.id}`)} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-action">
                        {inc.sousCategorie}
                      </Link>
                      <Badge variant={incidentVariant[inc.statut]}>{dict.enums.statutIncident[inc.statut]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
