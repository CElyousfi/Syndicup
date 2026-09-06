/** Dossier RH d'un employé (M20) — onglets fiche / paie / congés / présences / évaluations selon le rôle. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Conge, EvaluationPersonnel, FichePaie, Lot, PersonnelDetail, PresencePersonnel, StatutPresence } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMAD, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { LinkTabs } from "../../../../../components/ui/link-tabs";
import { Table, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Avatar } from "../../../../../components/ui/avatar";
import { DocumentViewerButton, FileViewerButton } from "../../../../../components/documents/document-viewer";
import { congeVariant, depenseVariant, fichePaieVariant, personnelVariant, presenceVariant } from "../../../../../lib/status";
import { DossierModal, CnssButton, PreparerFicheModal, ValiderFicheModal, PayerFicheModal, DemanderCongeModal, DeciderCongeButtons, AnnulerCongeBouton, PresencesForm, PointerBouton, EvaluerModal } from "../rh-modals";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").personnel.dossier };
}

type Onglet = "fiche" | "paie" | "conges" | "presences" | "evaluations";
const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;

function moisIso(d: Date) { return d.toISOString().slice(0, 7); }
function decalerMois(periode: string, delta: number) { const a = Number(periode.slice(0, 4)); const m = Number(periode.slice(5, 7)); return moisIso(new Date(Date.UTC(a, m - 1 + delta, 1))); }
function joursDuMois(periode: string) {
  const a = Number(periode.slice(0, 4));
  const m = Number(periode.slice(5, 7));
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${periode}-${String(i + 1).padStart(2, "0")}`);
}

export default async function DossierPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ onglet?: string; mois?: string }> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"]);
  const { dict } = ctx;
  const pe = dict.personnel;
  const en = dict.enumsPersonnelRh;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const conseil = !gestion && ctx.roles.includes("CONSEIL_SYNDICAL" as never);
  const res = await apiFetch<PersonnelDetail>(`/personnel/${id}`);
  if (!res.ok) {
    if (res.status === 404) notFound();
    return <div className="space-y-4"><BackLink href={`/${locale}/personnel`} label={dict.common.back} /><Banner variant="danger">{pe.interdit}</Banner></div>;
  }
  const x = res.data;
  const soi = x.utilisateurId === ctx.profil.id;
  const complet = gestion || soi;
  const p = (path: string) => `/${locale}${path}`;
  const nom = (x.utilisateur ? nomComplet(x.utilisateur) : null) ?? "—";
  const tel = x.utilisateur?.telephone ?? "";
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const onglets: Onglet[] = complet ? ["fiche", "paie", "conges", "presences", ...(gestion ? (["evaluations"] as Onglet[]) : [])] : ["fiche", "presences", "evaluations"];
  const onglet: Onglet = onglets.includes(sp.onglet as Onglet) ? (sp.onglet as Onglet) : onglets[0]!;
  const mois = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mois ?? "") ? sp.mois! : moisIso(new Date());
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const joursFin = x.dateFinContrat ? Math.ceil((new Date(x.dateFinContrat).getTime() - Date.now()) / 86_400_000) : null;

  const [fichesRes, congesRes, presencesRes, evalsRes, lotsRes, collegues] = await Promise.all([
    onglet === "paie" ? apiFetch<FichePaie[]>(`/personnel/${id}/fiches-paie`) : null,
    onglet === "conges" ? apiFetch<Conge[]>(`/personnel/${id}/conges`) : null,
    onglet === "presences" ? apiFetch<PresencePersonnel[]>(`/personnel/${id}/presences`, { searchParams: { from: `${mois}-01`, to: joursDuMois(mois).at(-1)! } }) : null,
    onglet === "evaluations" ? apiFetch<{ evaluations: EvaluationPersonnel[]; moyenne: number | null }>(`/personnel/${id}/evaluations`) : null,
    gestion && onglet === "fiche" ? apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }) : null,
    gestion && onglet === "conges" ? apiFetch<PersonnelDetail[]>("/personnel") : null,
  ]);
  const erreur = [fichesRes, congesRes, presencesRes, evalsRes].some((r) => r && !r.ok);
  const loges = lotsRes?.ok ? lotsRes.data.filter((l) => l.typeLot === "LOGE_GARDIEN").map((l) => ({ id: l.id, numero: l.numero })) : [];
  const remplacants = collegues?.ok ? collegues.data.filter((c) => c.id !== id && (c.statut === "PRESENT" || c.statut === "REMPLACE")).map((c) => ({ id: c.id, nom: (c.utilisateur ? nomComplet(c.utilisateur) : null) ?? c.id.slice(0, 8) })) : [];
  const tabHref = (o: Onglet) => p(`/personnel/${id}?onglet=${o}`);

  return (
    <div className="space-y-5">
      <BackLink href={p("/personnel")} label={dict.nav.personnel} />
      <PageHeader
        title={soi && !gestion ? pe.monDossier : nom}
        subtitle={`${en.poste[x.poste]}${x.typeContrat ? ` · ${en.typeContratTravail[x.typeContrat]}` : ""}${x.dateEmbauche ? ` · ${pe.dateEmbauche} ${formatDate(x.dateEmbauche, ctx.locale)}` : ""}`}
        actions={<div className="flex flex-wrap gap-2"><Badge variant={personnelVariant[x.statut]}>{dict.enums.statutPersonnel[x.statut]}</Badge>{gestion ? <DossierModal dict={dict} locale={ctx.locale} personnel={x} loges={loges} /> : null}</div>}
      />
      {joursFin !== null && joursFin >= 0 && joursFin <= 30 && complet ? <Banner variant="warn">{fill(pe.finContratProche, { n: joursFin })}</Banner> : null}
      {x.statut === "ABSENT" && gestion ? <Banner variant="warn">{pe.absentAlerte}</Banner> : null}
      {erreur ? <Banner variant="danger">{pe.chargementImpossible}</Banner> : null}
      <LinkTabs tabs={onglets.map((o) => ({ href: tabHref(o), label: pe.onglets[o], active: onglet === o }))} />

      {onglet === "fiche" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionHeader title={pe.dossier} />
            <div className="flex items-center gap-3">
              <Avatar nom={nom} size={44} />
              <div><p className="text-[15px] font-medium text-ink-strong">{nom}</p><p className="text-[13px] text-soft" dir="ltr">{tel}</p></div>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2">
              <Kv k={pe.poste} v={en.poste[x.poste]} />
              <Kv k={pe.logement} v={x.logementLot?.numero ?? pe.aucuneLoge} />
              {complet ? <>
                <Kv k={pe.typeContrat} v={x.typeContrat ? en.typeContratTravail[x.typeContrat] : "—"} />
                <Kv k={pe.dateEmbauche} v={x.dateEmbauche ? formatDate(x.dateEmbauche, ctx.locale) : "—"} />
                <Kv k={pe.dateFinContrat} v={x.dateFinContrat ? formatDate(x.dateFinContrat, ctx.locale) : "—"} />
                <Kv k={pe.salaireBrut} v={x.salaireBrutMensuel ? formatMAD(x.salaireBrutMensuel, ctx.locale) : "—"} />
                <div><dt className="text-soft">{pe.cnss}</dt><dd className="mt-0.5 flex flex-wrap items-center gap-2 text-ink-strong"><span className="tnum" dir="ltr">{x.numeroCnssMasque ?? pe.cnssNonRenseigne}</span>{x.cnssRenseigne ? <CnssButton dict={dict} personnelId={x.id} /> : null}</dd><dd className="text-[12px] text-faint">{pe.cnssAide}</dd></div>
                <Kv k={pe.contactUrgence} v={x.contactUrgence ?? "—"} />
              </> : null}
            </dl>
            {complet && x.notes ? <p className="mt-4 whitespace-pre-line rounded-field bg-surface-2 px-3 py-2 text-[13px] text-body">{x.notes}</p> : null}
          </Card>
          <div className="space-y-4">
            <Card>
              <SectionHeader title={pe.horaires} />
              <table className="w-full text-[13px]"><tbody>
                {JOURS.map((j) => { const plages = x.horairesJson?.[j] ?? []; return <tr key={j} className="border-t border-hairline first:border-0"><td className="py-1.5 text-soft">{en.jour[j]}</td><td className="py-1.5 text-end tnum text-ink-strong" dir="ltr">{plages.length ? plages.map((pl) => `${pl.debut}–${pl.fin}`).join(" · ") : <span className="text-faint">{pe.aucunePlage}</span>}</td></tr>; })}
              </tbody></table>
            </Card>
            {complet ? (
              <Card>
                <SectionHeader title={dict.nav.documents} />
                {x.documentContrat ? <div className="flex items-center justify-between gap-2 text-[13px]"><span className="truncate text-ink-strong">{pe.contratTravail}</span>{gestion ? <DocumentViewerButton documentId={x.documentContrat.id} nom={x.documentContrat.nom} labels={viewer} /> : null}</div> : null}
                {x.documents.filter((d) => d.document_id !== x.documentContrat?.id).map((d) => <div key={d.document_id} className="mt-2 flex items-center justify-between gap-2 text-[13px]"><span className="truncate text-ink-strong">{d.nom}</span><FileViewerButton src={p(`/api/document-inline?id=${d.document_id}`)} nom={d.nom} labels={viewer} /></div>)}
                {!x.documentContrat && !x.documents.length ? <p className="text-[13px] text-soft">{dict.common.none}</p> : null}
              </Card>
            ) : null}
            {complet && x.solde_conges ? (
              <Card>
                <SectionHeader title={pe.soldeConges} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat k={pe.acquis} v={x.solde_conges.acquis ?? "—"} /><Stat k={pe.pris} v={x.solde_conges.pris} /><Stat k={pe.solde} v={x.solde_conges.solde ?? "—"} />
                </div>
                {x.solde_conges.parametres_non_configures ? <p className="mt-2 text-[12px] text-warn">{pe.soldeNonConfigure}</p> : null}
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {onglet === "paie" && fichesRes?.ok ? (
        <Card>
          <SectionHeader title={pe.fichesPaie} action={gestion ? <PreparerFicheModal dict={dict} locale={ctx.locale} personnel={x} periodeDefaut={mois} /> : undefined} />
          {gestion && x.paie && !x.paie.parametres_configures ? <Banner variant="warn" className="mb-3"><span className="font-medium">{pe.paieNonConfiguree}.</span> {pe.paieNonConfigureeCorps} <a href={p("/parametres#paie")} className="underline">{dict.nav.parametres}</a></Banner> : null}
          {fichesRes.data.length === 0 ? <EmptyState title={pe.aucuneFichePaie} /> : (
            <Table>
              <THead><TH>{pe.periode}</TH><TH align="end">{pe.brut}</TH><TH align="end">{pe.cotisationsSalariales}</TH><TH align="end">{pe.net}</TH>{gestion ? <TH align="end">{pe.coutEmployeur}</TH> : null}<TH>{dict.incidents.statut}</TH><TH></TH></THead>
              <tbody>
                {fichesRes.data.map((f) => (
                  <TR key={f.id}>
                    <TD className="tnum font-medium text-ink-strong"><span dir="ltr">{f.periode}</span></TD>
                    <TD className="text-end tnum">{formatMAD(f.brut, ctx.locale)}</TD>
                    <TD className="text-end tnum">{formatMAD(f.cotisationsSalarialesJson.total ?? "0", ctx.locale)}</TD>
                    <TD className="text-end tnum font-medium text-ink-strong">{formatMAD(f.net, ctx.locale)}</TD>
                    {gestion ? <TD className="text-end tnum">{formatMAD(f.coutTotalEmployeur, ctx.locale)}</TD> : null}
                    <TD><div className="flex flex-wrap items-center gap-1"><Badge variant={fichePaieVariant[f.statut]}>{en.statutFichePaie[f.statut]}</Badge>{f.depense ? <a href={p(`/finances/depenses/${f.depense.id}`)}><Badge variant={depenseVariant[f.depense.statut]}>{dict.enumsDepenses.statutDepense[f.depense.statut]}</Badge></a> : null}</div></TD>
                    <TD className="text-end"><div className="flex flex-wrap justify-end gap-1.5">
                      {f.statut !== "BROUILLON" || gestion ? <FileViewerButton src={p(`/api/fiche-paie-pdf?personnel=${x.id}&fiche=${f.id}&langue=${ctx.locale}`)} nom={`fiche-paie-${f.periode}.pdf`} labels={viewer} label={pe.pdfFiche} /> : null}
                      {gestion && f.statut === "BROUILLON" ? <ValiderFicheModal dict={dict} locale={ctx.locale} fiche={f} /> : null}
                      {gestion && f.statut === "VALIDEE" ? <PayerFicheModal dict={dict} locale={ctx.locale} fiche={f} /> : null}
                    </div></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          <p className="mt-3 text-[12px] text-faint">{pe.mentionPaie}</p>
        </Card>
      ) : null}

      {onglet === "conges" && congesRes?.ok ? (
        <Card>
          <SectionHeader title={pe.conges} action={(gestion || soi) && x.statut !== "PARTI" ? <DemanderCongeModal dict={dict} locale={ctx.locale} personnelId={x.id} remplacants={remplacants} auNom={gestion} /> : undefined} />
          {x.solde_conges ? <p className="mb-3 text-[13px] text-soft">{pe.soldeConges} {x.solde_conges.annee} : {pe.acquis} <b className="tnum text-ink-strong">{x.solde_conges.acquis ?? "—"}</b> · {pe.pris} <b className="tnum text-ink-strong">{x.solde_conges.pris}</b> · {pe.solde} <b className="tnum text-ink-strong">{x.solde_conges.solde ?? "—"}</b></p> : null}
          {congesRes.data.length === 0 ? <EmptyState title={pe.aucunConge} /> : (
            <Table>
              <THead><TH>{pe.typeConge}</TH><TH>{pe.dateDebut}</TH><TH>{pe.dateFin}</TH><TH align="end">{pe.nbJours}</TH><TH>{pe.remplacant}</TH><TH>{dict.incidents.statut}</TH><TH></TH></THead>
              <tbody>
                {congesRes.data.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium text-ink-strong">{en.typeConge[c.type]}{c.motif ? <span className="block text-[12px] font-normal text-soft">{c.motif}</span> : null}{c.motifRefus ? <span className="block text-[12px] font-normal text-danger">{pe.motifRefus} : {c.motifRefus}</span> : null}</TD>
                    <TD className="tnum">{formatDate(c.dateDebut, ctx.locale)}</TD>
                    <TD className="tnum">{formatDate(c.dateFin, ctx.locale)}</TD>
                    <TD className="text-end tnum">{c.nbJours}</TD>
                    <TD>{c.remplacant?.nom ?? "—"}</TD>
                    <TD><div className="flex items-center gap-1"><Badge variant={congeVariant[c.statut]}>{en.statutConge[c.statut]}</Badge>{c.document && gestion ? <DocumentViewerButton documentId={c.document.id} nom={c.document.nom} labels={viewer} iconOnly /> : null}</div></TD>
                    <TD className="text-end">{c.statut === "DEMANDE" ? (gestion ? <DeciderCongeButtons dict={dict} locale={ctx.locale} conge={c} remplacants={remplacants} /> : soi ? <AnnulerCongeBouton dict={dict} locale={ctx.locale} congeId={c.id} /> : null) : null}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {onglet === "presences" && presencesRes?.ok ? (() => {
        const existantes: Record<string, StatutPresence> = Object.fromEntries(presencesRes.data.map((r) => [r.date.slice(0, 10), r.statut]));
        const jours = joursDuMois(mois);
        const compte = (s: StatutPresence) => presencesRes.data.filter((r) => r.statut === s).length;
        return (
          <div className="space-y-4">
            {soi && x.statut !== "PARTI" ? <PointerBouton dict={dict} locale={ctx.locale} personnelId={x.id} dejaPointe={Boolean(existantes[aujourdhui])} /> : null}
            <Card>
              <SectionHeader title={`${pe.presences} · ${mois}`} action={<div className="flex gap-1.5"><ButtonLink href={p(`/personnel/${id}?onglet=presences&mois=${decalerMois(mois, -1)}`)} variant="secondary" size="sm">{pe.moisPrecedent}</ButtonLink><ButtonLink href={p(`/personnel/${id}?onglet=presences&mois=${decalerMois(mois, 1)}`)} variant="secondary" size="sm">{pe.moisSuivant}</ButtonLink></div>} />
              <div className="mb-3 flex flex-wrap gap-2 text-[12.5px]">
                {(["PRESENT", "ABSENT", "CONGE", "MALADIE"] as StatutPresence[]).map((s) => <Badge key={s} variant={presenceVariant[s]}>{en.statutPresence[s]} · {compte(s)}</Badge>)}
              </div>
              {gestion ? <PresencesForm dict={dict} locale={ctx.locale} personnelId={x.id} jours={jours} existantes={existantes} /> : (
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {jours.map((j) => <div key={j} className="flex items-center justify-between rounded-field border border-hairline px-2.5 py-1.5 text-[13px]"><span className="tnum text-body">{formatDate(j, ctx.locale)}</span>{existantes[j] ? <Badge variant={presenceVariant[existantes[j]]}>{en.statutPresence[existantes[j]]}</Badge> : <span className="text-faint">—</span>}</div>)}
                </div>
              )}
            </Card>
          </div>
        );
      })() : null}

      {onglet === "evaluations" && evalsRes?.ok ? (
        <Card>
          <SectionHeader title={pe.evaluations} action={(gestion || conseil) && x.statut !== "PARTI" ? <EvaluerModal dict={dict} locale={ctx.locale} personnelId={x.id} periodeDefaut={mois} /> : undefined} />
          <p className="mb-3 text-[13px] text-soft">{pe.moyenne} : <b className="tnum text-ink-strong">{evalsRes.data.moyenne ?? "—"}</b> / 5 · {evalsRes.data.evaluations.length}</p>
          {evalsRes.data.evaluations.length === 0 ? <EmptyState title={pe.aucuneEvaluation} /> : (
            <ul className="divide-y divide-hairline">
              {evalsRes.data.evaluations.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-[13.5px]">
                  <div><p className="font-medium text-ink-strong" dir="ltr">{ev.periode} <span className="text-warn">{"★".repeat(ev.note)}</span><span className="text-faint">{"★".repeat(5 - ev.note)}</span></p>{ev.commentaire ? <p className="text-body">{ev.commentaire}</p> : null}</div>
                  <p className="text-[12px] text-soft">{nomComplet(ev.evaluateur) ?? "—"} · {formatDateHeure(ev.creeLe, ctx.locale)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) { return <div><dt className="text-soft">{k}</dt><dd className="mt-0.5 text-ink-strong">{v}</dd></div>; }
function Stat({ k, v }: { k: string; v: string }) { return <div className="rounded-field bg-surface-2 py-2"><p className="text-[11px] uppercase tracking-wide text-soft">{k}</p><p className="tnum text-[17px] font-semibold text-ink-strong">{v}</p></div>; }
