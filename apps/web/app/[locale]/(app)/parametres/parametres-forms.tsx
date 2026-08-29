"use client";

import { useActionState } from "react";
import { Field, Input, Select, Switch } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Banner } from "../../../../components/ui/banner";
import { IDLE } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { Copropriete, TypeResidence } from "../../../../lib/api/types";
import {
  modifierIdentite,
  modifierLegaux,
  modifierOptions,
  modifierRecouvrement,
  modifierReglement,
} from "./actions";

const DELAIS_DEFAUT: Record<string, number> = { N1: 3, N2: 15, N3: 30, N4: 45, N5: 60, N6: 90 };

function PiedSection({ dict, state }: { dict: Dict; state: import("../../../../lib/forms").FormState }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-hairline pt-4">
      {state.status === "success" ? (
        <p className="text-[13px] font-medium text-ok">{dict.parametres.enregistre}</p>
      ) : null}
      <SubmitButton variant="secondary">{dict.common.save}</SubmitButton>
    </div>
  );
}

export function IdentiteForm({
  dict,
  locale,
  copro,
}: {
  dict: Dict;
  locale: Locale;
  copro: Copropriete;
}) {
  const [state, action] = useActionState(modifierIdentite, IDLE);
  const pa = dict.parametres;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={pa.nom} htmlFor="c_nom" required>
          <Input id="c_nom" name="nom" defaultValue={copro.nom} required maxLength={200} />
        </Field>
        <Field label={pa.ville} htmlFor="c_ville" required>
          <Input id="c_ville" name="ville" defaultValue={copro.ville} required maxLength={100} />
        </Field>
      </div>
      <Field label={pa.adresse} htmlFor="c_adresse" required>
        <Input id="c_adresse" name="adresse" defaultValue={copro.adresse} required maxLength={500} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={pa.typeResidence} htmlFor="c_type">
          <Select id="c_type" name="type_residence" defaultValue={copro.typeResidence} disabled>
            {(Object.keys(dict.enums.typeResidence) as TypeResidence[]).map((t) => (
              <option key={t} value={t}>
                {dict.enums.typeResidence[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={pa.nbLots} htmlFor="c_nb" required>
          <Input
            id="c_nb"
            name="nb_lots"
            type="number"
            min={1}
            max={10000}
            defaultValue={copro.nbLots}
            required
            className="tnum"
          />
        </Field>
      </div>
      <FormAlert state={state} />
      <PiedSection dict={dict} state={state} />
    </form>
  );
}

export function ReglementForm({
  dict,
  locale,
  copro,
}: {
  dict: Dict;
  locale: Locale;
  copro: Copropriete;
}) {
  const [state, action] = useActionState(modifierReglement, IDLE);
  const pa = dict.parametres;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Field
        label={pa.totalTantiemes}
        htmlFor="c_tantiemes"
        hint={pa.totalTantiemesAide}
      >
        <Input
          id="c_tantiemes"
          name="total_tantiemes"
          inputMode="decimal"
          dir="ltr"
          pattern="\d{1,12}([.]\d{1,2})?"
          defaultValue={copro.totalTantiemes ?? ""}
          className="tnum max-w-56 text-start"
        />
      </Field>
      <FormAlert state={state} />
      <PiedSection dict={dict} state={state} />
    </form>
  );
}

export function OptionsForm({
  dict,
  locale,
  copro,
}: {
  dict: Dict;
  locale: Locale;
  copro: Copropriete;
}) {
  const [state, action] = useActionState(modifierOptions, IDLE);
  const pa = dict.parametres;
  const config = (copro.configJson ?? {}) as Record<string, unknown>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Switch
        name="locataire_voit_pv"
        label={pa.optLocatairesPv}
        defaultChecked={config.locataire_voit_pv === true}
      />
      <Switch
        name="reservation_espaces_proprietaires_only"
        label={pa.optReservationProprio}
        defaultChecked={config.reservation_espaces_proprietaires_only === true}
      />
      <FormAlert state={state} />
      <PiedSection dict={dict} state={state} />
    </form>
  );
}

export function RecouvrementForm({
  dict,
  locale,
  copro,
}: {
  dict: Dict;
  locale: Locale;
  copro: Copropriete;
}) {
  const [state, action] = useActionState(modifierRecouvrement, IDLE);
  const pa = dict.parametres;
  const politique = (copro.politiqueRecouvrementJson ?? {}) as Record<string, unknown>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-[13px] text-soft">{pa.recouvrementAide}</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(["N1", "N2", "N3", "N4", "N5", "N6"] as const).map((n) => (
          <Field key={n} label={n} htmlFor={`rec_${n}`}>
            <Input
              id={`rec_${n}`}
              name={n}
              type="number"
              min={0}
              max={3650}
              placeholder={String(DELAIS_DEFAUT[n])}
              defaultValue={typeof politique[n] === "number" ? String(politique[n]) : ""}
              className="tnum"
            />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-faint">
        {(["N1", "N2", "N3", "N4", "N5", "N6"] as const).map((n) => (
          <span key={n}>{dict.enums.escalade[n]}</span>
        ))}
      </div>
      <FormAlert state={state} />
      <PiedSection dict={dict} state={state} />
    </form>
  );
}

/** ⚠️ Section légale — bannière permanente, jamais de valeur par défaut proposée. */
export function LegauxForm({
  dict,
  locale,
  copro,
}: {
  dict: Dict;
  locale: Locale;
  copro: Copropriete;
}) {
  const [state, action] = useActionState(modifierLegaux, IDLE);
  const pa = dict.parametres;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Banner variant="legal" title={dict.legalGate.banner}>
        {pa.legauxBanner}
      </Banner>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={pa.delaiConvocation} htmlFor="l_delai" hint={pa.delaiConvocationAide}>
          <Input
            id="l_delai"
            name="delai_convocation_jours"
            type="number"
            min={1}
            max={365}
            defaultValue={copro.delaiConvocationJours ?? ""}
            placeholder={pa.nonConfigure}
            className="tnum"
          />
        </Field>
        <Field label={pa.quorumPremiere} htmlFor="l_quorum" hint={pa.quorumPremiereAide}>
          <Input
            id="l_quorum"
            name="quorum_premiere_convocation"
            inputMode="decimal"
            dir="ltr"
            pattern="(0[.]\d{1,3}|1([.]0{1,3})?)"
            defaultValue={copro.quorumPremiereConvocation ?? ""}
            placeholder={pa.nonConfigure}
            className="tnum text-start"
          />
        </Field>
        <Field label={pa.limiteProcurations} htmlFor="l_limite" hint={pa.limiteProcurationsAide}>
          <Input
            id="l_limite"
            name="limite_procurations_mandataire"
            type="number"
            min={1}
            max={100}
            defaultValue={copro.limiteProcurationsMandataire ?? ""}
            placeholder={pa.nonConfigure}
            className="tnum"
          />
        </Field>
        <Field label={pa.retention} htmlFor="l_retention" hint={pa.retentionAide}>
          <Input
            id="l_retention"
            name="retention_desactivation_mois"
            type="number"
            min={1}
            max={240}
            defaultValue={copro.retentionDesactivationMois ?? ""}
            placeholder={pa.nonConfigure}
            className="tnum"
          />
        </Field>
      </div>
      <FormAlert state={state} />
      <PiedSection dict={dict} state={state} />
    </form>
  );
}
