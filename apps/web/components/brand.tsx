/** Marque SyndicUp — logo officiel (hexagone vert) + wordmark. Le nom produit ne se traduit pas. */
import Image from "next/image";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      src="/images/logo.png"
      alt=""
      width={size}
      height={size}
      priority
      className="shrink-0 select-none"
    />
  );
}

export function BrandWordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`text-[17px] font-semibold tracking-tight ${inverse ? "text-white" : "text-ink"}`} dir="ltr">
      Syndic<span className={inverse ? "text-sage" : "text-action"}>Up</span>
    </span>
  );
}

export function Brand({ inverse = false, size = 34 }: { inverse?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={size} />
      <BrandWordmark inverse={inverse} />
    </span>
  );
}
