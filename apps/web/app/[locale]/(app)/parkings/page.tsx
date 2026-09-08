/** Parkings & badges (M23) — plan par niveau, emplacements (filtres + export), véhicules, badges, places visiteurs ; résidents : leurs lots (RLS). */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { AttributionEmplacement, BadgeAcces, Emplacement, Lot, PlanEmplacements, StatutBadge, StatutEmplacement, TypeBadge, TypeEmplacement, Vehicule, VisiteursAujourdhui } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMontant } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../components/ui/link-tabs";
import { StatCard } from "../../../../components/ui/stat-card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { CBuilding, CDoor, CKey, CAlert } from "../../../../components/ui/color-icons";
import { ExportButtons } from "../../../../components/ui/export-buttons";
import { badgeAccesVariant, emplacementVariant } from "../../../../lib/status";
import { BadgeDesactiverModal, BadgeModal, BadgePerduModal, BadgeRestituerModal, EmplacementModal, RechercheVehiculeForm, RetirerVehiculeModal, VehiculeModal, type LotOption } from "./parkings-client";

type Onglet = "plan" | "emplacements" | "vehicules" | "badges" | "visiteurs";
const TYPES: TypeEmplacement[] = ["PARKING_COMMUN", "PARKING_VISITEUR", "PARKING_PMR", "MOTO", "VELO", "CAVE_COMMUNE"];
const STATUTS: StatutEmplacement[] = ["DISPONIBLE", "ATTRIBUE", "HORS_SERVICE"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").parkings.titre };
}

