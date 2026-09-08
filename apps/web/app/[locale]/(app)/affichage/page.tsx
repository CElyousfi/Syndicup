/** Tableau d'affichage (M21) — annonces épinglées d'abord, filtre par catégorie, badge non lues ; sondages en cours ; contacts utiles. Tout membre (sauf prestataire). */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Annonce, CategorieAnnonce, ContactUtile, Sondage, StatutAnnonce } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDateHeure, formatDate, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { ButtonLink } from "../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../components/ui/link-tabs";
import { IconMegaphone, IconPlus } from "../../../../components/ui/icons";
import { ExportButtons } from "../../../../components/ui/export-buttons";
import { annonceVariant, categorieAnnonceVariant, sondageVariant } from "../../../../lib/status";

const CATEGORIES: CategorieAnnonce[] = ["INFORMATION", "TRAVAUX", "COUPURE", "SECURITE", "URGENCE", "AG", "CONVIVIALITE", "REGLEMENT"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").communication.titre };
}

export default async function AffichagePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ categorie?: string; statut?: string; supprimee?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const c = dict.communication;
  const e = dict.enumsCommunication;
  const gestion = ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"].some((r) => ctx.roles.includes(r as never));
  const categorie = CATEGORIES.includes(sp.categorie as CategorieAnnonce) ? (sp.categorie as CategorieAnnonce) : undefined;
  const statut: StatutAnnonce | undefined = gestion && (sp.statut === "BROUILLON" || sp.statut === "ARCHIVEE") ? sp.statut : undefined;
  const p = (path: string) => `/${locale}${path}`;
  const [annRes, sondRes, contactsRes] = await Promise.all([
    apiFetch<Annonce[]>("/annonces", { searchParams: { limit: 50, categorie, statut } }),
    apiFetch<Sondage[]>("/sondages", { searchParams: { limit: 20 } }),
    apiFetch<ContactUtile[]>("/contacts-utiles"),
  ]);
  const annonces = annRes.ok ? annRes.data : [];
  const nonLues = annRes.ok ? Number((annRes.meta as { non_lues?: number }).non_lues ?? 0) : 0;
  const sondages = sondRes.ok ? sondRes.data : [];
  const contacts = contactsRes.ok ? contactsRes.data : [];
  const qs = (o: { categorie?: string; statut?: string }) => { const u = new URLSearchParams(); if (o.categorie) u.set("categorie", o.categorie); if (o.statut) u.set("statut", o.statut); const q = u.toString(); return `${p("/affichage")}${q ? `?${q}` : ""}`; };

  return (
    <div className="animate-fade">
      <PageHeader
        title={c.titre}
        subtitle={c.subtitle}
        badge={nonLues > 0 ? <Badge variant="warn">{fill(c.nonLues, { n: nonLues })}</Badge> : undefined}
        actions={<div className="flex flex-wrap gap-2">
          {gestion ? <ExportButtons ressource="annonces" filtres={{ categorie, statut }} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx }} size="sm" /> : null}
          {gestion ? <ButtonLink href={p("/affichage/sondages/nouveau")} variant="secondary">{c.nouveauSondage}</ButtonLink> : null}
          {gestion ? <ButtonLink href={p("/affichage/nouveau")}><IconPlus width={16} height={16} />{c.nouvelle}</ButtonLink> : null}
        </div>}
      />
      {sp.supprimee === "1" ? <Banner variant="ok" className="mb-4">{c.supprimee}</Banner> : null}
      {!annRes.ok ? <Banner variant="danger" className="mb-4">{c.chargementImpossible}</Banner> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <LinkTabs tabs={[{ href: qs({ statut }), label: c.toutes, active: !categorie }, ...CATEGORIES.map((k) => ({ href: qs({ categorie: k, statut }), label: e.categorieAnnonce[k], active: categorie === k }))]} />
          </div>
          {gestion ? <div className="flex gap-1.5 text-[12.5px]"><Link href={qs({ categorie })} className={`rounded-full border px-3 py-1 ${!statut ? "border-ink bg-ink text-white" : "border-hairline text-soft"}`}>{e.statutAnnonce.PUBLIEE}</Link><Link href={qs({ categorie, statut: "BROUILLON" })} className={`rounded-full border px-3 py-1 ${statut === "BROUILLON" ? "border-ink bg-ink text-white" : "border-hairline text-soft"}`}>{c.brouillons}</Link><Link href={qs({ categorie, statut: "ARCHIVEE" })} className={`rounded-full border px-3 py-1 ${statut === "ARCHIVEE" ? "border-ink bg-ink text-white" : "border-hairline text-soft"}`}>{c.archivees}</Link></div> : null}
          {annonces.length === 0 ? <EmptyState title={categorie || statut ? c.aucuneFiltre : c.aucune} hint={!categorie && !statut && gestion ? c.aucuneAide : undefined} icon={<IconMegaphone width={44} height={44} />} action={gestion && !categorie && !statut ? <ButtonLink href={p("/affichage/nouveau")}>{c.nouvelle}</ButtonLink> : undefined} /> : (
            <ul className="space-y-3">
              {annonces.map((a) => (
                <li key={a.id}>
                  <Link href={p(`/affichage/${a.id}`)} className={`block rounded-card border bg-surface p-5 transition-colors hover:bg-hover ${!a.lu && a.statut === "PUBLIEE" ? "border-action/40" : "border-hairline"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={categorieAnnonceVariant[a.categorie]}>{e.categorieAnnonce[a.categorie]}</Badge>
                      {a.epingle ? <Badge variant="ink">{c.epinglee}</Badge> : null}
                      {a.statut !== "PUBLIEE" ? <Badge variant={annonceVariant[a.statut]}>{e.statutAnnonce[a.statut]}</Badge> : null}
                      {!a.lu && a.statut === "PUBLIEE" ? <Badge variant="warn">{c.nonLue}</Badge> : null}
                      {a.audience !== "TOUS" ? <span className="text-[12px] text-soft">{e.audience[a.audience]}{a.batiment ? ` ${a.batiment}` : ""}</span> : null}
                    </div>
                    <h2 className={`mt-2 text-[16px] ${!a.lu ? "font-semibold" : "font-medium"} text-ink-strong`}>{a.titre}</h2>
                    <p className="mt-1 text-[13.5px] text-body">{a.apercu}</p>
                    <p className="mt-2 text-[12px] text-soft">
                      {a.publieLe ? (a.statut === "BROUILLON" ? fill(c.programmeeLe, { date: formatDateHeure(a.publieLe, ctx.locale) }) : fill(c.publieeLe, { date: formatDateHeure(a.publieLe, ctx.locale) })) : formatDateHeure(a.creeLe, ctx.locale)} · {fill(c.par, { nom: nomComplet(a.auteur) ?? "—" })}
                      {a.nbCommentaires ? ` · ${a.nbCommentaires} ${c.commentaires.toLowerCase()}` : ""}
                      {a.nbLectures !== null && a.statut === "PUBLIEE" ? ` · ${c.lectures} ${a.nbLectures}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title={c.sondages} />
            {sondages.length === 0 ? <p className="text-[13px] text-soft">{c.aucunSondage}</p> : (
              <ul className="divide-y divide-hairline">
                {sondages.slice(0, 6).map((s) => (
                  <li key={s.id} className="py-3">
                    <Link href={p(`/affichage/sondages/${s.id}`)} className="block hover:text-action">
                      <div className="flex items-center gap-2"><Badge variant={sondageVariant[s.statut]}>{e.statutSondage[s.statut]}</Badge>{s.maReponse ? <span className="text-[12px] text-ok">{c.dejaRepondu}</span> : null}</div>
                      <p className="mt-1.5 text-[14px] font-medium text-ink-strong">{s.question}</p>
                      <p className="mt-0.5 text-[12px] text-soft">{s.statut === "CLOS" ? fill(c.closLe, { date: formatDate(s.closLe ?? s.dateFin, ctx.locale) }) : fill(c.finLe, { date: formatDateHeure(s.dateFin, ctx.locale) })}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <SectionHeader title={c.contacts} action={ctx.roles.includes("SYNDIC" as never) || ctx.roles.includes("SUPER_ADMIN" as never) ? <Link href={p("/affichage/contacts")} className="text-[13px] font-medium text-action">{dict.common.modify}</Link> : undefined} />
            {contacts.length === 0 ? <p className="text-[13px] text-soft">{c.aucunContact}</p> : (
              <ul className="divide-y divide-hairline">
                {contacts.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0"><p className="truncate text-[14px] font-medium text-ink-strong">{x.libelle}</p><p className="tnum text-[13px] text-soft" dir="ltr">{x.telephone}</p></div>
                    <a href={`tel:${x.telephone.replace(/[^+0-9]/g, "")}`} className="inline-flex h-9 shrink-0 items-center rounded-btn border border-hairline-strong px-3 text-[13px] font-medium text-ink-strong hover:bg-hover">{c.appeler}</a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
