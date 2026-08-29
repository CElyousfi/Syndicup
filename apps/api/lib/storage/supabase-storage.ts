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
 * Provisionnement idempotent du bucket privé `documents` — appelé paresseusement avant toute
 * opération de storage. Rend le local ET la production auto-suffisants : aucun clic dashboard
 * requis, le service role crée le bucket au premier usage s'il n'existe pas.
 */
let bucketPret: Promise<void> | null = null;

export function ensureBucketDocuments(): Promise<void> {
  bucketPret ??= (async () => {
    const supabase = getServiceRoleClient();
    const { data } = await supabase.storage.getBucket(BUCKET_DOCUMENTS);
    if (data) return;
    const { error } = await supabase.storage.createBucket(BUCKET_DOCUMENTS, {
      public: false,
      fileSizeLimit: "50MB",
    });
    // Course bénigne entre instances : "already exists" = objectif atteint.
    if (error && !/already exists|duplicate/i.test(error.message)) {
      bucketPret = null;
      throw new Error(`Échec de création du bucket documents : ${error.message}`);
    }
  })();
  return bucketPret;
}

/**
 * URL signée d'UPLOAD (2 h) vers un chemin du bucket privé `documents` — le client téléverse
 * directement au Storage (exception d'architecture autorisée, CLAUDE.md §1.4) puis enregistre
 * les métadonnées via POST /documents. L'appelant a déjà vérifié la permission (syndic).
 */
export async function creerUrlUploadSignee(
  storagePath: string
): Promise<{ url: string; token: string }> {
  await ensureBucketDocuments();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTS)
    .createSignedUploadUrl(storagePath, { upsert: true });
  if (error || !data) {
    throw new Error(`Échec de génération de l'URL d'upload : ${error?.message ?? "inconnu"}`);
  }
  return { url: data.signedUrl, token: data.token };
}

/**
 * Génère une URL signée à durée de vie courte pour un chemin du bucket privé `documents`
 * (Master Spec Partie 9.3). L'appelant DOIT avoir déjà vérifié la permission/RLS sur le document
 * correspondant — cette fonction ne fait aucune vérification d'accès elle-même.
 */
export async function creerUrlSignee(storagePath: string): Promise<string> {
  await ensureBucketDocuments();
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
  await ensureBucketDocuments();
  const supabase = getServiceRoleClient();
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTS)
    .upload(storagePath, contenu, { contentType, upsert: true });
  if (error) {
    throw new Error(`Échec du téléversement de ${storagePath} : ${error.message}`);
  }
  return storagePath;
}

/**
 * Suppression d'un objet du bucket privé `documents` (DELETE /documents/:id). Meilleur effort :
 * un objet déjà absent n'est pas une erreur — la ligne applicative reste la source de vérité.
 */
export async function supprimerObjet(storagePath: string): Promise<void> {
  await ensureBucketDocuments();
  const { error } = await getServiceRoleClient().storage.from(BUCKET_DOCUMENTS).remove([storagePath]);
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`Storage remove: ${error.message}`);
  }
}
