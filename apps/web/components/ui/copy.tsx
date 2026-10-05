"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./icons";

/** Copier (Wise) : pill contour vert marque ; une fois copié, elle passe en lime avec une coche. */
export function CopyButton({
  value,
  label,
  copiedLabel,
  className = "",
}: {
  value: string;
  label: string;
  copiedLabel: string;
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
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // presse-papiers indisponible (permissions) — pas d'action destructive à défaut
        }
      }}
      data-copied={copied ? "" : undefined}
      aria-live="polite"
      className={`su-btn inline-flex h-9 items-center gap-2 rounded-btn border-[1.5px] px-3.5 text-[13px] font-semibold transition-colors ${
        copied ? "border-cta bg-cta text-ink" : "border-link text-link hover:bg-action-wash"
      } ${className}`}
    >
      {/* Icônes et libellés superposés : la copie se transforme en coche sans que le bouton bouge. */}
      <span className="copy-icons" aria-hidden>
        <IconCopy width={16} height={16} className="copy-idle" />
        <IconCheck width={16} height={16} className="copy-done text-ink" />
      </span>
      <span className="copy-labels">
        <span className="copy-idle" aria-hidden={copied}>{label}</span>
        <span className="copy-done" aria-hidden={!copied}>{copiedLabel}</span>
      </span>
    </button>
  );
}
