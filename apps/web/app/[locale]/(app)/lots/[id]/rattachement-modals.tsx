"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../../components/ui/modal";
import { Field, Input, Select, Checkbox } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { ProgressBar } from "../../../../../components/ui/progress";
import { IDLE } from "../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import { ajouterProprietaire, ajouterOccupant } from "../actions";
import { IconPlus } from "../../../../../components/ui/icons";

interface MembreOption {
  id: string;
  nom: string;
  lots: string[];
}

function SelecteurUtilisateur({
  dict,
  membres,
  name,
}: {
  dict: Dict;
  membres: MembreOption[];
  name: string;
}) {
  return (
    <Field
      label={dict.lots.utilisateur}
      htmlFor={name}
      hint={dict.lots.utilisateurIdAide}
      required
    >
      <>
        <Input
          id={name}
          name={name}
          list={`${name}-membres`}
          dir="ltr"
          required
          pattern="[0-9a-fA-F-]{36}"
          className="font-mono text-[13px] text-start"
          placeholder="00000000-0000-0000-0000-000000000000"
        />
        <datalist id={`${name}-membres`}>
          {membres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom} · {m.lots.join(", ")}
            </option>
          ))}
        </datalist>
      </>
    </Field>
  );
}

/** C4 — ajout d'un propriétaire : la jauge visualise la règle « quote-parts = 100 % ». */
interface LigneProprietaire {
  cle: number;
  utilisateurId: string;
  quote: string;
  representant: boolean;
}

/**
 * C4 — ajout d'un ou plusieurs copropriétaires D'UN BLOC : une indivision (50/50, 33/33/34…)
 * doit être créée en une seule transaction pour satisfaire la règle « quote-parts = 100 % »
 * (trigger différé au commit). La jauge visualise la règle pendant la saisie.
 */
