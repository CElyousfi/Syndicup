/** Sondage consultatif (M21) — répondre, résultats agrégés (jamais un répondant), ouverture / clôture (gestion). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { Sondage } from "../../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../../lib/i18n";
import { formatDateHeure, nomComplet } from "../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { sondageVariant } from "../../../../../../lib/status";
import { Markdown } from "../../markdown";
import { RepondreForm, ResultatsSondage, SondageTransitionModal, SupprimerBouton } from "../../affichage-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").communication.sondage };
}

export default async function SondagePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ cree?: string }> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const c = dict.communication;
  const e = dict.enumsCommunication;
  const gestion = ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"].some((r) => ctx.roles.includes(r as never));
  const res = await apiFetch<Sondage>(`/sondages/${id}`);
  if (!res.ok) notFound();
  const s = res.data;
  const p = (path: string) => `/${locale}${path}`;
  const ouvertEncore = s.statut === "OUVERT" && new Date(s.dateFin).getTime() > Date.now();
  return (
    <div className="animate-fade mx-auto max-w-3xl space-y-4">
      <BackLink href={p("/affichage")} label={c.titre} />
      <PageHeader
        title={s.question}
        subtitle={`${s.statut === "CLOS" ? fill(c.closLe, { date: formatDateHeure(s.closLe ?? s.dateFin, ctx.locale) }) : fill(c.finLe, { date: formatDateHeure(s.dateFin, ctx.locale) })} · ${fill(c.par, { nom: nomComplet(s.auteur) ?? "—" })} · ${e.audience[s.audience]}${s.batiment ? ` ${s.batiment}` : ""}`}
        badge={<Badge variant={sondageVariant[s.statut]}>{e.statutSondage[s.statut]}</Badge>}
        actions={gestion ? <div className="flex flex-wrap gap-2">{s.statut === "BROUILLON" ? <><SondageTransitionModal dict={dict} locale={ctx.locale} sondage={s} action="ouvrir" /><SupprimerBouton dict={dict} locale={ctx.locale} id={s.id} sondage /></> : null}{s.statut === "OUVERT" ? <SondageTransitionModal dict={dict} locale={ctx.locale} sondage={s} action="clore" /> : null}</div> : undefined}
      />
      {sp.cree === "1" ? <Banner variant="ok">{c.sondageEnregistre}</Banner> : null}
      <Banner variant="info">{c.mention}</Banner>
      {s.description ? <Card><Markdown source={s.description} /></Card> : null}
      <Card>
        <SectionHeader title={s.maReponse || !ouvertEncore ? c.resultats : c.repondre} subtitle={s.choixMultiple ? c.choixMultiple : undefined} />
        {ouvertEncore && !s.maReponse ? <RepondreForm dict={dict} locale={ctx.locale} sondage={s} /> : <ResultatsSondage dict={dict} sondage={s} />}
        {s.maReponse && ouvertEncore ? <p className="mt-3 text-[12px] text-ok">{c.dejaRepondu}</p> : null}
      </Card>
    </div>
  );
}
