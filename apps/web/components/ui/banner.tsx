import type { ReactNode } from "react";
import { IconAlert, IconInfo, IconShield } from "./icons";

type Variant = "info" | "warn" | "danger" | "ok" | "legal";

const STYLES: Record<Variant, { box: string; icon: ReactNode }> = {
  info: {
    box: "bg-action-tint text-ink-strong",
    icon: <IconInfo className="text-action" />,
  },
  warn: {
    box: "bg-warn-tint text-ink-strong",
    icon: <IconAlert className="text-warn" />,
  },
  danger: {
    box: "bg-danger-tint text-ink-strong",
    icon: <IconAlert className="text-danger" />,
  },
  ok: {
    box: "bg-ok-tint text-ink-strong",
    icon: <IconInfo className="text-ok" />,
  },
  // État « gaté légalement » (brief §6.3) : informatif, jamais une erreur rouge.
  legal: {
    box: "bg-tile text-ink-strong",
    icon: <IconShield className="text-soft" />,
  },
};

export function Banner({
  variant = "info",
  title,
  children,
  action,
  className = "",
}: {
  variant?: Variant;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const s = STYLES[variant];
  return (
    <div className={`flex gap-3 rounded-[20px] px-4 py-4 ${s.box} ${className}`}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={`${title ? "mt-0.5" : ""} text-[13px] leading-relaxed text-body`}>{children}</div> : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </div>
  );
}
