import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { AbonnementDetail, EvenementAbonnement, ResidenceAdmin } from "../../../../../../lib/api/console-types";
import { getDict, isLocale, fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import { formatDate, formatDateCourte, formatDateHeure } from "../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { StatCard } from "../../../../../../components/ui/stat-card";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { Amount } from "../../../../../../components/ui/amount";
import { Field, Input, Select, Textarea } from "../../../../../../components/ui/field";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../../components/ui/table";
import { IconCalendar, IconPlus, IconReceipt, IconWallet } from "../../../../../../components/ui/icons";
import { CBuilding, CCoins, CCalendar, CChart } from "../../../../../../components/ui/color-icons";
import { FormModal } from "../../console-ui";
import {
  actionAbonnementAction,
  annulerFactureAction,
  emettreFactureAction,
  enregistrerPaiementAction,
  modifierConditionsAction,
  rattacherCoproAction,
  retirerCoproAction,
} from "../../console-actions";
import { Echeance, EtatBadge, factureVariant } from "../../console-common";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.abonnement };
}

const aujourdHui = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());

/** Résumé lisible d'un événement du journal (détails techniques → une ligne). */
function detailEvenement(e: EvenementAbonnement, dict: Dict, locale: Locale): string | null {
  const d = (e.details ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  const parts = [
    s("numero") ?? s("facture"),
    s("motif"),
    s("fin_periode") ? `→ ${formatDateCourte(s("fin_periode"), locale)}` : null,
    s("jusqu_au") ? `→ ${formatDateCourte(s("jusqu_au"), locale)}` : null,
    s("apres") && e.type === "ESSAI_PROLONGE" ? `→ ${formatDateCourte(s("apres"), locale)}` : null,
    s("montant") ? `${s("montant")} MAD` : null,
    s("montant_ttc") ? `${s("montant_ttc")} MAD TTC` : null,
    s("mode") ? dict.console.modes[s("mode") as keyof Dict["console"]["modes"]] ?? null : null,
    s("nom"),
    s("titre"),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export default async function AbonnementDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const L = ctx.locale;
  const p = (path: string) => `/${L}${path}`;

  const [res, residencesRes] = await Promise.all([
    apiFetch<AbonnementDetail>(`/admin/abonnements/${id}`),
    apiFetch<ResidenceAdmin[]>("/admin/coproprietes"),
  ]);
  if (!res.ok) notFound();
  const a = res.data;
  const libres = (residencesRes.ok ? residencesRes.data : []).filter((r) => !r.abonnement && r.statut === "ACTIVE");
  const ferme = a.statut === "RESILIE";
  const base = { locale: L, abonnement_id: a.id };
  const du = a.factures.filter((f) => f.statut === "EMISE");

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={p("/admin/abonnements")} label={c.nav.abonnements} />}
        title={a.client.nom}
        badge={<EtatBadge etat={a.etat} dict={dict} />}
        subtitle={`${c.formules[a.formule]}${a.tarif_fondateur ? " ★" : ""} · ${c.periodicites[a.periodicite]} · ${a.coproprietes.map((r) => r.nom).join(", ") || "—"}`}
        actions={
          ferme ? null : (
            <FormModal
              label={c.emettreFacture}
              icon={<IconReceipt width={16} height={16} />}
              variant="primary"
              size="md"
              title={c.emettreFacture}
              subtitle={fill(c.prochainePeriode, { debut: formatDate(a.prochaine_periode.debut, L), fin: formatDate(a.prochaine_periode.fin, L) })}
              action={emettreFactureAction}
              hidden={{ ...base, succes: c.factureEmise }}
              submitLabel={c.emettreFacture}
              closeLabel={dict.common.close}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={c.lotsAFacturer} htmlFor="f_lots" hint={c.lotsAFacturerAide}>
                  <Input id="f_lots" name="lots" type="number" min={1} placeholder={String(Math.max(a.lots_contractes, a.lots_reels))} className="tnum" />
                </Field>
                <Field label={c.echeanceJours} htmlFor="f_ech">
                  <Input id="f_ech" name="echeance_jours" type="number" min={0} max={90} defaultValue={15} className="tnum" />
                </Field>
              </div>
              <Field label={c.periode} htmlFor="f_debut">
                <Input id="f_debut" name="periode_debut" type="date" defaultValue={a.prochaine_periode.debut} />
              </Field>
              <p className="text-[13px] font-semibold text-ink">{c.ligneSup}</p>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Field label={c.libelle} htmlFor="f_lib">
                  <Input id="f_lib" name="ligne_libelle" maxLength={200} />
                </Field>
                <Field label={`${c.montant} (${a.base_prix})`} htmlFor="f_mt">
                  <Input id="f_mt" name="ligne_montant" inputMode="decimal" className="tnum" />
                </Field>
              </div>
            </FormModal>
          )
        }
      />

      {a.etat.niveau === "BLOQUE" ? (
        <Banner variant="danger" className="mb-6" title={c.etats[a.etat.etat]}>
          {a.motif_suspension ?? a.motif_resiliation ?? (a.etat.date_blocage ? `${c.coupure} ${formatDate(a.etat.date_blocage, L)}` : null)}
        </Banner>
      ) : a.etat.niveau === "GRACE" ? (
        <Banner variant="warn" className="mb-6" title={c.etats[a.etat.etat]}>
          {a.etat.date_blocage ? `${c.coupure} ${formatDate(a.etat.date_blocage, L)}` : null}
          {a.motif_prolongation ? ` · ${a.motif_prolongation}` : null}
        </Banner>
      ) : a.acces_prolonge_jusqu_au ? (
        <Banner variant="info" className="mb-6" title={fill(c.accesProlonge, { date: formatDate(a.acces_prolonge_jusqu_au, L) })}>
          {a.motif_prolongation}
        </Banner>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CCalendar />}
          tone="sage"
          label={a.statut === "ESSAI" ? c.finEssai : c.finPeriode}
          value={a.etat.echeance ? formatDateCourte(a.etat.echeance, L) : "—"}
          hint={<Echeance etat={a.etat} dict={dict} />}
        />
        <StatCard icon={<CChart />} tone="lilac" label={c.mensuelHt} value={<Amount value={a.mensuel_ht} locale={L} />} hint={`${a.prix_lot} MAD ${a.base_prix} / lot`} />
        <StatCard
          icon={<CBuilding />}
          tone={a.depassement_lots ? "warn" : "sand"}
          label={c.lotsContractes}
          value={a.lots_contractes}
          hint={`${c.lotsReels} : ${a.lots_reels}`}
        />
        <StatCard
          icon={<CCoins />}
          tone={du.length ? "warn" : "ok"}
          label={c.resteDu}
          value={<Amount value={a.du_ttc ?? "0.00"} locale={L} />}
          hint={fill(c.facturesOuvertesNb, { n: du.length })}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* ── Factures ───────────────────────── */}
          <section>
            <SectionHeader title={c.facturesTitre} className="mb-3" />
            {a.factures.length === 0 ? (
              <Card>
                <p className="text-[14px] text-soft">{c.aucuneFacture}</p>
              </Card>
            ) : (
              <TableCard>
                <Table>
                  <THead>
                    <TH>{c.numero}</TH>
                    <TH>{c.periode}</TH>
                    <TH align="end">{c.ttc}</TH>
                    <TH align="end">{c.paye}</TH>
                    <TH>{c.etat}</TH>
                    <TH align="end" />
                  </THead>
                  <tbody>
                    {a.factures.map((f) => (
                      <TR key={f.id}>
                        <TD>
                          <Link href={p(`/admin/factures/${f.id}`)} className="font-mono text-[13px] font-semibold text-link">
                            {f.numero}
                          </Link>
                          <span className="block text-[12px] text-soft">{formatDateCourte(f.emise_le, L)}</span>
                        </TD>
                        <TD className="text-[13px] text-body">
                          {formatDateCourte(f.periode_debut, L)} → {formatDateCourte(f.periode_fin, L)}
                        </TD>
                        <TD align="end">
                          <Amount value={f.montant_ttc} locale={L} className="text-[14px] font-semibold" />
                        </TD>
                        <TD align="end">
                          <Amount value={f.paye} locale={L} className="text-[14px] text-soft" />
                        </TD>
                        <TD>
                          <Badge variant={f.en_retard ? "danger" : factureVariant[f.statut]}>{f.en_retard ? c.enRetard : c.statutsFacture[f.statut]}</Badge>
                        </TD>
                        <TD align="end">
                          {f.statut === "EMISE" ? (
                            <div className="flex justify-end gap-1">
                              <FormModal
                                label={c.enregistrerPaiement}
                                icon={<IconWallet width={14} height={14} />}
                                variant="secondary"
                                title={c.enregistrerPaiement}
                                subtitle={`${f.numero} · ${c.ttc} ${f.montant_ttc} MAD`}
                                action={enregistrerPaiementAction}
                                hidden={{ locale: L, facture_id: f.id, cle: randomUUID(), succes: c.paiementEnregistre, succes_solde: c.paiementSolde }}
                                submitLabel={c.enregistrerPaiement}
                                closeLabel={dict.common.close}
                              >
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Field label={c.montant} htmlFor={`m_${f.id}`} required>
                                    <Input id={`m_${f.id}`} name="montant" inputMode="decimal" required className="tnum" defaultValue={f.paye === "0.00" ? f.montant_ttc : ""} />
                                  </Field>
                                  <Field label={c.recuLe} htmlFor={`r_${f.id}`} required>
                                    <Input id={`r_${f.id}`} name="recu_le" type="date" required defaultValue={aujourdHui()} />
                                  </Field>
                                </div>
                                <Field label={c.mode} htmlFor={`mo_${f.id}`} required>
                                  <Select id={`mo_${f.id}`} name="mode" defaultValue="VIREMENT">
                                    {(Object.keys(c.modes) as (keyof typeof c.modes)[]).map((m) => (
                                      <option key={m} value={m}>{c.modes[m]}</option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field label={c.reference} htmlFor={`ref_${f.id}`}>
                                  <Input id={`ref_${f.id}`} name="reference" maxLength={120} />
                                </Field>
                              </FormModal>
                              {f.paiements.length === 0 ? (
                                <FormModal
                                  label={c.annuler}
                                  variant="dangerGhost"
                                  title={c.annulerFacture}
                                  subtitle={f.numero}
                                  action={annulerFactureAction}
                                  hidden={{ locale: L, facture_id: f.id, succes: c.factureAnnulee }}
                                  submitLabel={c.annulerFacture}
                                  submitVariant="danger"
                                  closeLabel={dict.common.close}
                                >
                                  <Field label={c.motif} htmlFor={`am_${f.id}`} required>
                                    <Input id={`am_${f.id}`} name="motif" required maxLength={500} />
                                  </Field>
                                </FormModal>
                              ) : null}
                            </div>
                          ) : (
                            <Link href={p(`/admin/factures/${f.id}`)} className="text-[13px] font-semibold text-link">
                              {c.voir}
                            </Link>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableCard>
            )}
          </section>

          {/* ── Journal ───────────────────────── */}
          <Card>
            <SectionHeader title={c.journalTitre} className="mb-4" />
            <ol className="relative space-y-4 border-s border-hairline ps-5">
              {a.evenements.map((e) => {
                const detail = detailEvenement(e, dict, L);
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute -start-[25px] top-1.5 size-2.5 rounded-full bg-link ring-4 ring-surface" aria-hidden />
                    <p className="text-[14px] font-semibold text-ink">{c.evenements[e.type]}</p>
                    {detail ? <p className="text-[13px] text-body">{detail}</p> : null}
                    <p className="text-[12px] text-soft">
                      {formatDateHeure(e.horodatage, L)} · {e.acteur ? fill(c.par, { nom: e.acteur }) : c.systeme}
                    </p>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          {/* ── Actions ───────────────────────── */}
          {!ferme ? (
            <Card className="space-y-3">
              <SectionHeader title={c.actions} />
              <div className="flex flex-col items-stretch gap-2 [&>button]:justify-start">
                {a.statut === "ESSAI" ? (
                  <FormModal label={c.prolongerEssai} icon={<IconCalendar width={15} height={15} />} variant="ghost" title={c.prolongerEssai} action={actionAbonnementAction} hidden={{ ...base, action: "PROLONGER_ESSAI", succes: c.actionFaite }} submitLabel={c.confirmer} closeLabel={dict.common.close}>
                    <Field label={c.nouvelleFinEssai} htmlFor="pe_fin" required>
                      <Input id="pe_fin" name="fin_essai" type="date" required defaultValue={a.fin_essai ?? ""} />
                    </Field>
                    <Field label={c.motif} htmlFor="pe_motif">
                      <Input id="pe_motif" name="motif" maxLength={500} />
                    </Field>
                  </FormModal>
                ) : null}
                <FormModal label={c.accorderDelai} icon={<IconCalendar width={15} height={15} />} variant="ghost" title={c.accorderDelai} subtitle={c.accorderDelaiAide} action={actionAbonnementAction} hidden={{ ...base, action: "ACCORDER_DELAI", succes: c.actionFaite }} submitLabel={c.confirmer} closeLabel={dict.common.close}>
                  <Field label={c.jusquAu} htmlFor="ad_date" required>
                    <Input id="ad_date" name="jusqu_au" type="date" required defaultValue={a.acces_prolonge_jusqu_au ?? ""} />
                  </Field>
                  <Field label={c.motif} htmlFor="ad_motif" required>
                    <Input id="ad_motif" name="motif" required maxLength={500} defaultValue={a.motif_prolongation ?? ""} />
                  </Field>
                </FormModal>
                {a.acces_prolonge_jusqu_au ? (
                  <FormModal label={c.retirerDelai} variant="ghost" title={c.retirerDelai} action={actionAbonnementAction} hidden={{ ...base, action: "RETIRER_DELAI", succes: c.actionFaite }} submitLabel={c.confirmer} closeLabel={dict.common.close} />
                ) : null}
                <FormModal label={c.activer} icon={<IconPlus width={15} height={15} />} variant="ghost" title={c.activer} subtitle={c.activerAide} action={actionAbonnementAction} hidden={{ ...base, action: "ACTIVER", succes: c.actionFaite }} submitLabel={c.confirmer} closeLabel={dict.common.close}>
                  <Field label={c.payeJusquAu} htmlFor="ac_fin" required>
                    <Input id="ac_fin" name="fin_periode" type="date" required />
                  </Field>
                  <Field label={c.motif} htmlFor="ac_motif">
                    <Input id="ac_motif" name="motif" maxLength={500} />
                  </Field>
                </FormModal>
                {a.statut === "SUSPENDU" ? (
                  <FormModal label={c.reactiver} variant="secondary" title={c.reactiver} action={actionAbonnementAction} hidden={{ ...base, action: "REACTIVER", succes: c.actionFaite }} submitLabel={c.reactiver} closeLabel={dict.common.close}>
                    <Field label={c.motif} htmlFor="re_motif">
                      <Input id="re_motif" name="motif" maxLength={500} />
                    </Field>
                  </FormModal>
                ) : (
                  <FormModal label={c.suspendre} variant="dangerGhost" title={c.suspendre} subtitle={c.suspendreAide} action={actionAbonnementAction} hidden={{ ...base, action: "SUSPENDRE", succes: c.actionFaite }} submitLabel={c.suspendre} submitVariant="danger" closeLabel={dict.common.close}>
                    <Field label={c.motif} htmlFor="su_motif" required>
                      <Input id="su_motif" name="motif" required maxLength={500} />
                    </Field>
                  </FormModal>
                )}
                <FormModal label={c.resilier} variant="dangerGhost" title={c.resilier} subtitle={c.resilierAide} action={actionAbonnementAction} hidden={{ ...base, action: "RESILIER", succes: c.actionFaite }} submitLabel={c.resilier} submitVariant="danger" closeLabel={dict.common.close}>
                  <Field label={c.motif} htmlFor="rs_motif" required>
                    <Input id="rs_motif" name="motif" required maxLength={500} />
                  </Field>
                </FormModal>
              </div>
            </Card>
          ) : null}

          {/* ── Conditions ───────────────────────── */}
          <Card className="space-y-4">
            <SectionHeader
              title={c.conditions}
              action={
                ferme ? null : (
                  <FormModal label={c.modifierConditions} title={c.modifierConditions} action={modifierConditionsAction} hidden={{ ...base, succes: c.conditionsModifiees }} submitLabel={c.confirmer} closeLabel={dict.common.close}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={c.formule} htmlFor="mc_formule">
                        <Select id="mc_formule" name="formule" defaultValue={a.formule}>
                          {(Object.keys(c.formules) as (keyof typeof c.formules)[]).map((f) => (
                            <option key={f} value={f}>{c.formules[f]}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={c.periodicite} htmlFor="mc_per">
                        <Select id="mc_per" name="periodicite" defaultValue={a.periodicite}>
                          <option value="ANNUELLE">{c.periodicites.ANNUELLE}</option>
                          <option value="MENSUELLE">{c.periodicites.MENSUELLE}</option>
                        </Select>
                      </Field>
                      <Field label={c.lotsContractes} htmlFor="mc_lots">
                        <Input id="mc_lots" name="lots_contractes" type="number" min={1} defaultValue={a.lots_contractes} className="tnum" />
                      </Field>
                      <Field label={`${c.prixLot} (${a.base_prix})`} htmlFor="mc_prix">
                        <Input id="mc_prix" name="prix_lot" inputMode="decimal" defaultValue={a.prix_lot} className="tnum" />
                      </Field>
                      <Field label={c.minimumMensuel} htmlFor="mc_min">
                        <Input id="mc_min" name="minimum_mensuel" inputMode="decimal" defaultValue={a.minimum_mensuel ?? ""} className="tnum" />
                      </Field>
                      <Field label={c.tauxTva} htmlFor="mc_tva">
                        <Input id="mc_tva" name="taux_tva" inputMode="decimal" defaultValue={a.taux_tva} className="tnum" />
                      </Field>
                      <Field label={c.forfaitAccompagne} htmlFor="mc_acc">
                        <Input id="mc_acc" name="forfait_accompagne" inputMode="decimal" defaultValue={a.forfait_accompagne ?? ""} className="tnum" />
                      </Field>
                      <Field label={c.delaiGrace} htmlFor="mc_grace">
                        <Input id="mc_grace" name="delai_grace_jours" type="number" min={0} max={90} defaultValue={a.delai_grace_jours} className="tnum" />
                      </Field>
                      <Field label={c.prixGarantiJusquAu} htmlFor="mc_garanti">
                        <Input id="mc_garanti" name="prix_garanti_jusqu_au" type="date" defaultValue={a.prix_garanti_jusqu_au ?? ""} />
                      </Field>
                    </div>
                    <Field label={c.notes} htmlFor="mc_notes">
                      <Textarea id="mc_notes" name="notes" rows={2} defaultValue={a.notes ?? ""} />
                    </Field>
                  </FormModal>
                )
              }
            />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
              <dt className="text-soft">{c.statuts[a.statut]}</dt>
              <dd className="text-end font-semibold text-ink">{formatDateCourte(a.date_debut, L)}</dd>
              <dt className="text-soft">{c.prixLot}</dt>
              <dd className="text-end font-semibold text-ink tnum">{a.prix_lot} MAD {a.base_prix}</dd>
              {a.minimum_mensuel ? (
                <>
                  <dt className="text-soft">{c.minimumMensuel}</dt>
                  <dd className="text-end text-ink tnum">{a.minimum_mensuel} MAD</dd>
                </>
              ) : null}
              <dt className="text-soft">{c.tauxTva}</dt>
              <dd className="text-end text-ink tnum">{a.taux_tva} %</dd>
              {a.forfait_accompagne ? (
                <>
                  <dt className="text-soft">{c.forfaitAccompagne}</dt>
                  <dd className="text-end text-ink tnum">{a.forfait_accompagne} MAD</dd>
                </>
              ) : null}
              {a.fin_essai ? (
                <>
                  <dt className="text-soft">{c.finEssai}</dt>
                  <dd className="text-end text-ink">{formatDateCourte(a.fin_essai, L)}</dd>
                </>
              ) : null}
              <dt className="text-soft">{c.finPeriode}</dt>
              <dd className="text-end text-ink">{a.fin_periode ? formatDateCourte(a.fin_periode, L) : "—"}</dd>
              <dt className="text-soft">{c.delaiGrace}</dt>
              <dd className="text-end text-ink tnum">{a.delai_grace_jours}</dd>
              {a.prix_garanti_jusqu_au ? (
                <>
                  <dt className="text-soft">{c.prixGarantiJusquAu}</dt>
                  <dd className="text-end text-ink">{formatDateCourte(a.prix_garanti_jusqu_au, L)}</dd>
                </>
              ) : null}
            </dl>
            {a.notes ? <p className="rounded-[14px] bg-tile p-3 text-[13px] text-body">{a.notes}</p> : null}
          </Card>

          {/* ── Résidences ───────────────────────── */}
          <Card className="space-y-3">
            <SectionHeader
              title={c.residences}
              action={
                ferme || libres.length === 0 ? null : (
                  <FormModal label={c.rattacher} icon={<IconPlus width={14} height={14} />} title={c.rattacher} action={rattacherCoproAction} hidden={{ ...base, succes: c.rattachee }} submitLabel={c.rattacher} closeLabel={dict.common.close}>
                    <Field label={c.choisirResidence} htmlFor="rc_copro" required>
                      <Select id="rc_copro" name="copropriete_id" required defaultValue="">
                        <option value="" disabled>—</option>
                        {libres.map((r) => (
                          <option key={r.id} value={r.id}>{r.nom} · {r.ville}</option>
                        ))}
                      </Select>
                    </Field>
                  </FormModal>
                )
              }
            />
            <ul className="divide-y divide-hairline">
              {a.coproprietes.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <Link href={p(`/admin/coproprietes/${r.id}`)} className="min-w-0 flex-1 hover:text-link">
                    <span className="block truncate text-[14px] font-semibold text-ink">{r.nom}</span>
                    <span className="text-[12px] text-soft">{r.ville} · {r.lots_reels} / {r.nb_lots_declares} lots</span>
                  </Link>
                  {!ferme && a.coproprietes.length > 1 ? (
                    <FormModal label={c.retirer} variant="dangerGhost" title={c.retirer} subtitle={r.nom} action={retirerCoproAction} hidden={{ ...base, copropriete_id: r.id, succes: c.retiree }} submitLabel={c.retirer} submitVariant="danger" closeLabel={dict.common.close} />
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          {/* ── Client ───────────────────────── */}
          <Card className="space-y-1.5 text-[14px]">
            <SectionHeader title={c.client} action={<Link href={p(`/admin/clients?ouvrir=${a.client.id}`)} className="text-[14px] font-semibold text-link">{c.voir}</Link>} />
            <p className="font-semibold text-ink">{a.client_fiche.raison_sociale ?? a.client_fiche.nom}</p>
            <p className="text-soft">{c.typesClient[a.client_fiche.type]}</p>
            {a.client_fiche.contact_nom ? <p className="text-body">{a.client_fiche.contact_nom}</p> : null}
            {a.client_fiche.contact_email ? <a className="block text-link" href={`mailto:${a.client_fiche.contact_email}`}>{a.client_fiche.contact_email}</a> : null}
            {a.client_fiche.contact_telephone ? <a className="block text-link" href={`tel:${a.client_fiche.contact_telephone}`}>{a.client_fiche.contact_telephone}</a> : null}
            {a.client_fiche.ice ? <p className="text-[12px] text-soft">ICE {a.client_fiche.ice}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
