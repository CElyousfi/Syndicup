import { config } from "dotenv";
import path from "node:path";

// Charge apps/api/.env.local (gitignoré — valeurs du Supabase local, aucun secret réel).
config({ path: path.resolve(import.meta.dirname, "../.env.local") });

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  throw new Error(
    "DATABASE_URL / DIRECT_URL manquants — lancer `npx supabase start` puis renseigner apps/api/.env.local."
  );
}

// Les tests vérifient le comportement SANS fournisseur (noop honnête → EN_ATTENTE) — on
// neutralise donc les transports que le dev local configure (SMTP → Inbucket, SMS dev).
// Les adaptateurs eux-mêmes sont testés unitairement avec leurs env posées explicitement.
delete process.env.SMTP_URL;
delete process.env.EMAIL_FROM;
delete process.env.SMS_PROVIDER;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM;
delete process.env.FCM_SERVICE_ACCOUNT_JSON;
