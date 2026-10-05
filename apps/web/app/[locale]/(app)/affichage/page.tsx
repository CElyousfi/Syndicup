/** Tableau d'affichage (M21) — annonces épinglées d'abord, filtre par catégorie, badge non lues ; sondages en cours ; contacts utiles. Tout membre (sauf prestataire). */
import type { Metadata } from "next";
import type { ReactNode } from "react";
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
import { IconCircle, type IconTone } from "../../../../components/ui/color-icons";
import { IconChevronEnd, IconMegaphone, IconPlus } from "../../../../components/ui/icons";
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
    <div className="page-root">
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
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Filtres en pastilles (Wise) : catégorie, puis statut pour la gestion. */}
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scroll-thin sm:mx-0 sm:flex-wrap sm:px-0">
            <Puce href={qs({ statut })} actif={!categorie}>{c.toutes}</Puce>
            {CATEGORIES.map((k) => <Puce key={k} href={qs({ categorie: k, statut })} actif={categorie === k}>{e.categorieAnnonce[k]}</Puce>)}
          </nav>
          {gestion ? (
            <div className="flex flex-wrap gap-2">
              <Puce href={qs({ categorie })} actif={!statut} petite>{e.statutAnnonce.PUBLIEE}</Puce>
              <Puce href={qs({ categorie, statut: "BROUILLON" })} actif={statut === "BROUILLON"} petite>{c.brouillons}</Puce>
              <Puce href={qs({ categorie, statut: "ARCHIVEE" })} actif={statut === "ARCHIVEE"} petite>{c.archivees}</Puce>
            </div>
          ) : null}
          {annonces.length === 0 ? <EmptyState title={categorie || statut ? c.aucuneFiltre : c.aucune} hint={!categorie && !statut && gestion ? c.aucuneAide : undefined} illustration={categorie || statut ? "empty-search" : "empty-annonces"} action={gestion && !categorie && !statut ? <ButtonLink href={p("/affichage/nouveau")}><IconPlus width={16} height={16} />{c.nouvelle}</ButtonLink> : undefined} /> : (
            <ul className="-mx-2 space-y-1 sm:-mx-3">
              {annonces.map((a) => {
                const nonLue = !a.lu && a.statut === "PUBLIEE";
                return (
                  <li key={a.id}>
                    <Link href={p(`/affichage/${a.id}`)} className="group flex items-start gap-3.5 rounded-2xl px-2 py-3.5 transition-colors hover:bg-wash sm:gap-4 sm:px-3">
                      <span className="relative shrink-0">
                        <IconCircle tone={TON_CATEGORIE[a.categorie]} size={48}>
                          <IconMegaphone width={22} height={22} className="text-ink-strong" />
                        </IconCircle>
                        {nonLue ? <span aria-hidden className="absolute -top-0.5 end-0 size-3 rounded-full bg-brand ring-2 ring-surface" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={categorieAnnonceVariant[a.categorie]}>{e.categorieAnnonce[a.categorie]}</Badge>
                          {a.epingle ? <Badge variant="ink">{c.epinglee}</Badge> : null}
                          {a.statut !== "PUBLIEE" ? <Badge variant={annonceVariant[a.statut]}>{e.statutAnnonce[a.statut]}</Badge> : null}
                          {nonLue ? <Badge variant="warn">{c.nonLue}</Badge> : null}
                          {a.audience !== "TOUS" ? <span className="text-[12px] text-soft">{e.audience[a.audience]}{a.batiment ? ` ${a.batiment}` : ""}</span> : null}
                        </div>
                        <h2 className={`mt-1.5 text-[16px] leading-snug text-ink ${!a.lu ? "font-bold" : "font-semibold"}`}>{a.titre}</h2>
                        <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-body">{a.apercu}</p>
                        <p className="mt-1.5 text-[12px] text-soft">
                          <span className="tnum">{a.publieLe ? (a.statut === "BROUILLON" ? fill(c.programmeeLe, { date: formatDateHeure(a.publieLe, ctx.locale) }) : fill(c.publieeLe, { date: formatDateHeure(a.publieLe, ctx.locale) })) : formatDateHeure(a.creeLe, ctx.locale)}</span> · {fill(c.par, { nom: nomComplet(a.auteur) ?? "—" })}
                          {a.nbCommentaires ? ` · ${a.nbCommentaires} ${c.commentaires.toLowerCase()}` : ""}
                          {a.nbLectures !== null && a.statut === "PUBLIEE" ? ` · ${c.lectures} ${a.nbLectures}` : ""}
                        </p>
                      </div>
                      <IconChevronEnd width={18} height={18} className="mt-3.5 shrink-0 text-link transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <Card>
            <SectionHeader title={c.sondages} className="mb-3" />
            {sondages.length === 0 ? <p className="text-[13px] text-soft">{c.aucunSondage}</p> : (
              <ul className="-mx-2 space-y-1">
                {sondages.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link href={p(`/affichage/sondages/${s.id}`)} className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-wash">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><Badge variant={sondageVariant[s.statut]}>{e.statutSondage[s.statut]}</Badge>{s.maReponse ? <span className="text-[12px] font-semibold text-ok">{c.dejaRepondu}</span> : null}</div>
                        <p className="mt-1.5 text-[15px] font-bold leading-snug text-ink">{s.question}</p>
                        <p className="tnum mt-0.5 text-[12px] text-soft">{s.statut === "CLOS" ? fill(c.closLe, { date: formatDate(s.closLe ?? s.dateFin, ctx.locale) }) : fill(c.finLe, { date: formatDateHeure(s.dateFin, ctx.locale) })}</p>
                      </div>
                      <IconChevronEnd width={16} height={16} className="shrink-0 text-link" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <SectionHeader title={c.contacts} className="mb-3" action={ctx.roles.includes("SYNDIC" as never) || ctx.roles.includes("SUPER_ADMIN" as never) ? <Link href={p("/affichage/contacts")} className="link text-[13px]">{dict.common.modify}</Link> : undefined} />
            {contacts.length === 0 ? <p className="text-[13px] text-soft">{c.aucunContact}</p> : (
              <ul className="space-y-2">
                {contacts.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3.5 py-3">
                    <div className="min-w-0"><p className="truncate text-[14px] font-bold text-ink">{x.libelle}</p><p className="tnum text-[13px] text-soft" dir="ltr">{x.telephone}</p></div>
                    <a href={`tel:${x.telephone.replace(/[^+0-9]/g, "")}`} className="inline-flex h-9 shrink-0 items-center rounded-full border-[1.5px] border-link px-4 text-[13px] font-semibold text-link transition-colors hover:bg-action-wash">{c.appeler}</a>
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

/** Puce de filtre (Wise) : contour neutre au repos, lime quand active. */
function Puce({ href, actif, petite = false, children }: { href: string; actif: boolean; petite?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-semibold transition-colors ${petite ? "h-8 px-3.5 text-[13px]" : "h-9 px-4 text-[14px]"} ${actif ? "border-cta bg-cta text-ink" : "border-hairline-strong bg-surface text-ink-strong hover:bg-hover"}`}
    >
      {children}
    </Link>
  );
}

const TON_CATEGORIE: Record<CategorieAnnonce, IconTone> = {
  INFORMATION: "tosca",
  TRAVAUX: "sand",
  COUPURE: "warn",
  SECURITE: "danger",
  URGENCE: "danger",
  AG: "lilac",
  CONVIVIALITE: "sage",
  REGLEMENT: "sand",
};
