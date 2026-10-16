"use client";

/**
 * M29 — ouverture d'un abonnement : client (existant ou nouveau), résidences couvertes, formule,
 * lots, essai gratuit (30 j par défaut). Le prix de la grille s'affiche en direct (calcul côté
 * API, jamais dans le navigateur) ; laisser le prix vide = prix de la grille.
 */
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Field, Input, Select, Textarea } from "../../../../../../components/ui/field";
import { Checkbox, RadioGroup } from "../../../../../../components/ui/toggle";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { Banner } from "../../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import type { ClientFacturation, Formule, Periodicite, ResidenceAdmin, TarifSuggere } from "../../../../../../lib/api/console-types";
import { creerAbonnementAction, simulerTarifAction } from "../../console-actions";

export function NouvelAbonnementForm({
  dict,
  locale,
  clients,
  residences,
  preselection,
  clientPreselectionne,
  aujourdHui,
}: {
  dict: Dict;
  locale: Locale;
  clients: ClientFacturation[];
  residences: ResidenceAdmin[];
  preselection: string | null;
  clientPreselectionne: string | null;
  aujourdHui: string;
}) {
  const c = dict.console;
  const [state, action] = useActionState(creerAbonnementAction, IDLE);
  const [modeClient, setModeClient] = useState(clientPreselectionne || (clients.length > 0 && !preselection) ? "existant" : "nouveau");
  const [selection, setSelection] = useState<string[]>(preselection ? [preselection] : []);
  const [formule, setFormule] = useState<Formule>("STANDARD");
  const [periodicite, setPeriodicite] = useState<Periodicite>("ANNUELLE");
  const [fondateur, setFondateur] = useState(true);
  const [essai, setEssai] = useState(true);
  const lotsSelection = useMemo(
    () => residences.filter((r) => selection.includes(r.id)).reduce((n, r) => n + Math.max(r.lots_reels, r.nb_lots_declares), 0),
    [residences, selection]
  );
  const [lots, setLots] = useState<number>(lotsSelection || 0);
  const [lotsTouche, setLotsTouche] = useState(false);
  useEffect(() => {
    if (!lotsTouche) setLots(lotsSelection);
  }, [lotsSelection, lotsTouche]);

  const [tarif, setTarif] = useState<TarifSuggere | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => {
    const t = window.setTimeout(() => {
      startTransition(async () => setTarif(await simulerTarifAction({ formule, lots, periodicite, fondateur })));
    }, 250);
    return () => window.clearTimeout(t);
  }, [formule, lots, periodicite, fondateur]);

  const nomResidence = residences.find((r) => r.id === preselection)?.nom ?? "";
  const formules: Formule[] = ["ESSENTIEL", "STANDARD", "PRESTIGE", "CABINET"];

  return (
    <form action={action} className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="mode_client" value={modeClient} />

      {/* ── Client ─────────────────────────────────────────── */}
      <Card className="space-y-4">
        <SectionHeader title={c.client} />
        <RadioGroup
          name="_mode_client"
          value={modeClient}
          onChange={setModeClient}
          options={[
            { value: "existant", label: c.clientExistant, disabled: clients.length === 0 },
            { value: "nouveau", label: c.nouveauClient },
          ]}
        />
        {modeClient === "existant" ? (
          <Field label={c.choisirClient} htmlFor="client_id" required>
            <Select id="client_id" name="client_id" defaultValue={clientPreselectionne ?? ""} required>
              <option value="" disabled>—</option>
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.nom} · {c.typesClient[cl.type]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="space-y-4">
            <Field label={c.typeClient} htmlFor="nc_type" required>
              <Select id="nc_type" name="nc_type" defaultValue={formule === "CABINET" ? "CABINET" : "SYNDICAT"}>
                <option value="SYNDICAT">{c.typesClient.SYNDICAT}</option>
                <option value="CABINET">{c.typesClient.CABINET}</option>
              </Select>
            </Field>
            <Field label={c.nomClient} htmlFor="nc_nom" required error={fieldError(state, "nouveau_client.nom")}>
              <Input id="nc_nom" name="nc_nom" required maxLength={200} defaultValue={nomResidence ? `Syndicat ${nomResidence}` : ""} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.contactNom} htmlFor="nc_contact_nom">
                <Input id="nc_contact_nom" name="nc_contact_nom" maxLength={200} />
              </Field>
              <Field label={c.contactTelephone} htmlFor="nc_contact_telephone" error={fieldError(state, "nouveau_client.contact_telephone")}>
                <Input id="nc_contact_telephone" name="nc_contact_telephone" inputMode="tel" maxLength={20} />
              </Field>
            </div>
            <Field label={c.contactEmail} htmlFor="nc_contact_email" error={fieldError(state, "nouveau_client.contact_email")}>
              <Input id="nc_contact_email" name="nc_contact_email" type="email" maxLength={200} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.raisonSociale} htmlFor="nc_raison_sociale">
                <Input id="nc_raison_sociale" name="nc_raison_sociale" maxLength={200} />
              </Field>
              <Field label={c.ice} htmlFor="nc_ice" error={fieldError(state, "nouveau_client.ice")}>
                <Input id="nc_ice" name="nc_ice" inputMode="numeric" maxLength={15} className="tnum" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.adresse} htmlFor="nc_adresse">
                <Input id="nc_adresse" name="nc_adresse" maxLength={300} />
              </Field>
              <Field label={c.ville} htmlFor="nc_ville">
                <Input id="nc_ville" name="nc_ville" maxLength={100} />
              </Field>
            </div>
          </div>
        )}

        <SectionHeader title={c.choisirResidences} subtitle={c.residencesAide} className="pt-2" />
        <div className="max-h-72 space-y-2.5 overflow-y-auto pe-1 scroll-thin">
          {residences.map((r) => {
            const couverte = Boolean(r.abonnement);
            return (
              <Checkbox
                key={r.id}
                name="copropriete_ids"
                value={r.id}
                disabled={couverte}
                checked={selection.includes(r.id)}
                onChange={(e) => setSelection((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                label={r.nom}
                hint={`${r.ville} · ${Math.max(r.lots_reels, r.nb_lots_declares)} lots${couverte ? ` · ${c.dejaCouverte}` : ""}`}
              />
            );
          })}
        </div>
        {fieldError(state, "copropriete_ids") ? <p className="text-[13px] text-danger">{fieldError(state, "copropriete_ids")}</p> : null}
      </Card>

      {/* ── Offre ─────────────────────────────────────────── */}
      <Card className="space-y-4">
        <SectionHeader title={c.conditions} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.formule} htmlFor="formule" required>
            <Select id="formule" name="formule" value={formule} onChange={(e) => setFormule(e.target.value as Formule)}>
              {formules.map((f) => (
                <option key={f} value={f}>{c.formules[f]}</option>
              ))}
            </Select>
          </Field>
          <Field label={c.periodicite} htmlFor="periodicite" required>
            <Select id="periodicite" name="periodicite" value={periodicite} onChange={(e) => setPeriodicite(e.target.value as Periodicite)}>
              <option value="ANNUELLE">{c.periodicites.ANNUELLE}</option>
              <option value="MENSUELLE">{c.periodicites.MENSUELLE}</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.lotsContractes} htmlFor="lots_contractes" required error={fieldError(state, "lots_contractes")}>
            <Input
              id="lots_contractes"
              name="lots_contractes"
              type="number"
              min={1}
              max={100000}
              required
              className="tnum"
              value={lots || ""}
              onChange={(e) => {
                setLotsTouche(true);
                setLots(Number(e.target.value));
              }}
            />
          </Field>
          <Field label={c.prixPersonnalise} htmlFor="prix_lot" error={fieldError(state, "prix_lot")}>
            <Input id="prix_lot" name="prix_lot" inputMode="decimal" placeholder={tarif?.prix_lot ?? ""} className="tnum" />
          </Field>
        </div>
        {formule !== "CABINET" ? (
          <Checkbox name="tarif_fondateur" checked={fondateur} onChange={(e) => setFondateur(e.target.checked)} label={c.tarifFondateur} />
        ) : null}
        {tarif ? (
          <Banner variant="info" title={fill(c.grilleEstime, { prix: tarif.prix_lot, base: tarif.base_prix, mensuel: tarif.mensuel_estime })}>
            {tarif.repere_charges ? fill(c.repereCharges, { charges: tarif.repere_charges }) : null}
          </Banner>
        ) : null}

        <SectionHeader title={c.essaiGratuit} className="pt-2" />
        <input type="hidden" name="essai" value={essai ? "oui" : "non"} />
        <RadioGroup
          name="_essai"
          value={essai ? "oui" : "non"}
          onChange={(v) => setEssai(v === "oui")}
          options={[
            { value: "oui", label: c.essaiGratuit, hint: c.essaiAide },
            { value: "non", label: c.sansEssai },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.dateDebut} htmlFor="date_debut" required error={fieldError(state, "date_debut")}>
            <Input id="date_debut" name="date_debut" type="date" required defaultValue={aujourdHui} />
          </Field>
          {essai ? (
            <Field label={c.finEssaiPerso} htmlFor="fin_essai">
              <Input id="fin_essai" name="fin_essai" type="date" />
            </Field>
          ) : (
            <Field label={c.finPeriodeInitiale} htmlFor="fin_periode" hint={c.finPeriodeAide}>
              <Input id="fin_periode" name="fin_periode" type="date" />
            </Field>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.delaiGrace} htmlFor="delai_grace_jours" hint={c.delaiGraceAide}>
            <Input id="delai_grace_jours" name="delai_grace_jours" type="number" min={0} max={90} defaultValue={15} className="tnum" />
          </Field>
          <Field label={c.forfaitAccompagne} htmlFor="forfait_accompagne" hint={tarif ? `${tarif.forfait_accompagne_suggere} MAD` : undefined}>
            <Input id="forfait_accompagne" name="forfait_accompagne" inputMode="decimal" className="tnum" />
          </Field>
        </div>
        <Field label={c.notes} htmlFor="notes">
          <Textarea id="notes" name="notes" rows={2} maxLength={2000} />
        </Field>
        <FormAlert state={state} />
        <div className="flex justify-end">
          <SubmitButton>{c.creer}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
