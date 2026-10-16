"use client";

/**
 * M29 — briques de la console : bouton → modale → formulaire → Server Action. Au succès, la
 * modale se ferme, la page se recharge et le message s'annonce (toast via <FormAlert>).
 */
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../../../../components/ui/modal";
import { Button, type ButtonVariant } from "../../../../components/ui/button";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { IDLE, type FormState } from "../../../../lib/forms";

export function FormModal({
  label,
  icon,
  title,
  subtitle,
  action,
  hidden,
  submitLabel,
  closeLabel,
  variant = "secondary",
  size = "sm",
  submitVariant = "primary",
  wide = false,
  children,
}: {
  label: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  submitLabel: ReactNode;
  closeLabel: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  submitVariant?: ButtonVariant;
  wide?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [ouverture, setOuverture] = useState(0);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => { setOuverture((n) => n + 1); setOpen(true); }}>
        {icon}
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle} closeLabel={closeLabel} wide={wide}>
        {/* Remonté à chaque ouverture : formulaire et état repartent de zéro. */}
        {open ? (
          <Formulaire key={ouverture} action={action} hidden={hidden} submitLabel={submitLabel} submitVariant={submitVariant} onDone={() => setOpen(false)}>
            {children}
          </Formulaire>
        ) : null}
      </Modal>
    </>
  );
}

function Formulaire({
  action,
  hidden,
  submitLabel,
  submitVariant,
  onDone,
  children,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  submitLabel: ReactNode;
  submitVariant: ButtonVariant;
  onDone: () => void;
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") {
      onDone();
      router.refresh();
    }
  }, [state, onDone, router]);
  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <FormAlert state={state} />
      <div className="flex justify-end">
        <SubmitButton variant={submitVariant}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
