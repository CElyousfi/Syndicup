import { redirect } from "next/navigation";
import Image from "next/image";
import { getDict, isLocale, type Locale } from "../../../../lib/i18n";
import { Field, Input } from "../../../../components/ui/field";
import { Button, ButtonLink } from "../../../../components/ui/button";
import { QrScannerButton } from "../../../../components/auth/qr-scanner";

/** Saisie manuelle d'un code d'invitation — redirige vers la page cible /invitation/{code}. */
export default async function InvitationEntreePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);

  async function ouvrir(formData: FormData) {
    "use server";
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    redirect(`/${locale}/invitation/${encodeURIComponent(code)}`);
  }

  return (
    <div>
      <div className="relative mb-7 h-36 overflow-hidden rounded-[28px] bg-tile">
        <Image
          src="/images/residence-entrance.jpg"
          alt=""
          fill
          sizes="384px"
          className="object-cover"
        />
      </div>
      <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{dict.auth.inviteTitle}</h1>
      <p className="mt-2 text-[15px] text-soft">{dict.auth.inviteSignInFirst}</p>
      <form action={ouvrir} className="mt-7 space-y-5">
        <Field label={dict.auth.inviteCodeLabel} htmlFor="code" hint={dict.auth.inviteCodeHint} required>
          <Input
            id="code"
            name="code"
            dir="ltr"
            required
            minLength={4}
            maxLength={16}
            autoComplete="off"
            placeholder="ABCD2345"
            className="h-14 text-center font-mono text-xl font-bold uppercase tracking-[0.35em]"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          {dict.common.next}
        </Button>
      </form>
      <div className="mt-3 flex justify-center">
        <QrScannerButton
          locale={locale}
          labels={{
            scan: dict.auth.scanQr,
            hint: dict.auth.scanHint,
            denied: dict.auth.scanDenied,
            invalid: dict.auth.scanInvalid,
            insecure: dict.auth.scanInsecure,
            close: dict.common.close,
          }}
          size="lg"
          className="w-full"
        />
      </div>
      <p className="mt-6 text-center text-[13px]">
        <ButtonLink href={`/${locale}/connexion`} variant="ghost" size="sm">
          {dict.common.back}
        </ButtonLink>
      </p>
    </div>
  );
}
