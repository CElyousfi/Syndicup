/** Importer & démarrer (M24) — Démarrer (checklist + nouvel import), Imports (historique), Invitations en masse. Syndic ; conseil en lecture. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { ImportJob, Invitation, StatutImport } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDateHeure, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { ButtonLink } from "../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../components/ui/link-tabs";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { IconPlus } from "../../../../components/ui/icons";
import { Avatar } from "../../../../components/ui/avatar";
import { IconCircle, CFile } from "../../../../components/ui/color-icons";
import { importVariant } from "../../../../lib/status";
import { OnboardingCard, chargerOnboarding } from "./onboarding-card";
import { InvitationsMasseModal } from "./import-client";

type Onglet = "demarrer" | "imports" | "invitations";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").importation.titre };
}

export default async function ImportPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE"]);
  const { dict } = ctx;
  const t = dict.importation;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const onglet: Onglet = (["demarrer", "imports", "invitations"] as Onglet[]).includes(sp.onglet as Onglet) ? (sp.onglet as Onglet) : "demarrer";
  const p = (path: string) => `/${locale}${path}`;
  const [checklist, importsRes, invitationsRes] = await Promise.all([
    chargerOnboarding(ctx.coproprieteId ?? ""),
    apiFetch<ImportJob[]>("/import"),
    gestion ? apiFetch<Invitation[]>("/invitations", { searchParams: { limit: 200 } }) : Promise.resolve(null),
  ]);
  const imports = importsRes.ok ? importsRes.data : [];
  const preRemplies = (invitationsRes?.ok ? invitationsRes.data : []).filter((i) => i.statut === "EN_ATTENTE" && i.preRempliJson);
  const nonEnvoyees = preRemplies.filter((i) => !i.envoyeeLe);
  const lotsParId = new Map<string, string>();

  return (
    <div className="page-root">
      <PageHeader title={t.titre} subtitle={t.subtitle} actions={gestion ? <ButtonLink href={p("/import/nouveau")}><IconPlus width={16} height={16} />{t.nouvelImport}</ButtonLink> : undefined} />
      {checklist?.est_demo ? <Banner variant="warn" className="mb-4">{t.demo}</Banner> : null}
      {!importsRes.ok ? <Banner variant="danger" className="mb-4">{t.chargementImpossible}</Banner> : null}
      <LinkTabs className="mb-5" tabs={[{ href: p("/import"), label: t.onglets.demarrer, active: onglet === "demarrer" }, { href: p("/import?onglet=imports"), label: t.onglets.imports, active: onglet === "imports", count: imports.length || undefined }, ...(gestion ? [{ href: p("/import?onglet=invitations"), label: t.onglets.invitations, active: onglet === "invitations", count: nonEnvoyees.length || undefined }] : [])]} />

      {onglet === "demarrer" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">{checklist ? <OnboardingCard dict={dict} locale={ctx.locale} checklist={checklist} /> : <Banner variant="danger">{t.chargementImpossible}</Banner>}</div>
          <div className="space-y-4">
            <Card>
              <SectionHeader title={t.modeles} subtitle={t.modelesAide} />
              <ul className="mt-4 divide-y divide-wash-strong rounded-[20px] bg-surface px-4">
                {(["LOTS_PROPRIETAIRES", "SOLDES_OUVERTURE", "PRESTATAIRES", "CONTRATS", "VEHICULES_BADGES", "PERSONNEL"] as const).map((x) => (
                  <li key={x} className="flex items-center justify-between gap-3 py-3 text-[14px]"><span className="min-w-0 font-semibold text-ink">{t.typesImport[x]}</span><span className="shrink-0 text-soft"><a className="link" href={`/api/import-fichier?kind=modele&type=${x}&langue=fr`}>FR</a> · <a className="link" href={`/api/import-fichier?kind=modele&type=${x}&langue=ar`}>AR</a></span></li>
                ))}
              </ul>
            </Card>
            {gestion ? <Card><SectionHeader title={t.nouvelImport} subtitle={t.aucunImportAide} /><div className="mt-3"><ButtonLink href={p("/import/nouveau")} variant="secondary">{t.nouvelImport}</ButtonLink></div></Card> : null}
          </div>
        </div>
      ) : null}

      {onglet === "imports" ? (
        imports.length === 0 ? <EmptyState title={t.aucunImport} hint={t.aucunImportAide} illustration="empty-documents" action={gestion ? <ButtonLink href={p("/import/nouveau")}><IconPlus width={16} height={16} />{t.nouvelImport}</ButtonLink> : undefined} /> : (
          <TableCard><Table>
            <THead><TH>{t.fichierSource}</TH><TH>{t.typeImport}</TH><TH>{dict.lots.statut}</TH><TH align="end">{t.nbLignes}</TH><TH align="end">{t.nbErreurs}</TH><TH>{t.lancePar}</TH><TH>{dict.lots.dateDebut}</TH></THead>
            <tbody>{imports.map((j) => (
              <TR key={j.id}>
                <TD><Link href={p(`/import/${j.id}`)} className="inline-flex max-w-full items-center gap-3 font-bold text-ink hover:text-link"><IconCircle tone="sage" size={40}><CFile width={20} height={20} /></IconCircle><span className="min-w-0 truncate">{j.nomFichier}</span></Link></TD>
                <TD className="text-body">{t.typesImport[j.type]}</TD>
                <TD><Badge variant={importVariant[j.statut as StatutImport]}>{t.statuts[j.statut]}</Badge></TD>
                <TD align="end" className="tnum">{j.statut === "EN_COURS" ? `${j.nbTraitees}/${j.nbLignes}` : j.nbLignes}</TD>
                <TD align="end" className="tnum">{j.nbErreurs}</TD>
                <TD className="text-body">{j.lancePar ? nomComplet(j.lancePar) ?? "—" : "—"}</TD>
                <TD className="text-[12px] text-soft tnum">{formatDateHeure(j.creeLe, ctx.locale)}</TD>
              </TR>
            ))}</tbody>
          </Table></TableCard>
        )
      ) : null}

      {onglet === "invitations" && gestion ? (
        <section>
          <SectionHeader title={t.invitationsEnAttente} subtitle={t.invitationsMasseAide} action={<InvitationsMasseModal dict={dict} locale={ctx.locale} nb={nonEnvoyees.length} />} />
          {preRemplies.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucuneInvitationMasse}</p> : (
            <ul className="stagger-grid -mx-3 mt-3">
              {preRemplies.map((i) => {
                const nom = `${i.preRempliJson?.prenom ?? ""} ${i.preRempliJson?.nom ?? ""}`.trim();
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-2xl px-3 py-3 transition-colors hover:bg-wash">
                    <Avatar nom={nom || "—"} size={44} />
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block truncate text-[15px] font-bold text-ink">{nom || "—"}</span>
                      <span className="block truncate text-[13px] text-soft" dir="ltr">{i.preRempliJson?.telephone ?? i.preRempliJson?.email ?? "—"}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="neutral">{dict.roles[i.roleCible as keyof typeof dict.roles] ?? i.roleCible}</Badge>
                      {i.lotId ? <span className="text-[12px] text-soft">{dict.invitations.lot} {lotsParId.get(i.lotId) ?? ""}</span> : null}
                    </span>
                    <Badge variant={i.envoyeeLe ? "ok" : "outline"}>{i.envoyeeLe ? `${t.envoyeeLe} ${formatDateHeure(i.envoyeeLe, ctx.locale)}` : t.nonEnvoyee}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
