/**
 * Client Supabase Storage (service role) — M9 (Master Spec Partie 9.3).
 *
 * Buckets privés, jamais d'URL publique : toute lecture passe par une URL signée à durée de vie
 * courte (15 minutes), générée ici après vérification RLS/permission côté service appelant.
 *
 * ⚠️ Non testé contre un bucket réel (même limitation que le sandbox CMI, voir M5) : aucun bucket
 * "documents" n'est provisionné dans cet environnement de dev/test. Le chemin heureux de
 * `creerUrlSignee` n'est donc couvert par aucun test d'intégration — voir ROADMAP_BACKLOG.md M9.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 15 * 60;
const BUCKET_DOCUMENTS = "documents";

let client: SupabaseClient | null = null;

function getServiceRoleClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.");
  }
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Génère une URL signée à durée de vie courte pour un chemin du bucket privé `documents`
 * (Master Spec Partie 9.3). L'appelant DOIT avoir déjà vérifié la permission/RLS sur le document
 * correspondant — cette fonction ne fait aucune vérification d'accès elle-même.
 */
export async function creerUrlSignee(storagePath: string): Promise<string> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTS)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    throw new Error(`Échec de génération de l'URL signée : ${error?.message ?? "inconnu"}`);
  }
  return data.signedUrl;
}

/**
 * Téléverse un document généré par le système (ex. PV d'AG — M6) dans le bucket privé
 * `documents`. `upsert: true` : la génération est idempotente sur le même chemin (un rejeu ne
 * doit pas échouer sur "already exists"). Retourne le chemin de stockage (pas d'URL publique —
 * la lecture passe toujours par `creerUrlSignee`).
 */
export async function televerserDocument(
  storagePath: string,
  contenu: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTS)
    .upload(storagePath, contenu, { contentType, upsert: true });
  if (error) {
    throw new Error(`Échec du téléversement de ${storagePath} : ${error.message}`);
  }
  return storagePath;
}
