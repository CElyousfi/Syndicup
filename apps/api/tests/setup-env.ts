import { config } from "dotenv";
import path from "node:path";

// Charge apps/api/.env.local (gitignoré — valeurs du Supabase local, aucun secret réel).
config({ path: path.resolve(import.meta.dirname, "../.env.local") });

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  throw new Error(
    "DATABASE_URL / DIRECT_URL manquants — lancer `npx supabase start` puis renseigner apps/api/.env.local."
  );
}
