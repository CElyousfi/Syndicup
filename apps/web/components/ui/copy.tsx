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
      className={`inline-flex h-9 items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-strong transition-colors hover:bg-hover ${className}`}
    >
      {copied ? <IconCheck width={16} height={16} className="text-ok" /> : <IconCopy width={16} height={16} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
