/** Détail d'une annonce (M21) — contenu, pièces jointes, commentaires modérables, accusé de lecture ; gestion : publier / archiver / lectures. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { AnnonceDetail, LecturesAnnonce } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDateHeure, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Avatar } from "../../../../../components/ui/avatar";
import { ProgressBar } from "../../../../../components/ui/progress";
import { FileViewerButton } from "../../../../../components/documents/document-viewer";
import { annonceVariant, categorieAnnonceVariant } from "../../../../../lib/status";
import { Markdown } from "../markdown";
import { ArchiverModal, CommentaireForm, MarquerLu, MasquerBouton, PublierModal, SupprimerBouton } from "../affichage-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").communication.titre };
}

export default async function AnnoncePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ cree?: string; maj?: string }> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const c = dict.communication;
  const e = dict.enumsCommunication;
  const gestion = ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"].some((r) => ctx.roles.includes(r as never));
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const res = await apiFetch<AnnonceDetail>(`/annonces/${id}`);
  if (!res.ok) notFound();
  const a = res.data;
  const lectures = gestion && a.statut !== "BROUILLON" ? await apiFetch<LecturesAnnonce>(`/annonces/${id}/lectures`) : null;
  const p = (path: string) => `/${locale}${path}`;
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const peutModifier = gestion && a.statut !== "ARCHIVEE" && (syndic || a.categorie !== "URGENCE");
  return (
    <div className="animate-fade mx-auto max-w-4xl space-y-4">
      {a.statut === "PUBLIEE" ? <MarquerLu locale={ctx.locale} id={a.id} deja={a.lu} /> : null}
      <BackLink href={p("/affichage")} label={c.titre} />
      <PageHeader
        title={a.titre}
        subtitle={`${a.publieLe ? (a.statut === "BROUILLON" ? fill(c.programmeeLe, { date: formatDateHeure(a.publieLe, ctx.locale) }) : fill(c.publieeLe, { date: formatDateHeure(a.publieLe, ctx.locale) })) : formatDateHeure(a.creeLe, ctx.locale)} · ${fill(c.par, { nom: nomComplet(a.auteur) ?? "—" })}${a.expireLe ? ` · ${fill(c.expireLe, { date: formatDateHeure(a.expireLe, ctx.locale) })}` : ""}`}
        badge={<span className="flex flex-wrap gap-1.5"><Badge variant={categorieAnnonceVariant[a.categorie]}>{e.categorieAnnonce[a.categorie]}</Badge><Badge variant={annonceVariant[a.statut]}>{e.statutAnnonce[a.statut]}</Badge>{a.epingle ? <Badge variant="ink">{c.epinglee}</Badge> : null}</span>}
        actions={gestion ? <div className="flex flex-wrap gap-2">
          {peutModifier ? <ButtonLink href={p(`/affichage/${a.id}/modifier`)} variant="secondary">{dict.common.modify}</ButtonLink> : null}
          {a.statut === "BROUILLON" && peutModifier ? <PublierModal dict={dict} locale={ctx.locale} annonce={a} /> : null}
          {a.statut === "PUBLIEE" && peutModifier ? <ArchiverModal dict={dict} locale={ctx.locale} annonce={a} /> : null}
          {a.statut === "BROUILLON" && peutModifier ? <SupprimerBouton dict={dict} locale={ctx.locale} id={a.id} /> : null}
        </div> : undefined}
      />
      {sp.cree === "1" ? <Banner variant="ok">{c.enregistree}</Banner> : null}
      {sp.maj === "1" ? <Banner variant="ok">{c.enregistree}</Banner> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <Markdown source={a.contenu} />
            {a.piecesJointes.length ? (
              <div className="mt-5 border-t border-hairline pt-4">
                <p className="mb-2 text-[13px] font-medium text-ink-strong">{c.piecesJointes}</p>
                <ul className="space-y-2">{a.piecesJointes.map((d) => <li key={d.document_id} className="flex items-center justify-between gap-2 text-[13px]"><span className="truncate text-ink-strong">{d.nom}</span><FileViewerButton src={p(`/api/document-inline?id=${d.document_id}`)} nom={d.nom} labels={viewer} /></li>)}</ul>
              </div>
            ) : null}
          </Card>
          <Card>
            <SectionHeader title={`${c.commentaires}${a.commentaires.length ? ` · ${a.commentaires.length}` : ""}`} />
            {a.commentaires.length === 0 ? <p className="text-[13px] text-soft">{c.aucunCommentaire}</p> : (
              <ul className="space-y-3">
                {a.commentaires.map((k) => (
                  <li key={k.id} className={`flex gap-3 ${k.masque ? "opacity-60" : ""}`}>
                    <Avatar nom={nomComplet(k.auteur) ?? "?"} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[13px] font-medium text-ink-strong">{nomComplet(k.auteur) ?? "—"}{k.mien ? <span className="ms-1 text-[11px] font-normal text-soft">({dict.profil.titre})</span> : null}</p><span className="text-[11px] text-faint">{formatDateHeure(k.creeLe, ctx.locale)}</span></div>
                      {k.masque ? <p className="mt-0.5 text-[12px] text-danger">{c.masque}</p> : null}
                      <Markdown source={k.contenu} className="mt-1 !text-[13.5px]" />
                      {syndic && !k.masque ? <div className="mt-1"><MasquerBouton dict={dict} locale={ctx.locale} annonceId={a.id} commentaireId={k.id} /></div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-hairline pt-4">
              {a.statut === "PUBLIEE" && a.commentairesActives ? <CommentaireForm dict={dict} locale={ctx.locale} annonceId={a.id} /> : <p className="text-[13px] text-soft">{c.commentairesDesactives}</p>}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title={c.audience} />
            <p className="text-[14px] text-ink-strong">{e.audience[a.audience]}{a.batiment ? ` ${a.batiment}` : ""}</p>
            {a.nbDestinataires !== null ? <p className="mt-1 text-[12px] text-soft">{fill(c.destinataires, { n: a.nbDestinataires })}</p> : null}
            {a.diffusion && !a.diffusion.programmee && a.diffusion.envoyes !== undefined ? <p className="mt-1 text-[12px] text-soft">{fill(c.publiee, { n: a.diffusion.envoyes })}</p> : null}
          </Card>
          {lectures?.ok ? (
            <Card>
              <SectionHeader title={c.lectures} subtitle={c.lecteursAide} />
              <p className="text-[15px] font-semibold text-ink-strong">{fill(c.luPar, { n: lectures.data.nb_lu, total: lectures.data.nb_destinataires })}</p>
              <ProgressBar ratio={lectures.data.nb_destinataires ? lectures.data.nb_lu / lectures.data.nb_destinataires : 0} tone="ok" className="mt-2" />
              {lectures.data.lecteurs.length ? <ul className="mt-3 space-y-1 text-[12.5px] text-body">{lectures.data.lecteurs.slice(0, 30).map((l) => <li key={l.utilisateur_id} className="flex justify-between gap-2"><span className="truncate">{nomComplet(l) ?? l.utilisateur_id.slice(0, 8)}</span><span className="shrink-0 text-faint">{formatDateHeure(l.lu_le, ctx.locale)}</span></li>)}</ul> : <p className="mt-2 text-[12px] text-soft">{c.aucuneLecture}</p>}
            </Card>
          ) : null}
          <Link href={p("/affichage")} className="block text-[13px] font-medium text-action">← {c.titre}</Link>
        </div>
      </div>
    </div>
  );
}
