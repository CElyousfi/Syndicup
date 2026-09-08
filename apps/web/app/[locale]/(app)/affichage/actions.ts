"use server";

/** Server Actions — Tableau d'affichage (M21). Publier / ouvrir / clore / répondre = écritures probantes (`idempotent: true`) ; pièces jointes téléversées depuis l'action. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { AnnonceDetail, ContactUtile, PreferencesNotification, Sondage } from "../../../../lib/api/types";

const BASE = "/affichage";
function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string, ...suffixes: string[]) {
  for (const s of [BASE, `${BASE}/contacts`, "/tableau-de-bord", "/profil", ...suffixes]) revalidatePath(`/${locale}${s}`);
}
function isoLocal(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function televerserPieces(fd: FormData): Promise<{ storage_path: string; nom: string }[] | { erreur: FormState }> {
  const fichiers = fd.getAll("pieces").filter((f): f is File => f instanceof File && f.size > 0);
  const out: { storage_path: string; nom: string }[] = [];
  for (const f of fichiers) {
    if (f.size > 15 * 1024 * 1024) return { erreur: { status: "error", code: "VALIDATION_ERROR", message: "Fichier trop lourd (15 Mo max).", fields: { pieces: "15 Mo max." } } };
    const contentType = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/annonces/upload-url", { method: "POST", body: { nom_fichier: f.name || "piece.pdf", content_type: contentType } });
    if (!prep.ok) return { erreur: fromApiError(prep) };
    const up = await fetch(prep.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: await f.arrayBuffer() });
    if (!up.ok) return { erreur: { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${up.status}).` } };
    out.push({ storage_path: prep.data.storage_path, nom: f.name || "piece.pdf" });
  }
  return out;
}

function corpsAnnonce(fd: FormData) {
  const audience = champ(fd, "audience") || "TOUS";
  return {
    titre: champ(fd, "titre"),
    contenu: champ(fd, "contenu"),
    categorie: champ(fd, "categorie"),
    audience,
    batiment: audience === "BATIMENT" ? optionnel(fd, "batiment") : null,
    epingle: champ(fd, "epingle") === "on",
    expire_le: isoLocal(optionnel(fd, "expire_le")),
    commentaires_actives: champ(fd, "commentaires_actives") === "on",
  };
}

export async function creerAnnonce(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const pieces = await televerserPieces(fd);
  if ("erreur" in pieces) return pieces.erreur;
  const res = await apiFetch<AnnonceDetail>("/annonces", { method: "POST", body: { ...corpsAnnonce(fd), pieces_jointes: pieces } });
  if (!res.ok) return fromApiError(res);
  if (champ(fd, "publier") === "1") {
    const pub = await apiFetch<AnnonceDetail>(`/annonces/${res.data.id}/publier`, { method: "POST", body: {}, idempotent: true });
    if (!pub.ok) return fromApiError(pub);
  }
  revalider(locale);
  redirect(`/${locale}${BASE}/${res.data.id}?cree=1`);
}

export async function modifierAnnonce(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "annonce_id");
  const pieces = await televerserPieces(fd);
  if ("erreur" in pieces) return pieces.erreur;
  const res = await apiFetch<AnnonceDetail>(`/annonces/${id}`, { method: "PATCH", body: { ...corpsAnnonce(fd), ...(pieces.length ? { pieces_jointes: pieces } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  redirect(`/${locale}${BASE}/${id}?maj=1`);
}

export async function publierAnnonce(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "annonce_id");
  const quand = champ(fd, "mode") === "programmer" ? isoLocal(optionnel(fd, "publie_le")) : null;
  const res = await apiFetch<AnnonceDetail>(`/annonces/${id}/publier`, { method: "POST", body: { publie_le: quand }, idempotent: true });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, res.data.diffusion);
}

export async function archiverAnnonce(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "annonce_id");
  const res = await apiFetch<AnnonceDetail>(`/annonces/${id}/archiver`, { method: "POST", body: {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

export async function supprimerAnnonce(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "annonce_id");
  const res = await apiFetch<{ id: string }>(`/annonces/${id}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  redirect(`/${locale}${BASE}?supprimee=1`);
}

export async function marquerLue(locale: string, id: string): Promise<void> {
  await apiFetch(`/annonces/${id}/lu`, { method: "POST", body: {} });
  revalidatePath(`/${locale}${BASE}`);
  revalidatePath(`/${locale}/tableau-de-bord`);
}

export async function commenter(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "annonce_id");
  const res = await apiFetch(`/annonces/${id}/commentaires`, { method: "POST", body: { contenu: champ(fd, "contenu") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

export async function masquerCommentaire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "annonce_id");
  const cid = champ(fd, "commentaire_id");
  const res = await apiFetch(`/annonces/${id}/commentaires/${cid}/masquer`, { method: "POST", body: {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

// ── Sondages ─────────────────────────────────────────────────────────────────

function corpsSondage(fd: FormData) {
  const audience = champ(fd, "audience") || "TOUS";
  const options = Array.from({ length: 10 }, (_, i) => champ(fd, `option_${i + 1}`)).filter(Boolean).map((libelle, i) => ({ id: `opt${i + 1}`, libelle }));
  return {
    question: champ(fd, "question"),
    description: optionnel(fd, "description"),
    options,
    choix_multiple: champ(fd, "choix_multiple") === "on",
    anonyme: true,
    audience,
    batiment: audience === "BATIMENT" ? optionnel(fd, "batiment") : null,
    ponderation_tantiemes: champ(fd, "ponderation_tantiemes") === "on",
    date_fin: isoLocal(optionnel(fd, "date_fin")) ?? "",
  };
}

export async function creerSondage(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Sondage>("/sondages", { method: "POST", body: corpsSondage(fd) });
  if (!res.ok) return fromApiError(res);
  if (champ(fd, "ouvrir") === "1") {
    const o = await apiFetch<Sondage>(`/sondages/${res.data.id}/ouvrir`, { method: "POST", body: {}, idempotent: true });
    if (!o.ok) return fromApiError(o);
  }
  revalider(locale);
  redirect(`/${locale}${BASE}/sondages/${res.data.id}?cree=1`);
}

export async function ouvrirSondage(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sondage_id");
  const res = await apiFetch<Sondage>(`/sondages/${id}/ouvrir`, { method: "POST", body: {}, idempotent: true });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/sondages/${id}`);
  return success();
}
export async function cloreSondage(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sondage_id");
  const res = await apiFetch<Sondage>(`/sondages/${id}/clore`, { method: "POST", body: {}, idempotent: true });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/sondages/${id}`);
  return success();
}
export async function supprimerSondage(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sondage_id");
  const res = await apiFetch(`/sondages/${id}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  redirect(`/${locale}${BASE}?supprimee=1`);
}
export async function repondreSondage(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sondage_id");
  const choix = fd.getAll("choix").map(String).filter(Boolean);
  const res = await apiFetch<Sondage>(`/sondages/${id}/repondre`, { method: "POST", body: { choix }, idempotent: true });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/sondages/${id}`);
  return success();
}

// ── Contacts utiles ──────────────────────────────────────────────────────────

export async function enregistrerContact(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = optionnel(fd, "contact_id");
  const body = { libelle: champ(fd, "libelle"), telephone: champ(fd, "telephone"), ordre: Number(champ(fd, "ordre") || "0") };
  const res = id ? await apiFetch<ContactUtile>(`/contacts-utiles/${id}`, { method: "PATCH", body }) : await apiFetch<ContactUtile>("/contacts-utiles", { method: "POST", body });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success();
}
export async function supprimerContact(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch(`/contacts-utiles/${champ(fd, "contact_id")}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success();
}

// ── Préférences de notification ──────────────────────────────────────────────

export async function enregistrerPreferences(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const body: PreferencesNotification = { digest_hebdo: champ(fd, "digest_hebdo") === "on", canal_digest: (champ(fd, "canal_digest") || "EMAIL") as PreferencesNotification["canal_digest"], annonces_push: champ(fd, "annonces_push") === "on" };
  const res = await apiFetch<PreferencesNotification>("/users/me/preferences-notification", { method: "PUT", body });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success();
}
