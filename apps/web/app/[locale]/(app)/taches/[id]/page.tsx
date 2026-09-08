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
    <div className="animate-fade space-y-4">
      <BackLink href={p("/taches")} label={t.titre} />
      <PageHeader
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
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {x.description ? <Card><p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-strong">{x.description}</p></Card> : null}
          {x.checklist?.length ? <Card><SectionHeader title={t.checklist} /><Checklist dict={dict} locale={ctx.locale} tache={x} editable={x.peutMettreAJour && ouverte} /></Card> : null}
          <Card>
            <SectionHeader title={`${t.commentaires}${x.commentaires.length ? ` · ${x.commentaires.length}` : ""}`} />
            {x.commentaires.length === 0 ? <p className="text-[13px] text-soft">{t.aucunCommentaire}</p> : (
              <ul className="space-y-3">{x.commentaires.map((k) => <li key={k.id} className="flex gap-3"><Avatar nom={nomComplet(k.auteur) ?? "?"} size={32} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[13px] font-medium text-ink-strong">{nomComplet(k.auteur) ?? "—"}</p><span className="text-[11px] text-faint">{formatDateHeure(k.creeLe, ctx.locale)}</span></div><p className="mt-0.5 whitespace-pre-line text-[13.5px] text-body">{k.contenu}</p></div></li>)}</ul>
            )}
            <div className="mt-4 border-t border-hairline pt-4"><CommentaireForm dict={dict} locale={ctx.locale} tacheId={x.id} /></div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <dl className="space-y-3 text-[13.5px]">
              <div><dt className="text-soft">{t.assignee}</dt><dd className="mt-0.5 text-ink-strong">{x.assignee ? nomComplet(x.assignee) ?? "—" : t.nonAssignee}</dd></div>
              <div><dt className="text-soft">{t.echeance}</dt><dd className={`mt-0.5 tnum ${x.enRetard ? "font-medium text-danger" : "text-ink-strong"}`}>{x.dateEcheance ? formatDate(x.dateEcheance, ctx.locale) : t.sansEcheance}</dd></div>
              {x.termineeLe ? <div><dt className="text-soft">{e.statut.TERMINEE}</dt><dd className="mt-0.5 text-ink-strong">{fill(t.termineeLe, { date: formatDateHeure(x.termineeLe, ctx.locale) })}</dd></div> : null}
              <div><dt className="text-soft">{t.recurrence}</dt><dd className="mt-0.5 text-ink-strong">{x.recurrence ? e.frequence[x.recurrence.frequence] : t.aucuneRecurrence}</dd></div>
              {x.recurrenceParenteId ? <div><dd className="text-[12px] text-soft"><Link href={p(`/taches/${x.recurrenceParenteId}`)} className="underline">{t.occurrenceDe}</Link></dd></div> : null}
              <div><dt className="text-soft">{t.visibleConseil}</dt><dd className="mt-0.5 text-ink-strong">{x.visibleConseil ? dict.common.yes : dict.common.no}</dd></div>
            </dl>
          </Card>
          {lien ? <Card><SectionHeader title={t.lieA} /><p className="text-[13.5px] text-ink-strong">{lien.texte}</p><Link href={lien.href} className="mt-2 inline-block text-[13px] font-medium text-action">{lien.label} →</Link></Card> : null}
          <Card>
            <SectionHeader title={t.piecesJointes} />
            {x.piecesJointes.length === 0 ? <p className="text-[13px] text-soft">{dict.common.none}</p> : <ul className="space-y-2">{x.piecesJointes.map((d) => <li key={d.document_id} className="flex items-center justify-between gap-2 text-[13px]"><span className="truncate text-ink-strong">{d.nom}</span><FileViewerButton src={p(`/api/document-inline?id=${d.document_id}`)} nom={d.nom} labels={viewer} /></li>)}</ul>}
          </Card>
          <Card>
            <SectionHeader title={t.journal} />
            <ul className="space-y-1.5 text-[12.5px] text-body">{x.journal.slice(-12).reverse().map((l) => <li key={l.id} className="flex justify-between gap-2"><span>{l.type}{l.details && "vers" in l.details ? ` → ${e.statut[l.details.vers as keyof typeof e.statut] ?? String(l.details.vers)}` : ""}{l.acteur ? ` · ${nomComplet(l.acteur) ?? ""}` : ""}</span><span className="shrink-0 text-faint">{formatDateHeure(l.horodatage, ctx.locale)}</span></li>)}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
