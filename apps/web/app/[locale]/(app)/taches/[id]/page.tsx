/** Détail d'une tâche (M22) — liens vers l'objet source, checklist cochable, pièces jointes, commentaires, journal ; statut / assignation / annulation. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { TacheDetail } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatDateHeure, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Avatar } from "../../../../../components/ui/avatar";
import { IconChevronEnd } from "../../../../../components/ui/icons";
import { FileViewerButton } from "../../../../../components/documents/document-viewer";
import { prioriteVariant, tacheVariant } from "../../../../../lib/status";
import { AnnulerModal, AssignerModal, Checklist, CommentaireForm, StatutModal } from "../taches-client";
import { assigneesPossibles } from "../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").taches.titre };
}

export default async function TachePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ cree?: string; maj?: string }> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"]);
  const { dict } = ctx;
  const t = dict.taches;
  const e = dict.enumsTaches;
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const res = await apiFetch<TacheDetail>(`/taches/${id}`);
  if (!res.ok) notFound();
  const x = res.data;
  const assignees = syndic ? await assigneesPossibles() : [];
  const p = (path: string) => `/${locale}${path}`;
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const ouverte = x.statut === "A_FAIRE" || x.statut === "EN_COURS" || x.statut === "BLOQUEE";
  const lien = x.resolutionAg ? { href: p(`/ag/${x.resolutionAg.agId}`), label: t.voirResolution, texte: `${dict.ag.resolutions} n° ${x.resolutionAg.ordre} — ${x.resolutionAg.texte}` }
    : x.contratEcheance ? { href: p(`/contrats/${x.contratEcheance.contratId}`), label: t.voirContrat, texte: `${x.contratEcheance.contratLibelle} · ${formatDate(x.contratEcheance.dateEcheance, ctx.locale)}` }
    : x.incident ? { href: p(`/incidents/${x.incident.id}`), label: t.voirIncident, texte: `${dict.enums.categorieIncident[x.incident.categorie as keyof typeof dict.enums.categorieIncident] ?? x.incident.categorie}` }
    : x.rapportGestion ? { href: p(`/rapports/gestion/${x.rapportGestion.id}`), label: t.voirRapport, texte: `${dict.rapports.gestionTitre} ${x.rapportGestion.exercice}` }
    : null;
  return (
    <div className="page-root space-y-4">
      <PageHeader
        back={<BackLink href={p("/taches")} label={t.titre} />}
        title={x.titre}
        subtitle={`${e.origine[x.origine]}${x.creePar ? ` · ${nomComplet(x.creePar) ?? ""}` : x.origine !== "MANUELLE" ? ` · ${t.creeeParSysteme}` : ""} · ${formatDateHeure(x.creeLe, ctx.locale)}`}
        badge={<span className="flex flex-wrap gap-1.5"><Badge variant={tacheVariant[x.statut]}>{e.statut[x.statut]}</Badge><Badge variant={prioriteVariant[x.priorite]}>{e.priorite[x.priorite]}</Badge>{x.enRetard ? <Badge variant="danger">{t.enRetard}</Badge> : null}</span>}
        actions={<div className="flex flex-wrap gap-2">
          {x.peutMettreAJour && (ouverte || syndic) && x.statut !== "ANNULEE" ? <StatutModal dict={dict} locale={ctx.locale} tache={x} syndic={syndic} /> : null}
          {syndic && ouverte ? <AssignerModal dict={dict} locale={ctx.locale} tache={x} assignees={assignees} /> : null}
          {syndic && ouverte ? <ButtonLink href={p(`/taches/${x.id}/modifier`)} variant="secondary">{dict.common.modify}</ButtonLink> : null}
          {syndic && ouverte ? <AnnulerModal dict={dict} locale={ctx.locale} tache={x} /> : null}
        </div>}
      />
      {sp.cree === "1" ? <Banner variant="ok">{t.creee}</Banner> : null}
      {sp.maj === "1" ? <Banner variant="ok">{t.enregistree}</Banner> : null}
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {x.description ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-strong">{x.description}</p> : null}
          {x.checklist?.length ? <Card><SectionHeader title={t.checklist} className="mb-1" /><Checklist dict={dict} locale={ctx.locale} tache={x} editable={x.peutMettreAJour && ouverte} /></Card> : null}
          <Card>
            <SectionHeader title={`${t.commentaires}${x.commentaires.length ? ` · ${x.commentaires.length}` : ""}`} className="mb-4" />
            {x.commentaires.length === 0 ? <p className="text-[14px] text-soft">{t.aucunCommentaire}</p> : (
              <ul className="space-y-4">{x.commentaires.map((k) => <li key={k.id} className="flex gap-3"><Avatar nom={nomComplet(k.auteur) ?? "?"} size={36} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[14px] font-bold text-ink">{nomComplet(k.auteur) ?? "—"}</p><span className="text-[11px] text-faint">{formatDateHeure(k.creeLe, ctx.locale)}</span></div><p className="mt-0.5 whitespace-pre-line text-[14px] leading-relaxed text-body">{k.contenu}</p></div></li>)}</ul>
            )}
            <div className="mt-5 border-t border-wash-strong pt-4"><CommentaireForm dict={dict} locale={ctx.locale} tacheId={x.id} /></div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="py-2 sm:py-2">
            <dl className="divide-y divide-wash-strong text-sm">
              <div className="flex items-start justify-between gap-4 py-3"><dt className="text-soft">{t.assignee}</dt><dd className="text-end font-semibold text-ink">{x.assignee ? nomComplet(x.assignee) ?? "—" : t.nonAssignee}</dd></div>
              <div className="flex items-start justify-between gap-4 py-3"><dt className="text-soft">{t.echeance}</dt><dd className={`tnum text-end font-semibold ${x.enRetard ? "text-danger" : "text-ink"}`}>{x.dateEcheance ? formatDate(x.dateEcheance, ctx.locale) : t.sansEcheance}</dd></div>
              {x.termineeLe ? <div className="flex items-start justify-between gap-4 py-3"><dt className="text-soft">{e.statut.TERMINEE}</dt><dd className="tnum text-end font-semibold text-ink">{fill(t.termineeLe, { date: formatDateHeure(x.termineeLe, ctx.locale) })}</dd></div> : null}
              <div className="flex items-start justify-between gap-4 py-3"><dt className="text-soft">{t.recurrence}</dt><dd className="text-end font-semibold text-ink">{x.recurrence ? e.frequence[x.recurrence.frequence] : t.aucuneRecurrence}{x.recurrenceParenteId ? <Link href={p(`/taches/${x.recurrenceParenteId}`)} className="link mt-0.5 block text-[12px] font-normal">{t.occurrenceDe}</Link> : null}</dd></div>
              <div className="flex items-start justify-between gap-4 py-3"><dt className="text-soft">{t.visibleConseil}</dt><dd className="text-end font-semibold text-ink">{x.visibleConseil ? dict.common.yes : dict.common.no}</dd></div>
            </dl>
          </Card>
          {lien ? <Card><p className="text-[13px] font-semibold text-soft">{t.lieA}</p><p className="mt-2 text-[15px] font-semibold text-ink">{lien.texte}</p><Link href={lien.href} className="link mt-2 inline-flex items-center gap-1 text-[13px]">{lien.label}<IconChevronEnd width={14} height={14} /></Link></Card> : null}
          <Card>
            <SectionHeader title={t.piecesJointes} className="mb-3" />
            {x.piecesJointes.length === 0 ? <p className="text-[13px] text-soft">{dict.common.none}</p> : <ul className="space-y-2">{x.piecesJointes.map((d) => <li key={d.document_id} className="flex items-center justify-between gap-2 text-[13px]"><span className="truncate text-ink-strong">{d.nom}</span><FileViewerButton src={p(`/api/document-inline?id=${d.document_id}`)} nom={d.nom} labels={viewer} /></li>)}</ul>}
          </Card>
          <Card>
            <SectionHeader title={t.journal} className="mb-3" />
            <ul className="divide-y divide-wash-strong text-[13px] text-body">{x.journal.slice(-12).reverse().map((l) => <li key={l.id} className="flex justify-between gap-3 py-2"><span className="min-w-0">{l.type}{l.details && "vers" in l.details ? ` → ${e.statut[l.details.vers as keyof typeof e.statut] ?? String(l.details.vers)}` : ""}{l.acteur ? ` · ${nomComplet(l.acteur) ?? ""}` : ""}</span><span className="tnum shrink-0 text-[12px] text-soft">{formatDateHeure(l.horodatage, ctx.locale)}</span></li>)}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
