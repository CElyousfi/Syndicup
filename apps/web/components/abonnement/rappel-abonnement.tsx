"use client";

/**
 * M29 — fenêtre de rappel d'abonnement, côté syndic (jamais pour les résidents) :
 *  - RAPPEL (fin d'essai ≤ 7 j, renouvellement ≤ 14 j) : douce, refermable, une fois par jour ;
 *  - GRACE (échéance dépassée) : à chaque ouverture de session, avec la date de coupure.
 * L'état vient de l'API (calculé depuis les dates) ; ce composant ne décide rien.
 */
import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { fill, type Dict, type Locale } from "../../lib/i18n";

type Labels = Dict["abonnementResidence"];
import { formatDate } from "../../lib/format";
import type { AbonnementResidence } from "../../lib/api/console-types";
import { ContactSyndicUp } from "./contact";

function cle(coproId: string, a: AbonnementResidence) {
  return `su-rappel-abo:${coproId}:${a.niveau}:${a.echeance ?? ""}`;
}

export function RappelAbonnement({
  abonnement: a,
  coproprieteId,
  residence,
  labels: t,
  closeLabel,
  locale,
}: {
  abonnement: AbonnementResidence;
  coproprieteId: string;
  residence: string;
  labels: Labels;
  closeLabel: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!a.gestionnaire || (a.niveau !== "RAPPEL" && a.niveau !== "GRACE")) return;
    const k = cle(coproprieteId, a);
    const aujourdHui = new Date().toISOString().slice(0, 10);
    try {
      const store = a.niveau === "GRACE" ? window.sessionStorage : window.localStorage;
      if (store.getItem(k) === aujourdHui) return;
    } catch {
      // stockage indisponible (navigation privée) : on affiche simplement la fenêtre
    }
    setOpen(true);
  }, [a, coproprieteId]);

  function fermer() {
    try {
      const store = a.niveau === "GRACE" ? window.sessionStorage : window.localStorage;
      store.setItem(cle(coproprieteId, a), new Date().toISOString().slice(0, 10));
    } catch {
      // sans stockage, la fenêtre reviendra au prochain chargement — acceptable
    }
    setOpen(false);
  }

  if (!a.gestionnaire || (a.niveau !== "RAPPEL" && a.niveau !== "GRACE")) return null;

  const enEssai = a.etat === "EN_ESSAI";
  const jours = a.jours_avant_echeance ?? 0;
  const titre =
    a.niveau === "GRACE"
      ? t.graceTitre
      : enEssai
        ? jours <= 0
          ? t.essaiFinAujourdhui
          : fill(t.essaiFinDans, { n: jours })
        : fill(t.renouvellementTitre, { date: formatDate(a.echeance, locale) });
  const corps =
    a.niveau === "GRACE"
      ? fill(t.graceCorps, { echeance: formatDate(a.echeance, locale), blocage: formatDate(a.date_blocage, locale) })
      : enEssai
        ? t.essaiCorps
        : t.renouvellementCorps;

  return (
    <Modal open={open} onClose={fermer} title={titre} closeLabel={closeLabel}>
      <div className="space-y-5">
        {a.niveau === "GRACE" && a.jours_avant_blocage !== null ? (
          <Badge variant={a.jours_avant_blocage <= 2 ? "danger" : "warn"}>
            {a.jours_avant_blocage <= 0 ? t.graceDernierJour : fill(t.graceJours, { n: a.jours_avant_blocage })}
          </Badge>
        ) : null}
        <p className="text-[15px] leading-relaxed text-body">{corps}</p>
        <ContactSyndicUp contact={a.contact} labels={t} message={`${titre} — ${residence}`} />
        <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={fermer}>
            {a.niveau === "GRACE" ? t.compris : t.plusTard}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
