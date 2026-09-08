/** Espace cabinet (M25) — portefeuille (KPI par copropriété, totaux, tri, alertes), alertes, agenda, équipe, mandats, prestataires, paramètres. Membres du cabinet ; `?cabinet=` quand l'utilisateur en a plusieurs. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { AlerteCabinet, Cabinet, CabinetMandat, CabinetMembre, CabinetPrestataire, EvenementAgendaCabinet, LignePortefeuille, TotauxPortefeuille } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMontant } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { Button } from "../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../components/ui/link-tabs";
import { StatCard } from "../../../../components/ui/stat-card";
import { ProgressBar } from "../../../../components/ui/progress";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { CBuilding, CCoins, CAlert, CWallet } from "../../../../components/ui/color-icons";
import { ExportButtons } from "../../../../components/ui/export-buttons";
import { alerteVariant, mandatVariant } from "../../../../lib/status";
import { CopierPrestataireModal, MandatModal, MembreModal, ParametresCabinetForm, PrestataireModeleModal, RetirerMembreModal, TerminerMandatModal } from "./cabinet-client";
import { ouvrirCopropriete } from "./actions";

type Onglet = "portefeuille" | "alertes" | "agenda" | "membres" | "prestataires" | "parametres";
const ONGLETS: Onglet[] = ["portefeuille", "alertes", "agenda", "membres", "prestataires", "parametres"];
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").cabinet.titre };
}

export default async function CabinetPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ onglet?: string; cabinet?: string; alerte?: string; sort?: string; refus?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const t = dict.cabinet;
  const p = (path: string) => `/${locale}${path}`;
  const cabinetsRes = await apiFetch<Cabinet[]>("/cabinets");
  const cabinets = cabinetsRes.ok ? cabinetsRes.data : [];
  const cabinet = cabinets.find((c) => c.id === sp.cabinet) ?? cabinets[0] ?? null;
  const onglet: Onglet = ONGLETS.includes(sp.onglet as Onglet) ? (sp.onglet as Onglet) : "portefeuille";
  const href = (o: Onglet, q: Record<string, string | undefined> = {}) => { const u = new URLSearchParams({ onglet: o, ...(cabinet ? { cabinet: cabinet.id } : {}) }); for (const [k, v] of Object.entries(q)) if (v) u.set(k, v); return `${p("/cabinet")}?${u.toString()}`; };
  if (!cabinet) {
    return <div className="animate-fade"><PageHeader title={t.titre} subtitle={t.subtitle} /><EmptyState title={t.aucunCabinet} hint={t.aucunCabinetAide} /></div>;
  }
  const admin = cabinet.monRole === "CABINET_ADMIN" || cabinet.monRole === "SUPER_ADMIN";
  const gestion = admin || cabinet.monRole === "CABINET_GESTIONNAIRE";
  const [portRes, alertesRes, agendaRes, membresRes, mandatsRes, prestaRes] = await Promise.all([
    apiFetch<LignePortefeuille[]>(`/cabinets/${cabinet.id}/portefeuille`, { searchParams: { alerte: sp.alerte === "1" ? "1" : undefined, sort: sp.sort } }),
    onglet === "alertes" || onglet === "portefeuille" ? apiFetch<{ items: AlerteCabinet[] }>(`/cabinets/${cabinet.id}/alertes`) : Promise.resolve(null),
    onglet === "agenda" ? apiFetch<{ du: string; au: string; evenements: EvenementAgendaCabinet[] }>(`/cabinets/${cabinet.id}/agenda`, { searchParams: { jours: 60 } }) : Promise.resolve(null),
    onglet === "membres" || onglet === "portefeuille" ? apiFetch<CabinetMembre[]>(`/cabinets/${cabinet.id}/membres`) : Promise.resolve(null),
    onglet === "membres" || onglet === "portefeuille" ? apiFetch<CabinetMandat[]>(`/cabinets/${cabinet.id}/coproprietes`) : Promise.resolve(null),
    onglet === "prestataires" ? apiFetch<CabinetPrestataire[]>(`/cabinets/${cabinet.id}/prestataires`) : Promise.resolve(null),
  ]);
  const lignes = portRes.ok ? portRes.data : [];
  const meta = portRes.ok ? (portRes.meta as { totaux?: TotauxPortefeuille; calcule_le?: string | null }) : {};
  const totaux = meta.totaux;
  const alertes = alertesRes?.ok ? alertesRes.data.items : [];
  const membres = membresRes?.ok ? membresRes.data : [];
  const mandats = mandatsRes?.ok ? mandatsRes.data : [];
  const gestionnaires = membres.filter((m) => m.actif && (m.role === "CABINET_ADMIN" || m.role === "CABINET_GESTIONNAIRE")).map((m) => ({ id: m.utilisateurId, nom: `${m.prenom ?? ""} ${m.nom ?? ""}`.trim() || m.utilisateurId.slice(0, 8) }));
  const nomMembre = (id: string | null) => { const m = membres.find((x) => x.utilisateurId === id); return m ? `${m.prenom ?? ""} ${m.nom ?? ""}`.trim() : "—"; };
  const tauxTone = (x: number | null) => (x === null ? "neutral" : x >= 80 ? "ok" : x >= 60 ? "warn" : "danger");
  const Ouvrir = ({ coproId, next, label }: { coproId: string; next?: string; label?: string }) => (
    <form action={ouvrirCopropriete}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="copropriete_id" value={coproId} /><input type="hidden" name="next" value={next ?? "/tableau-de-bord"} /><Button type="submit" variant="ghost" size="sm">{label ?? t.ouvrir}</Button></form>
  );

  return (
    <div className="animate-fade">
      <PageHeader
        title={cabinet.nom}
        subtitle={t.subtitle}
        badge={cabinet.monRole ? <Badge variant="outline">{cabinet.monRole === "SUPER_ADMIN" ? dict.roles.SUPER_ADMIN : t.roles[cabinet.monRole]}</Badge> : undefined}
        actions={<div className="flex flex-wrap gap-2">
          {cabinets.length > 1 ? <div className="flex flex-wrap gap-1">{cabinets.map((c) => <Link key={c.id} href={`${p("/cabinet")}?cabinet=${c.id}&onglet=${onglet}`} className={`rounded-full border px-3 py-1 text-[12.5px] ${c.id === cabinet.id ? "border-ink bg-ink text-white" : "border-hairline text-body hover:bg-hover"}`}>{c.nom}</Link>)}</div> : null}
          {onglet === "portefeuille" ? <ExportButtons ressource="portefeuille" filtres={{ cabinet_id: cabinet.id }} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx }} size="sm" /> : null}
          {onglet === "membres" && admin ? <><MembreModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} /><MandatModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} gestionnaires={gestionnaires} /></> : null}
          {onglet === "prestataires" && gestion ? <PrestataireModeleModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} /> : null}
        </div>}
      />
      {sp.refus === "1" ? <Banner variant="danger" className="mb-4">{dict.common.forbidden ?? t.chargementImpossible}</Banner> : null}
      {!portRes.ok ? <Banner variant="danger" className="mb-4">{t.chargementImpossible}</Banner> : null}
      <LinkTabs className="mb-5" tabs={ONGLETS.filter((o) => (o === "parametres" ? admin : true)).map((o) => ({ href: href(o), label: t.onglets[o], active: o === onglet, count: o === "alertes" ? (alertes.length || undefined) : undefined }))} />

      {onglet === "portefeuille" ? (
        <div className="space-y-5">
          {totaux ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={<CBuilding />} tone="sage" label={t.coproprietes} value={String(totaux.coproprietes)} hint={`${totaux.lots} ${t.lots.toLowerCase()}`} />
              <StatCard icon={<CCoins />} tone={tauxTone(totaux.taux_recouvrement) === "ok" ? "sage" : "warn"} label={t.recouvrement} value={totaux.taux_recouvrement === null ? "—" : `${totaux.taux_recouvrement} %`} hint={`${formatMontant(totaux.encaisse)} / ${formatMontant(totaux.appele)} MAD`} />
              <StatCard icon={<CAlert />} tone={totaux.alertes > 0 ? "warn" : "sage"} label={t.impayes} value={`${formatMontant(totaux.impayes)} MAD`} hint={`${totaux.alertes} ${t.alertes.toLowerCase()}`} />
              <StatCard icon={<CWallet />} tone="tosca" label={t.honoraires} value={`${formatMontant(totaux.honoraires_mensuels)} MAD`} />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href("portefeuille")} className={`rounded-full border px-3 py-1 text-[12.5px] ${sp.alerte !== "1" ? "border-ink bg-ink text-white" : "border-hairline text-body"}`}>{t.toutes}</Link>
            <Link href={href("portefeuille", { alerte: "1" })} className={`rounded-full border px-3 py-1 text-[12.5px] ${sp.alerte === "1" ? "border-ink bg-ink text-white" : "border-hairline text-body"}`}>{t.seulementAlertes}</Link>
            {meta.calcule_le ? <span className="ms-auto text-[12px] text-faint">{fill(t.calculeLe, { date: formatDateHeure(meta.calcule_le, ctx.locale) })}</span> : null}
          </div>
          {lignes.length === 0 ? <EmptyState title={t.aucuneCopropriete} hint={admin ? t.aucuneCoproprieteAide : undefined} /> : (
            <TableCard><Table>
              <THead>
                <TH><Link href={href("portefeuille", { sort: sp.sort === "nom:asc" ? "nom:desc" : "nom:asc", alerte: sp.alerte })}>{t.coproprietes}</Link></TH>
                <TH align="end">{t.lots}</TH>
                <TH><Link href={href("portefeuille", { sort: sp.sort === "taux_recouvrement:asc" ? "taux_recouvrement:desc" : "taux_recouvrement:asc", alerte: sp.alerte })}>{t.recouvrement}</Link></TH>
                <TH align="end"><Link href={href("portefeuille", { sort: sp.sort === "impayes_montant:desc" ? "impayes_montant:asc" : "impayes_montant:desc", alerte: sp.alerte })}>{t.impayes}</Link></TH>
                <TH align="end">{t.justificatifs}</TH>
                <TH align="end"><Link href={href("portefeuille", { sort: sp.sort === "incidents_ouverts:desc" ? "incidents_ouverts:asc" : "incidents_ouverts:desc", alerte: sp.alerte })}>{t.incidents}</Link></TH>
                <TH align="end"><Link href={href("portefeuille", { sort: sp.sort === "taches_retard:desc" ? "taches_retard:asc" : "taches_retard:desc", alerte: sp.alerte })}>{t.taches}</Link></TH>
                <TH><Link href={href("portefeuille", { sort: sp.sort === "prochaine_ag:asc" ? "prochaine_ag:desc" : "prochaine_ag:asc", alerte: sp.alerte })}>{t.prochaineAg}</Link></TH>
                <TH>{t.assurance}</TH>
                <TH>{t.gestionnaire}</TH>
                <TH align="end" />
              </THead>
              <tbody>{lignes.map((l) => (
                <TR key={l.mandat_id}>
                  <TD>
                    <p className="font-medium text-ink-strong">{l.nom}</p>
                    <p className="text-[12px] text-soft">{l.ville}{l.alertes.length ? <span className="ms-1.5 inline-flex gap-1">{l.alertes.map((a) => <Badge key={a} variant={a === "ASSURANCE_ABSENTE" || a === "INCIDENTS_URGENTS" ? "danger" : "warn"}>{fill(t.codesAlerte[a], { v: a === "RECOUVREMENT_FAIBLE" ? (l.taux_recouvrement ?? 0) : a === "TACHES_EN_RETARD" ? l.taches_retard : a === "JUSTIFICATIFS_EN_ATTENTE" ? l.justificatifs_en_attente : l.incidents_urgents })}</Badge>)}</span> : null}</p>
                  </TD>
                  <TD align="end" className="tnum">{l.nb_lots}</TD>
                  <TD><div className="flex items-center gap-2"><div className="w-16"><ProgressBar ratio={(l.taux_recouvrement ?? 0) / 100} tone={tauxTone(l.taux_recouvrement) === "ok" ? "ok" : tauxTone(l.taux_recouvrement) === "warn" ? "warn" : tauxTone(l.taux_recouvrement) === "danger" ? "danger" : "ink"} /></div><span className="tnum text-[13px]">{l.taux_recouvrement === null ? "—" : `${l.taux_recouvrement} %`}</span></div></TD>
                  <TD align="end" className="tnum">{formatMontant(l.impayes_montant)}<span className="block text-[11px] text-faint">{fill(t.impayesLots, { n: l.impayes_nb_lots })}</span></TD>
                  <TD align="end" className="tnum">{l.justificatifs_en_attente}</TD>
                  <TD align="end" className="tnum">{l.incidents_ouverts}{l.incidents_urgents ? <span className="block text-[11px] text-danger">{fill(t.incidentsUrgents, { n: l.incidents_urgents })}</span> : null}</TD>
                  <TD align="end" className={`tnum ${l.taches_retard ? "text-danger" : ""}`}>{l.taches_retard}</TD>
                  <TD className="text-body tnum">{l.prochaine_ag ? formatDate(l.prochaine_ag, ctx.locale) : "—"}</TD>
                  <TD><Badge variant={l.assurance_active ? "ok" : "danger"}>{l.assurance_active ? t.assuranceOk : t.assuranceAbsente}</Badge>{l.contrats_expirant_30j ? <span className="block text-[11px] text-warn">{t.contrats30}: {l.contrats_expirant_30j}</span> : null}</TD>
                  <TD className="text-[12.5px] text-body">{nomMembre(l.gestionnaire_principal_id)}</TD>
                  <TD align="end"><Ouvrir coproId={l.copropriete_id} /></TD>
                </TR>
              ))}</tbody>
            </Table></TableCard>
          )}
        </div>
      ) : null}

      {onglet === "alertes" ? (
        alertes.length === 0 ? <EmptyState title={t.aucuneAlerte} /> : (
          <Card padded={false}><ul className="divide-y divide-hairline">{alertes.map((a, i) => (
            <li key={`${a.code}-${a.copropriete_id}-${i}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Badge variant={alerteVariant[a.niveau]}>{a.niveau === "danger" ? "!" : "•"}</Badge>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink-strong">{fill(t.codesAlerte[a.code], { v: a.valeur ?? "" })}</p><p className="text-[12px] text-soft">{a.copropriete}</p></div>
              <Ouvrir coproId={a.copropriete_id} next={a.lien} label={t.ouvrir} />
            </li>
          ))}</ul></Card>
        )
      ) : null}

      {onglet === "agenda" && agendaRes ? (
        <div className="space-y-3">
          <p className="text-[13px] text-soft">{t.agendaAide} · {agendaRes.ok ? fill(t.jours, { n: 60 }) : ""}</p>
          {!agendaRes.ok || agendaRes.data.evenements.length === 0 ? <EmptyState title={t.aucunEvenement} /> : (
            <Card padded={false}><ul className="divide-y divide-hairline">{agendaRes.data.evenements.map((e) => (
              <li key={`${e.type}-${e.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-24 shrink-0 text-[12.5px] tnum text-soft">{formatDate(e.date, ctx.locale)}</span>
                <Badge variant={e.retard ? "danger" : e.type === "AG" ? "info" : "outline"}>{t.typesEvenement[e.type]}{e.retard ? ` · ${t.enRetard}` : ""}</Badge>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink-strong">{e.titre}</p><p className="text-[12px] text-soft">{e.copropriete}</p></div>
                <Ouvrir coproId={e.copropriete_id} next={e.lien} />
              </li>
            ))}</ul></Card>
          )}
        </div>
      ) : null}

      {onglet === "membres" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeader title={t.membres} subtitle={t.ajouterMembreAide} />
            <ul className="mt-3 divide-y divide-hairline">{membres.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink-strong">{`${m.prenom ?? ""} ${m.nom ?? ""}`.trim() || m.utilisateurId.slice(0, 8)}</p><p className="text-[12px] text-soft">{t.roles[m.role]}{m.nbCoproprietes ? ` · ${fill(t.nbCoproprietes, { n: m.nbCoproprietes })}` : ""}</p></div>
                <Badge variant={m.actif ? "ok" : "neutral"}>{m.actif ? t.actif : t.inactif}</Badge>
                {admin && m.actif ? <span className="inline-flex gap-1"><MembreModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} membre={m} /><RetirerMembreModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} membre={m} /></span> : null}
              </li>
            ))}</ul>
          </Card>
          <Card>
            <SectionHeader title={t.mandats} subtitle={t.proposerMandatAide} />
            {mandats.length === 0 ? <p className="mt-3 text-sm text-soft">{t.aucunMandat}</p> : (
              <ul className="mt-3 divide-y divide-hairline">{mandats.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink-strong">{m.copropriete.nom}</p><p className="text-[12px] text-soft tnum">{formatDate(m.dateDebutMandat, ctx.locale)}{m.dateFinMandat ? ` → ${formatDate(m.dateFinMandat, ctx.locale)}` : ""} · {nomMembre(m.gestionnairePrincipalId)}{m.honorairesMensuels ? ` · ${formatMontant(m.honorairesMensuels)} MAD` : ""}</p></div>
                  <Badge variant={mandatVariant[m.statut]}>{t.statuts[m.statut]}</Badge>
                  {admin && m.actif ? <span className="inline-flex gap-1"><MandatModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} gestionnaires={gestionnaires} mandat={m} /><TerminerMandatModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} mandat={m} /></span> : null}
                </li>
              ))}</ul>
            )}
          </Card>
        </div>
      ) : null}

      {onglet === "prestataires" ? (
        (prestaRes?.ok ? prestaRes.data : []).length === 0 ? <EmptyState title={t.aucunPrestataire} hint={t.prestatairesAide} /> : (
          <TableCard><Table>
            <THead><TH>{t.nom}</TH><TH>{t.specialite}</TH><TH>{t.telephone}</TH><TH>{t.email}</TH><TH align="end" /></THead>
            <tbody>{(prestaRes?.ok ? prestaRes.data : []).map((x) => (
              <TR key={x.id}><TD className="font-medium text-ink-strong">{x.nom}</TD><TD className="text-body">{x.specialite}</TD><TD className="text-body"><span dir="ltr">{x.telephone ?? "—"}</span></TD><TD className="text-body"><span dir="ltr">{x.email ?? "—"}</span></TD><TD align="end">{gestion ? <CopierPrestataireModal dict={dict} locale={ctx.locale} cabinetId={cabinet.id} modele={x} coproprietes={lignes.map((l) => ({ id: l.copropriete_id, nom: l.nom }))} /> : null}</TD></TR>
            ))}</tbody>
          </Table></TableCard>
        )
      ) : null}

      {onglet === "parametres" && admin ? <Card><SectionHeader title={t.parametres} /><div className="mt-4"><ParametresCabinetForm dict={dict} locale={ctx.locale} cabinet={cabinet} /></div></Card> : null}
    </div>
  );
}