export default async function ParkingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ onglet?: string; type?: string; statut?: string; niveau?: string; supprime?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN", "PROPRIETAIRE", "LOCATAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT", "GESTIONNAIRE_LCD"]);
  const { dict } = ctx;
  const t = dict.parkings;
  const e = dict.enumsParkings;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const gardien = ctx.roles.includes("GARDIEN");
  const conseil = ctx.roles.includes("CONSEIL_SYNDICAL");
  const resident = !gestion && !gardien && !conseil;
  const p = (path: string) => `/${locale}${path}`;
  const onglets: Onglet[] = resident ? ["plan", "vehicules", "badges"] : gardien ? ["plan", "visiteurs", "vehicules", "badges", "emplacements"] : ["plan", "emplacements", "vehicules", "badges", "visiteurs"];
  const onglet: Onglet = onglets.includes(sp.onglet as Onglet) ? (sp.onglet as Onglet) : "plan";
  const type = TYPES.includes(sp.type as TypeEmplacement) ? (sp.type as TypeEmplacement) : undefined;
  const statut = STATUTS.includes(sp.statut as StatutEmplacement) ? (sp.statut as StatutEmplacement) : undefined;
  const href = (o: Onglet, q: Record<string, string | undefined> = {}) => { const u = new URLSearchParams({ onglet: o }); for (const [k, v] of Object.entries(q)) if (v) u.set(k, v); return `${p("/parkings")}?${u.toString()}`; };

  const [planRes, lotsRes, attribRes] = await Promise.all([
    apiFetch<PlanEmplacements>("/emplacements/plan"),
    gestion || resident ? apiFetch<Lot[]>("/lots", { searchParams: { limit: 200 } }) : Promise.resolve(null),
    resident ? apiFetch<AttributionEmplacement[]>("/emplacements/attributions") : Promise.resolve(null),
  ]);
  const plan = planRes.ok ? planRes.data : { niveaux: [], totaux: { total: 0, attribues: 0, disponibles: 0, hors_service: 0, visiteurs: 0, visiteurs_occupees: 0 } };
  const lotsTous = lotsRes?.ok ? lotsRes.data : [];
  // Résident : ses lots (propriétaire actif ou occupant en cours) ; syndic : tous.
  const mesLots: LotOption[] = (resident ? lotsTous.filter((l) => [...(l.proprietaires ?? []), ...(l.occupants ?? [])].some((r) => !r.dateFin && r.utilisateurId === ctx.profil.id)) : lotsTous).map((l) => ({ id: l.id, numero: l.numero }));
  const mesAttributions = attribRes?.ok ? attribRes.data : [];

  const [empRes, vehRes, badgesRes, visRes] = await Promise.all([
    onglet === "emplacements" ? apiFetch<Emplacement[]>("/emplacements", { searchParams: { limit: 500, type, statut, niveau: sp.niveau || undefined } }) : Promise.resolve(null),
    onglet === "vehicules" ? apiFetch<Vehicule[]>("/vehicules") : Promise.resolve(null),
    onglet === "badges" ? apiFetch<BadgeAcces[]>("/badges") : Promise.resolve(null),
    onglet === "visiteurs" && !resident ? apiFetch<VisiteursAujourdhui>("/parkings/visiteurs/aujourdhui") : Promise.resolve(null),
  ]);
  const emplacements = empRes?.ok ? empRes.data : [];
  const parStatut = (empRes?.ok ? (empRes.meta as { par_statut?: Partial<Record<StatutEmplacement, number>> }).par_statut : undefined) ?? {};
  const vehicules = vehRes?.ok ? vehRes.data : [];
  const badges = badgesRes?.ok ? badgesRes.data : [];
  const visiteurs = visRes?.ok ? visRes.data : null;
  const erreur = !planRes.ok || (empRes && !empRes.ok) || (vehRes && !vehRes.ok) || (badgesRes && !badgesRes.ok) || (visRes && !visRes.ok);

  const CaseEmplacement = ({ x }: { x: Emplacement }) => {
    const occupee = x.statut === "ATTRIBUE" || Boolean(x.visiteurOccupee);
    const tone = x.statut === "HORS_SERVICE" ? "border-hairline bg-muted text-faint" : occupee ? "border-info/40 bg-info/10 text-ink-strong" : x.type === "PARKING_VISITEUR" ? "border-ok/40 bg-ok/10 text-ink-strong" : "border-ok/30 bg-surface text-ink-strong";
    const corps = (
      <div className={`flex h-full min-h-[84px] flex-col justify-between rounded-field border p-2.5 transition-colors ${tone} ${resident ? "" : "hover:bg-hover"}`}>
        <div className="flex items-start justify-between gap-1"><span className="font-mono text-[14px] font-semibold" dir="ltr">{x.code}</span><span className="text-[10px] uppercase tracking-wide text-faint">{e.typeEmplacement[x.type]}</span></div>
        <div className="text-[12px]">
          {x.statut === "HORS_SERVICE" ? e.statutEmplacement.HORS_SERVICE : x.attributionCourante ? `${t.lot} ${x.attributionCourante.lotNumero ?? "—"}` : x.statut === "ATTRIBUE" ? e.statutEmplacement.ATTRIBUE : x.type === "PARKING_VISITEUR" ? (x.visiteurOccupee ? t.visiteurOccupee : t.visiteurLibre) : x.type === "PARKING_PMR" || !x.attribuable ? t.nonAttribuable : e.statutEmplacement.DISPONIBLE}
        </div>
      </div>
    );
    return resident ? <div key={x.id}>{corps}</div> : <Link key={x.id} href={p(`/parkings/${x.id}`)} className="block">{corps}</Link>;
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={t.titre}
        subtitle={resident ? t.subtitleResident : gardien ? t.subtitleGardien : t.subtitle}
        actions={<div className="flex flex-wrap gap-2">
          {gestion && onglet === "emplacements" ? <ExportButtons ressource="emplacements" filtres={{ type, statut, niveau: sp.niveau || undefined }} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx }} size="sm" /> : null}
          {gestion && (onglet === "plan" || onglet === "emplacements") ? <EmplacementModal dict={dict} locale={ctx.locale} grand /> : null}
          {(gestion || resident) && onglet === "vehicules" && mesLots.length ? <VehiculeModal dict={dict} locale={ctx.locale} lots={mesLots} grand /> : null}
          {gestion && onglet === "badges" ? <BadgeModal dict={dict} locale={ctx.locale} lots={mesLots} grand /> : null}
        </div>}
      />
      {sp.supprime === "1" ? <Banner variant="ok" className="mb-4">{t.emplacementSupprime}</Banner> : null}
      {erreur ? <Banner variant="danger" className="mb-4">{t.chargementImpossible}</Banner> : null}
      <LinkTabs className="mb-5" tabs={onglets.map((o) => ({ href: href(o), label: t.onglets[o], active: o === onglet }))} />

      {onglet === "plan" ? (
        <div className="space-y-5">
          {!resident ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard icon={<CBuilding />} tone="sage" label={t.total} value={String(plan.totaux.total)} />
              <StatCard icon={<CKey />} tone="tosca" label={t.attribues} value={String(plan.totaux.attribues)} hint={`${plan.totaux.disponibles} ${t.disponibles.toLowerCase()}`} />
              <StatCard icon={<CDoor />} tone={plan.totaux.visiteurs_occupees >= plan.totaux.visiteurs && plan.totaux.visiteurs > 0 ? "warn" : "sand"} label={t.visiteurs} value={`${plan.totaux.visiteurs_occupees}/${plan.totaux.visiteurs}`} hint={t.visiteursOccupees} />
              <StatCard icon={<CAlert />} tone={plan.totaux.hors_service > 0 ? "warn" : "sage"} label={t.horsService} value={String(plan.totaux.hors_service)} />
            </div>
          ) : null}
          {resident ? (
            <Card>
              <SectionHeader title={t.onglets.mesAttributions} />
              {mesAttributions.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunEmplacementResident}</p> : (
                <ul className="mt-3 divide-y divide-hairline">
                  {mesAttributions.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="font-mono text-[15px] font-semibold text-ink-strong" dir="ltr">{a.emplacement?.code ?? "—"}</span>
                      <span className="text-[13px] text-body">{a.emplacement ? e.typeEmplacement[a.emplacement.type] : ""}{a.emplacement?.niveau ? ` · ${t.niveau} ${a.emplacement.niveau}` : ""} · {t.lot} {a.lotNumero ?? "—"}</span>
                      <Badge variant={a.active ? "ok" : a.dateFin && a.dateFin < new Date().toISOString().slice(0, 10) ? "neutral" : "outline"}>{a.active ? t.active : a.dateFin && a.dateFin < new Date().toISOString().slice(0, 10) ? t.terminee : t.aVenir}</Badge>
                      <span className="ms-auto text-[12px] text-soft tnum">{formatDate(a.dateDebut, ctx.locale)} → {a.dateFin ? formatDate(a.dateFin, ctx.locale) : t.sansFin}{a.redevanceMensuelle ? ` · ${formatMontant(a.redevanceMensuelle)} MAD` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
          {plan.niveaux.length === 0 ? <EmptyState title={t.aucunEmplacement} hint={gestion ? t.aucunEmplacementAide : undefined} /> : plan.niveaux.map((n) => (
            <Card key={n.niveau}>
              <SectionHeader title={n.niveau === "—" ? t.sansNiveau : `${t.niveau} ${n.niveau}`} subtitle={`${n.emplacements.length} · ${n.emplacements.filter((x) => x.statut === "ATTRIBUE" || x.visiteurOccupee).length} ${t.attribues.toLowerCase()}`} />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{n.emplacements.map((x) => <CaseEmplacement key={x.id} x={x} />)}</div>
            </Card>
          ))}
        </div>
      ) : null}

      {onglet === "emplacements" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href("emplacements")} className={`rounded-full border px-3 py-1 text-[12.5px] ${!type && !statut ? "border-ink bg-ink text-white" : "border-hairline text-body hover:bg-hover"}`}>{dict.common.all}</Link>
            {TYPES.map((x) => <Link key={x} href={href("emplacements", { type: x, statut })} className={`rounded-full border px-3 py-1 text-[12.5px] ${type === x ? "border-ink bg-ink text-white" : "border-hairline text-body hover:bg-hover"}`}>{e.typeEmplacement[x]}</Link>)}
            {STATUTS.map((x) => <Link key={x} href={href("emplacements", { type, statut: x })} className={`rounded-full border px-3 py-1 text-[12.5px] ${statut === x ? "border-ink bg-ink text-white" : "border-hairline text-body hover:bg-hover"}`}>{e.statutEmplacement[x]} · {parStatut[x] ?? 0}</Link>)}
          </div>
          {emplacements.length === 0 ? <EmptyState title={t.aucunEmplacement} hint={gestion ? t.aucunEmplacementAide : undefined} /> : (
            <TableCard><Table>
              <THead><TH>{t.code}</TH><TH>{t.type}</TH><TH>{t.niveau}</TH><TH>{t.statut}</TH><TH>{t.lotBeneficiaire}</TH><TH>{t.periode}</TH><TH align="end">{t.redevance}</TH></THead>
              <tbody>{emplacements.map((x) => (
                <TR key={x.id}>
                  <TD><Link href={p(`/parkings/${x.id}`)} className="font-mono font-semibold text-action hover:underline" dir="ltr">{x.code}</Link></TD>
                  <TD className="text-body">{e.typeEmplacement[x.type]}{!x.attribuable ? <span className="ms-1 text-[11px] text-faint">· {t.nonAttribuable}</span> : null}</TD>
                  <TD className="text-body">{x.niveau ?? "—"}</TD>
                  <TD><Badge variant={emplacementVariant[x.statut]}>{e.statutEmplacement[x.statut]}</Badge></TD>
                  <TD className="text-body">{x.attributionCourante ? `${x.attributionCourante.lotNumero ?? "—"} · ${e.typeAttribution[x.attributionCourante.type]}` : "—"}</TD>
                  <TD className="text-body tnum">{x.attributionCourante ? `${formatDate(x.attributionCourante.dateDebut, ctx.locale)} → ${x.attributionCourante.dateFin ? formatDate(x.attributionCourante.dateFin, ctx.locale) : t.sansFin}` : "—"}</TD>
                  <TD align="end" className="tnum">{x.attributionCourante?.redevanceMensuelle ? `${formatMontant(x.attributionCourante.redevanceMensuelle)} MAD` : "—"}</TD>
                </TR>
              ))}</tbody>
            </Table></TableCard>
          )}
        </div>
      ) : null}

      {onglet === "vehicules" ? (
        <div className="space-y-4">
          {gestion || gardien ? <Card><RechercheVehiculeForm dict={dict} /></Card> : null}
          {vehicules.length === 0 ? <EmptyState title={t.aucunVehicule} hint={t.aucunVehiculeAide} /> : (
            <TableCard><Table>
              <THead><TH>{t.immatriculation}</TH><TH>{t.lot}</TH><TH>{t.typeVehicule}</TH><TH>{t.marque}</TH><TH>{t.couleur}</TH><TH>{t.statut}</TH>{gestion || resident ? <TH align="end">{dict.common.actions}</TH> : null}</THead>
              <tbody>{vehicules.map((v) => (
                <TR key={v.id}>
                  <TD className="font-mono font-semibold text-ink-strong"><span dir="ltr">{v.immatriculation}</span></TD>
                  <TD className="text-body">{v.lotNumero ?? "—"}</TD>
                  <TD className="text-body">{e.typeVehicule[v.type]}</TD>
                  <TD className="text-body">{v.marque ?? "—"}</TD>
                  <TD className="text-body">{v.couleur ?? "—"}</TD>
                  <TD><Badge variant={v.actif ? "ok" : "neutral"}>{v.actif ? t.actif : t.inactif}</Badge>{v.utilisateurId ? <span className="ms-1.5 text-[11px] text-faint">{t.declarePar}</span> : null}</TD>
                  {gestion || resident ? <TD align="end"><span className="inline-flex gap-1"><VehiculeModal dict={dict} locale={ctx.locale} lots={mesLots} vehicule={v} />{v.actif ? <RetirerVehiculeModal dict={dict} locale={ctx.locale} vehicule={v} /> : null}</span></TD> : null}
                </TR>
              ))}</tbody>
            </Table></TableCard>
          )}
        </div>
      ) : null}

      {onglet === "badges" ? (
        badges.length === 0 ? <EmptyState title={t.aucunBadge} hint={gestion ? t.aucunBadgeAide : undefined} /> : (
          <TableCard><Table>
            <THead><TH>{t.identifiant}</TH><TH>{t.type}</TH><TH>{t.lot}</TH><TH>{t.statut}</TH><TH>{t.remisLe}</TH><TH align="end">{t.caution}</TH><TH align="end">{dict.common.actions}</TH></THead>
            <tbody>{badges.map((b) => (
              <TR key={b.id}>
                <TD className="font-mono font-semibold text-ink-strong"><span dir="ltr">{b.identifiant}</span></TD>
                <TD className="text-body">{e.typeBadge[b.type as TypeBadge]}</TD>
                <TD className="text-body">{b.lotNumero ?? "—"}</TD>
                <TD><Badge variant={badgeAccesVariant[b.statut as StatutBadge]}>{e.statutBadge[b.statut as StatutBadge]}</Badge>{b.restitueLe ? <span className="ms-1.5 text-[11px] text-faint tnum">{formatDate(b.restitueLe, ctx.locale)}</span> : null}</TD>
                <TD className="text-body tnum">{formatDate(b.remisLe, ctx.locale)}</TD>
                <TD align="end" className="tnum">{b.cautionMontant ? `${formatMontant(b.cautionMontant)} MAD` : "—"}</TD>
                <TD align="end"><span className="inline-flex flex-wrap justify-end gap-1">
                  {gestion ? <BadgeModal dict={dict} locale={ctx.locale} lots={mesLots} badge={b} /> : null}
                  {b.statut === "ACTIF" && (gestion || resident) ? <BadgePerduModal dict={dict} locale={ctx.locale} badge={b} /> : null}
                  {gestion && b.statut !== "RESTITUE" ? <BadgeRestituerModal dict={dict} locale={ctx.locale} badge={b} /> : null}
                  {gestion && (b.statut === "ACTIF" || b.statut === "PERDU") ? <BadgeDesactiverModal dict={dict} locale={ctx.locale} badge={b} /> : null}
                </span></TD>
              </TR>
            ))}</tbody>
          </Table></TableCard>
        )
      ) : null}

      {onglet === "visiteurs" && visiteurs ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <SectionHeader title={t.visiteursJour} subtitle={t.visiteursJourAide} />
              {visiteurs.visites.length === 0 && visiteurs.sejours.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunVisiteur}</p> : (
                <ul className="mt-3 divide-y divide-hairline">
                  {visiteurs.visites.map((v) => (
                    <li key={v.visite_id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="font-mono text-[15px] font-semibold text-ink-strong" dir="ltr">{v.emplacement?.code ?? "—"}</span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{v.visiteur_nom} · {t.lot} {v.lot ?? "—"}</p><p className="text-[12px] text-soft tnum" dir="ltr">{v.immatriculation ?? "—"} · {formatDateHeure(v.horodatage, ctx.locale)}</p></div>
                      {v.heure_limite ? <Badge variant={v.depassee ? "danger" : "outline"}>{t.heureLimite} {new Date(v.heure_limite).toLocaleTimeString(ctx.locale === "ar" ? "ar-MA" : "fr-MA", { hour: "2-digit", minute: "2-digit" })}{v.depassee ? ` · ${t.depassee}` : ""}</Badge> : null}
                    </li>
                  ))}
                  {visiteurs.sejours.map((s) => (
                    <li key={s.sejour_id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="font-mono text-[15px] font-semibold text-ink-strong" dir="ltr">{s.emplacement?.code ?? "—"}</span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{s.voyageur} · {t.lot} {s.lot ?? "—"}</p><p className="text-[12px] text-soft tnum" dir="ltr">{s.immatriculation ?? "—"} · {t.depart} {formatDate(s.date_depart, ctx.locale)}</p></div>
                      <Badge variant="info">{t.sejourLcd}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card>
            <SectionHeader title={t.placesLibres} />
            {visiteurs.places_libres.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunePlace}</p> : <div className="mt-3 flex flex-wrap gap-2">{visiteurs.places_libres.map((x) => <span key={x.id} className="rounded-field border border-ok/40 bg-ok/10 px-2.5 py-1 font-mono text-[13px] font-semibold text-ink-strong" dir="ltr">{x.code}</span>)}</div>}
            <p className="mt-4 text-[12px] text-soft"><Link href={p("/visites")} className="text-action hover:underline">{dict.nav.visites}</Link></p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
