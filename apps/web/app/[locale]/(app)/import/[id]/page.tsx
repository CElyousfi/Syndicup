/** Fiche d'un import (M24) — étapes 2 à 4 : colonnes (mapping), aperçu avec erreurs, exécution avec progression, résultat + rapport csv, invitations créées. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { ImportJob, Invitation, StatutImport } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDateHeure, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { StatCard } from "../../../../../components/ui/stat-card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { CFile, CAlert, CShield } from "../../../../../components/ui/color-icons";
import { importVariant } from "../../../../../lib/status";
import { EtapesImport, ExecutionPanel, InvitationsMasseModal, MappingForm } from "../import-client";
import { Figure } from "../../../../../components/ui/amount";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").importation.titre };
}
export default async function ImportDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE"]);
  const { dict } = ctx;
  const t = dict.importation;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const res = await apiFetch<ImportJob>(`/import/${id}`);
  if (!res.ok) notFound();
  const j = res.data;
  const invitationsRes = gestion && (j.type === "LOTS_PROPRIETAIRES" || j.type === "PERSONNEL") && j.statut === "TERMINE" ? await apiFetch<Invitation[]>("/invitations", { searchParams: { limit: 200 } }) : null;
  const invitations = (invitationsRes?.ok ? invitationsRes.data : []).filter((i) => i.importJobId === j.id);
  const nonEnvoyees = invitations.filter((i) => i.statut === "EN_ATTENTE" && !i.envoyeeLe);
  const apercu = j.apercu;
  const etape = j.statut === "ANALYSE" ? 2 : j.statut === "PRET" ? 3 : 4;

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={`/${locale}/import?onglet=imports`} label={t.titre} />}
        title={j.nomFichier}
        badge={<Badge variant={importVariant[j.statut as StatutImport]}>{t.statuts[j.statut]}</Badge>}
        subtitle={<>{t.typesImport[j.type]} · {j.lancePar ? nomComplet(j.lancePar) ?? "" : ""} · {formatDateHeure(j.creeLe, ctx.locale)}</>}
        actions={<div className="flex flex-wrap gap-2">
          {["TERMINE", "ECHOUE", "ANNULE"].includes(j.statut) ? <a className="su-btn inline-flex h-11 items-center rounded-btn border-[1.5px] border-link px-5 text-[15px] font-semibold text-link hover:bg-action-wash" href={`/api/import-fichier?kind=rapport&id=${j.id}`}>{t.rapport}</a> : null}
          {gestion && nonEnvoyees.length ? <InvitationsMasseModal dict={dict} locale={ctx.locale} importJobId={j.id} nb={nonEnvoyees.length} /> : null}
        </div>}
      />
      <EtapesImport dict={dict} etape={etape} termine={j.statut === "TERMINE"} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<CFile />} tone="sage" label={t.nbLignes} value={String(j.nbLignes)} />
        <StatCard icon={<CAlert />} tone={j.nbErreurs > 0 ? "warn" : "sage"} label={t.nbErreurs} value={String(j.nbErreurs)} hint={j.nbErreurs > 0 ? t.nbErreursAide : undefined} />
        <StatCard icon={<CShield />} tone={j.statut === "TERMINE" ? "ok" : "sand"} label={t.progression} value={`${j.nbTraitees}/${j.nbLignes}`} />
      </div>
      {apercu?.avertissements?.length ? <Banner variant={j.statut === "ANALYSE" ? "warn" : "info"} className="mb-4" title={t.avertissements}><ul className="list-disc ps-5">{apercu.avertissements.map((a, i) => <li key={i}>{a}</li>)}</ul></Banner> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {gestion || apercu ? <Card><SectionHeader title={t.colonnesDetectees} />{gestion ? <div className="mt-3"><MappingForm dict={dict} locale={ctx.locale} job={j} /></div> : null}</Card> : null}
          {apercu ? (
            <section>
              <SectionHeader className="mb-3" title={t.apercu} subtitle={apercu.lignes.every((l) => l.erreurs.length === 0) ? t.aucuneErreur : undefined} />
              <TableCard>
              <Table>
                <THead><TH>{t.ligne}</TH>{apercu.colonnes.filter((c) => c.champ).map((c) => <TH key={c.index}>{apercu.champs.find((f) => f.cle === c.champ)?.libelle[ctx.locale === "ar" ? "AR" : "FR"] ?? c.champ}</TH>)}<TH>{t.erreursLigne}</TH></THead>
                <tbody>{apercu.lignes.map((l) => (
                  <TR key={l.n} className={l.erreurs.length ? "bg-danger-tint" : ""}>
                    <TD className="tnum text-soft">{l.n}</TD>
                    {apercu.colonnes.filter((c) => c.champ).map((c) => <TD key={c.index} className="text-body">{l.valeurs[c.index] || "—"}</TD>)}
                    <TD>{l.erreurs.length ? <span className="text-[12.5px] text-danger">{l.erreurs.join(" ")}</span> : l.avertissements.length ? <span className="text-[12.5px] text-warn">{l.avertissements.join(" ")}</span> : <Badge variant="ok">OK</Badge>}</TD>
                  </TR>
                ))}</tbody>
              </Table>
              </TableCard>
            </section>
          ) : null}
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title={t.etapes.execution} />
            <div className="mt-3">{gestion ? <ExecutionPanel dict={dict} locale={ctx.locale} job={j} /> : <Badge variant={importVariant[j.statut as StatutImport]}>{t.statuts[j.statut]}</Badge>}</div>
          </Card>
          {j.resultat ? (
            <Card>
              <SectionHeader title={t.resultat} />
              <dl className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-surface p-3.5"><dt className="text-[12px] font-medium text-soft">{t.crees}</dt><dd className="mt-1 text-[22px] font-bold leading-none text-ink tnum"><Figure value={String(j.resultat.crees)} /></dd></div>
                <div className="rounded-2xl bg-surface p-3.5"><dt className="text-[12px] font-medium text-soft">{t.misAJour}</dt><dd className="mt-1 text-[22px] font-bold leading-none text-ink tnum"><Figure value={String(j.resultat.mis_a_jour)} /></dd></div>
                <div className="rounded-2xl bg-surface p-3.5"><dt className="text-[12px] font-medium text-soft">{t.ignorees}</dt><dd className="mt-1 text-[22px] font-bold leading-none text-ink tnum"><Figure value={String(j.resultat.ignorees)} /></dd></div>
                <div className="rounded-2xl bg-surface p-3.5"><dt className="text-[12px] font-medium text-soft">{t.dejaAppliquees}</dt><dd className="mt-1 text-[22px] font-bold leading-none text-ink tnum"><Figure value={String(j.resultat.deja_appliquees ?? 0)} /></dd></div>
                <div className="col-span-2 rounded-2xl bg-surface p-3.5"><dt className="text-[12px] font-medium text-soft">{t.erreurs}</dt><dd className={`mt-1 text-[22px] font-bold leading-none tnum ${j.resultat.erreurs.length ? "text-danger" : "text-ink"}`}><Figure value={String(j.resultat.erreurs.length)} /></dd></div>
              </dl>
              {j.resultat.erreurs.length ? <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-[12.5px] text-body">{j.resultat.erreurs.slice(0, 50).map((e) => <li key={e.n}><span className="font-mono text-faint">#{e.n}</span> {e.message}</li>)}</ul> : null}
              {j.resultat.echec ? <p className="mt-2 text-[12.5px] text-danger">{j.resultat.echec}</p> : null}
            </Card>
          ) : null}
          {invitations.length ? <Card><SectionHeader title={t.invitationsEnAttente} subtitle={`${nonEnvoyees.length}/${invitations.length} · ${t.nonEnvoyee.toLowerCase()}`} /></Card> : null}
        </div>
      </div>
    </div>
  );
}
