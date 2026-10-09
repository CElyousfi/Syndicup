"use client";

import { useEffect, useState } from "react";
import { RevealText } from "./reveal-text";

export interface GreetingLabels {
  bonjour: string;
  bonApresMidi: string;
  bonsoir: string;
  bonneNuit: string;
}

function moment(h: number, l: GreetingLabels) {
  if (h >= 5 && h < 12) return l.bonjour;
  if (h >= 12 && h < 18) return l.bonApresMidi;
  if (h >= 18 && h < 22) return l.bonsoir;
  return l.bonneNuit;
}

/** Heure de Casablanca (rendu serveur) — corrigée par l'heure locale du navigateur au montage. */
function heureCasablanca(): number {
  const h = new Intl.DateTimeFormat("fr", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Casablanca" }).format(new Date());
  return Number.parseInt(h, 10) || 9;
}

/**
 * Salutation du tableau de bord selon le moment de la journée (FR/AR), révélée mot par mot
 * (`.reveal-word`) : « Bonsoir Karim ». Aucune donnée métier.
 */
export function Greeting({ labels, name, fallback, className = "" }: { labels: GreetingLabels; name?: string | null; fallback: string; className?: string }) {
  const [h, setH] = useState(heureCasablanca);
  const [actif, setActif] = useState(true);
  useEffect(() => {
    setH(new Date().getHours());
    setActif(document.documentElement.dataset.alive !== "0");
  }, []);
  // alive_v1 coupé : la salutation d'avant (« Bonjour {prénom} »).
  const texte = actif ? `${moment(h, labels)}${name ? ` ${name}` : ""}` : fallback;
  return (
    <span suppressHydrationWarning>
      <RevealText key={texte} text={texte} className={className} />
    </span>
  );
}
