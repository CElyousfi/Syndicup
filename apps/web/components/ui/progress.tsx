/** Jauges — barres et anneau (taux de recouvrement). Aucun calcul métier : ratios déjà fournis. */

export function ProgressBar({
  ratio,
  tone = "action",
  className = "",
}: {
  /** 0..1 */
  ratio: number;
  tone?: "action" | "ok" | "warn" | "danger" | "ink";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  const tones = {
    action: "bg-action",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    ink: "bg-ink",
  } as const;
  return (
    <div
      title={`${Math.round(pct)}%`}
      className={`h-2 w-full overflow-hidden rounded-full bg-ground ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tones[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function RingGauge({
  ratio,
  label,
  sublabel,
  size = 148,
}: {
  /** 0..1 */
  ratio: number;
  label: string;
  sublabel?: string;
  size?: number;
}) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const tone = clamped >= 0.85 ? "var(--color-ok)" : clamped >= 0.6 ? "var(--color-warn)" : "var(--color-danger)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ground)" strokeWidth="11" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-2xl font-semibold text-ink">{label}</span>
        {sublabel ? <span className="mt-0.5 text-[11px] text-soft">{sublabel}</span> : null}
      </div>
    </div>
  );
}
