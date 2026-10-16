import { ButtonLink } from "../ui/button";
import { IconSend } from "../ui/icons";

/** Boutons de contact SyndicUp (WhatsApp / e-mail) — coordonnées fournies par l'API (variables d'env). */
export function ContactSyndicUp({
  contact,
  labels,
  message,
}: {
  contact: { email: string | null; whatsapp: string | null };
  labels: { contacterWhatsapp: string; contacterEmail: string };
  message: string;
}) {
  const wa = contact.whatsapp ? contact.whatsapp.replace(/\D/g, "") : null;
  if (!wa && !contact.email) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {wa ? (
        <ButtonLink href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          <IconSend width={16} height={16} />
          {labels.contacterWhatsapp}
        </ButtonLink>
      ) : null}
      {contact.email ? (
        <ButtonLink variant="secondary" href={`mailto:${contact.email}?subject=${encodeURIComponent(message)}`}>
          {labels.contacterEmail}
        </ButtonLink>
      ) : null}
    </div>
  );
}
