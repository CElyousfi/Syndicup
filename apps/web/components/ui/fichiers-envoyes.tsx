"use client";

import { useState, type ReactNode } from "react";
import type { FormState } from "../../lib/forms";
import { fill } from "../../lib/i18n";
import { Button } from "./button";
import { IconCheck } from "./icons";

export interface FichiersEnvoyesLabels {
  un: string;
  plusieurs: string;
  aide: string;
  remplacer: string;
}

/**
 * Fichiers déjà téléversés lors d'une tentative à l'issue inconnue (`state.envoyes`) : au lieu du
 * champ fichier, une ligne « Fichier déjà envoyé — nom » et leurs chemins en champs cachés, pour
 * que « Réessayer » rejoue exactement le même contenu sous la même clé d'idempotence (le serveur
 * revalide chaque chemin). « Remplacer » rend le champ fichier et demande une clé neuve
 * (`onRemplacer`) : contenu volontairement différent.
 */
export function FichiersEnvoyes({
  state,
  labels,
  onRemplacer,
  children,
}: {
  state: FormState;
  labels: FichiersEnvoyesLabels;
  onRemplacer: () => void;
  /** Le champ fichier normal, rendu quand rien n'a encore été envoyé (ou après « Remplacer »). */
  children: ReactNode;
}) {
  // L'état pour lequel l'utilisateur a choisi « Remplacer » : la ligne disparaît pour lui seul.
  const [remplace, setRemplace] = useState<FormState | null>(null);
  const envoyes = state.status === "error" && state !== remplace ? state.envoyes ?? [] : [];
  if (envoyes.length === 0) return <>{children}</>;
  const [premier] = envoyes;
  const texte =
    envoyes.length === 1 && premier
      ? fill(labels.un, { nom: premier.nom })
      : fill(labels.plusieurs, { n: envoyes.length, noms: envoyes.map((f) => f.nom).join(", ") });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-wash px-3.5 py-3">
      {envoyes.map((f) => (
        <span key={f.chemin} hidden>
          <input type="hidden" name="envoye_chemin" value={f.chemin} />
          <input type="hidden" name="envoye_nom" value={f.nom} />
        </span>
      ))}
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ok-tint text-ok">
        <IconCheck width={14} height={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[14px] font-semibold text-ink" dir="auto">{texte}</span>
        <span className="block text-[12.5px] text-soft">{labels.aide}</span>
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setRemplace(state);
          onRemplacer();
        }}
      >
        {labels.remplacer}
      </Button>
    </div>
  );
}