export function AjouterProprietaireModal({
  dict,
  locale,
  lotId,
  membres,
  /** Somme des quote-parts actives existantes (ex. 50). */
  quotePartExistante,
}: {
  dict: Dict;
  locale: Locale;
  lotId: string;
  membres: MembreOption[];
  quotePartExistante: number;
}) {
  const [open, setOpen] = useState(false);
  const [typePropriete, setTypePropriete] = useState<"PLEIN" | "INDIVISION" | "SCI">(
    quotePartExistante > 0 ? "INDIVISION" : "PLEIN"
  );
  const [lignes, setLignes] = useState<LigneProprietaire[]>([
    { cle: 1, utilisateurId: "", quote: String(100 - quotePartExistante), representant: false },
  ]);
  const [state, action] = useActionState(ajouterProprietaire, IDLE);

  const somme = lignes.reduce((acc, l) => acc + (Number.parseFloat(l.quote) || 0), 0);
  const total = quotePartExistante + somme;
  const totalOk = Math.abs(total - 100) < 0.005;

  const maj = (cle: number, patch: Partial<LigneProprietaire>) =>
    setLignes((prev) => prev.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
  const ajouterLigne = () => {
    const reste = Math.max(0, Math.round((100 - total) * 100) / 100);
    setLignes((prev) => [
      ...prev,
      { cle: (prev.at(-1)?.cle ?? 0) + 1, utilisateurId: "", quote: String(reste), representant: false },
    ]);
    setTypePropriete("INDIVISION");
  };
  const retirerLigne = (cle: number) => setLignes((prev) => prev.filter((l) => l.cle !== cle));

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={15} height={15} />
        {dict.lots.ajouterProprietaire}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={dict.lots.ajouterProprietaire}
        subtitle={dict.lots.quotePartRegle}
        closeLabel={dict.common.close}
        wide={lignes.length > 1}
      >
        {state.status === "success" ? (
          <FermetureOk dict={dict} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="lot_id" value={lotId} />
            <input type="hidden" name="type_propriete" value={typePropriete} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dict.enums.typePropriete.PLEIN} htmlFor="type_propriete_select" required>
                <Select
                  id="type_propriete_select"
                  value={typePropriete}
                  onChange={(e) => setTypePropriete(e.target.value as typeof typePropriete)}
                >
                  {(["PLEIN", "INDIVISION", "SCI"] as const).map((t) => (
                    <option key={t} value={t}>
                      {dict.enums.typePropriete[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={dict.lots.dateDebut} htmlFor="date_debut" required>
                <Input id="date_debut" name="date_debut" type="date" required />
              </Field>
            </div>

            <div className="space-y-3">
              {lignes.map((l, i) => (
                <div key={l.cle} className="rounded-2xl border border-hairline bg-ground/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
                      {fill(dict.lots.coproprietaireN, { n: i + 1 })}
                    </p>
                    {lignes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => retirerLigne(l.cle)}
                        className="text-[12px] font-medium text-danger hover:underline"
                      >
                        {dict.lots.retirerLigne}
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
                    <Field
                      label={dict.lots.utilisateur}
                      htmlFor={`utilisateur_${l.cle}`}
                      hint={i === 0 ? dict.lots.utilisateurIdAide : undefined}
                      required
                    >
                      <>
                        <Input
                          id={`utilisateur_${l.cle}`}
                          name="utilisateur_id"
                          list="membres-proprietaires"
                          dir="ltr"
                          required
                          pattern="[0-9a-fA-F-]{36}"
                          value={l.utilisateurId}
                          onChange={(e) => maj(l.cle, { utilisateurId: e.target.value })}
                          className="font-mono text-[13px] text-start"
                          placeholder="00000000-0000-0000-0000-000000000000"
                        />
                        {i === 0 ? (
                          <datalist id="membres-proprietaires">
                            {membres.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nom} · {m.lots.join(", ")}
                              </option>
                            ))}
                          </datalist>
                        ) : null}
                      </>
                    </Field>
                    <Field label={`${dict.lots.quotePart} (%)`} htmlFor={`quote_${l.cle}`} required>
                      <Input
                        id={`quote_${l.cle}`}
                        name="quote_part"
                        inputMode="decimal"
                        dir="ltr"
                        pattern="\d{1,3}([.]\d{1,2})?"
                        value={l.quote}
                        onChange={(e) => maj(l.cle, { quote: e.target.value })}
                        required
                        className="tnum text-start"
                      />
                    </Field>
                  </div>
                  {typePropriete === "INDIVISION" ? (
                    <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-strong">
                      <input
                        type="radio"
                        name="representant_index"
                        value={i}
                        checked={l.representant}
                        onChange={() =>
                          setLignes((prev) => prev.map((x) => ({ ...x, representant: x.cle === l.cle })))
                        }
                        className="accent-[#285bff]"
                      />
                      {dict.lots.representantIndivision}
                    </label>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Jauge de la règle des 100 % pendant la saisie */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="text-soft">{dict.lots.quotePartTotal}</span>
                <span className={`tnum font-semibold ${totalOk ? "text-ok" : "text-warn"}`}>
                  {Math.round(total * 100) / 100} %
                </span>
              </div>
              <ProgressBar ratio={Math.min(1, total / 100)} tone={totalOk ? "ok" : "warn"} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={ajouterLigne} disabled={lignes.length >= 20}>
                <IconPlus width={14} height={14} />
                {dict.lots.ajouterIndivisaire}
              </Button>
              {typePropriete === "INDIVISION" ? (
                <p className="text-[12px] text-soft">{dict.lots.representantAide}</p>
              ) : null}
            </div>

            <FormAlert state={state} />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton disabled={!totalOk}>{dict.common.add}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function AjouterOccupantModal({
  dict,
  locale,
  lotId,
  membres,
}: {
  dict: Dict;
  locale: Locale;
  lotId: string;
  membres: MembreOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(ajouterOccupant, IDLE);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={15} height={15} />
        {dict.lots.ajouterOccupant}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={dict.lots.ajouterOccupant}
        closeLabel={dict.common.close}
      >
        {state.status === "success" ? (
          <FermetureOk dict={dict} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="lot_id" value={lotId} />

            <SelecteurUtilisateur dict={dict} membres={membres} name="utilisateur_id" />

            <Field label={dict.lots.onglets.occupation} htmlFor="type_occupation" required>
              <Select id="type_occupation" name="type_occupation" defaultValue="LOCATAIRE" required>
                {(["PROPRIETAIRE_OCCUPANT", "LOCATAIRE"] as const).map((t) => (
                  <option key={t} value={t}>
                    {dict.enums.typeOccupation[t]}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dict.lots.dateDebut} htmlFor="occ_date_debut" required>
                <Input id="occ_date_debut" name="date_debut" type="date" required />
              </Field>
              <Field label={dict.lots.dateFin} htmlFor="occ_date_fin" optionalLabel={dict.common.optional}>
                <Input id="occ_date_fin" name="date_fin" type="date" />
              </Field>
            </div>

            <Checkbox
              name="acces_finances_accorde"
              label={dict.lots.accesFinances}
              hint={dict.lots.accesFinancesAide}
            />
            <Checkbox name="recoit_convocations" label={dict.lots.recoitConvocations} />

            <FormAlert state={state} />
            <PiedFormulaire dict={dict} onCancel={() => setOpen(false)} />
          </form>
        )}
      </Modal>
    </>
  );
}

function FermetureOk({ dict, onClose }: { dict: Dict; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-strong">{dict.common.updated}</p>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {dict.common.close}
        </Button>
      </div>
    </div>
  );
}

function PiedFormulaire({ dict, onCancel }: { dict: Dict; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-1">
      <Button type="button" variant="secondary" onClick={onCancel}>
        {dict.common.cancel}
      </Button>
      <SubmitButton>{dict.common.add}</SubmitButton>
    </div>
  );
}
