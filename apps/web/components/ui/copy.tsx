"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./icons";

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
      className={`su-btn inline-flex h-9 items-center gap-2 rounded-btn border px-3.5 text-[13px] font-medium text-ink-strong ${
        copied ? "border-ok/30 bg-ok-tint" : "border-hairline-strong bg-surface hover:bg-hover"
      } ${className}`}
    >
      {/* Icônes et libellés superposés : la copie se transforme en coche sans que le bouton bouge. */}
      <span className="copy-icons" aria-hidden>
        <IconCopy width={16} height={16} className="copy-idle" />
        <IconCheck width={16} height={16} className="copy-done text-ok" />
      </span>
      <span className="copy-labels">
        <span className="copy-idle" aria-hidden={copied}>{label}</span>
        <span className="copy-done" aria-hidden={!copied}>{copiedLabel}</span>
      </span>
    </button>
  );
}
