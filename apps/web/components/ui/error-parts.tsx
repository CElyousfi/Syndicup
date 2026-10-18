"use client";

/**
 * Briques des moments difficiles, partagées par <FormAlert>, <LoadError>, les frontières
 * d'erreur et l'indicateur de données périmées : la référence courte copiable et l'action qui
 * débloque. Légères (aucune dépendance `motion`) : utilisables par les pages publiques.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCheck, IconCopy } from "./icons";
import { Button } from "./button";

/** « Réf. 1a2b3c4d » — un tap copie la référence complète (à donner au support). */
export function ReferenceChip({
  label,
  value,
  copyLabel,
  copiedLabel,
  className = "",
}: {
  /** Texte affiché, déjà localisé (« Réf. 1a2b3c4d »). */
  label: string;
  /** Valeur copiée (request_id complet ou digest). */
  value: string;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch (e) {
          // Presse-papiers refusé (permissions, contexte non sécurisé) : la référence reste lisible.
          console.warn(JSON.stringify({ niveau: "warn", message: "copie de la reference impossible", erreur: String(e) }));
        }
      }}
      title={copied ? copiedLabel : copyLabel}
      aria-label={`${label} · ${copied ? (copiedLabel ?? "") : (copyLabel ?? "")}`}
      aria-live="polite"
      className={`su-btn inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] text-faint transition-colors hover:bg-wash hover:text-soft ${className}`}
    >
      <span dir="ltr">{label}</span>
      {copied ? <IconCheck width={12} height={12} className="text-ok" /> : <IconCopy width={12} height={12} />}
    </button>
  );
}

/**
 * Bouton « Réessayer » / « Actualiser » : re-rend la page serveur (router.refresh) — les données
 * sont relues, aucune écriture n'est rejouée, l'état client (saisie en cours) est conservé.
 */
export function RefreshButton({
  label,
  size = "sm",
  variant = "secondary",
  className = "",
}: {
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => start(() => router.refresh())}
    >
      {label}
    </Button>
  );
}

/** Lien d'action (reconnexion, retour à l'accueil) au style des boutons. */
export function ActionLink({ href, label, variant = "secondary" }: { href: string; label: string; variant?: "primary" | "secondary" }) {
  const cls =
    variant === "primary"
      ? "bg-cta text-ink hover:bg-lime-hover"
      : "border-[1.5px] border-link text-link hover:bg-action-wash";
  return (
    <Link href={href} className={`su-btn inline-flex h-9 items-center justify-center rounded-btn px-4 text-[13px] font-semibold ${cls}`}>
      {label}
    </Link>
  );
}
