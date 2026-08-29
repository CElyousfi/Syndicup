import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "dangerGhost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white hover:bg-[#2e3230] active:translate-y-px shadow-[0_10px_20px_-10px_rgb(18_18_18/0.45)]",
  secondary:
    "bg-surface text-ink-strong border border-hairline-strong hover:bg-hover hover:border-faint/50 active:translate-y-px shadow-[0_1px_2px_rgb(32_31_35/0.04)]",
  danger: "bg-danger text-white hover:brightness-110 active:translate-y-px",
  ghost: "text-body hover:bg-surface hover:text-ink-strong hover:shadow-[0_1px_2px_rgb(32_31_35/0.06)]",
  dangerGhost: "text-danger hover:bg-danger-tint",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-btn font-medium transition-colors select-none disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: Size }) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
