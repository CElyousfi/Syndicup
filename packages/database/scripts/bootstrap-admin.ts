/**
 * Bootstrap du PREMIER compte SUPER_ADMIN d'un environnement (production incluse) —
 * l'unique étape hors interface : la console opérateur ne peut pas créer son propre
 * premier utilisateur (et c'est voulu).
 *
 * Fait, de manière idempotente :
 *  1. crée le compte GoTrue via l'API admin Supabase (service role) — jamais d'INSERT
 *     brut dans auth.users hors local ;
 *  2. crée le profil `utilisateur` avec le MÊME uuid (convention id ≡ auth uid, lue par
 *     le custom_access_token_hook) ;
 *  3. crée la copropriété interne « SyndicUp — Plateforme » (ancre du rôle, jamais
 *     montrée aux clients) et le rôle SUPER_ADMIN.
 *
 * Usage :
 *   BOOTSTRAP_ADMIN_EMAIL=vous@domaine.ma \
 *   BOOTSTRAP_ADMIN_PASSWORD='… ≥ 12 caractères …' \
 *   BOOTSTRAP_ADMIN_NOM=Nom BOOTSTRAP_ADMIN_PRENOM=Prénom \
 *   npm run bootstrap:admin --workspace=@copropriete-maroc/database
 *
 * Requiert : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIRECT_URL.
 */
import { PrismaClient } from "@prisma/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DIRECT_URL = process.env.DIRECT_URL ?? "";
const EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
const NOM = process.env.BOOTSTRAP_ADMIN_NOM ?? "Opérateur";
const PRENOM = process.env.BOOTSTRAP_ADMIN_PRENOM ?? "SyndicUp";

const COPRO_INTERNE = "SyndicUp — Plateforme";

function fatal(message: string): never {
  console.error(`bootstrap-admin : ${message}`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE) fatal("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY requis.");
if (!DIRECT_URL) fatal("DIRECT_URL requis (connexion directe Postgres).");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(EMAIL)) fatal("BOOTSTRAP_ADMIN_EMAIL invalide.");
if (PASSWORD.length < 12) fatal("BOOTSTRAP_ADMIN_PASSWORD : 12 caractères minimum.");

const prisma = new PrismaClient({ datasourceUrl: DIRECT_URL });

async function adminApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

/** Crée le compte GoTrue (ou récupère son uuid s'il existe déjà). */
async function creerCompteAuth(): Promise<string> {
  const creation = await adminApi("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (creation.ok) {
    const { id } = (await creation.json()) as { id: string };
    console.log(`✔ compte GoTrue créé : ${EMAIL} (${id})`);
    return id;
  }
  // Déjà existant → retrouver l'uuid (idempotence : relancer le script est sans danger).
  const corps = await creation.text();
  if (creation.status !== 422 && !corps.includes("already been registered")) {
    fatal(`création GoTrue refusée (${creation.status}) : ${corps.slice(0, 200)}`);
  }
  const recherche = await adminApi(`/admin/users?page=1&per_page=1&email=${encodeURIComponent(EMAIL)}`);
  if (!recherche.ok) fatal(`compte existant mais introuvable via l'API admin (${recherche.status}).`);
  const data = (await recherche.json()) as { users?: Array<{ id: string; email: string }> };
  const existant = data.users?.find((u) => u.email?.toLowerCase() === EMAIL);
  if (!existant) fatal("compte existant mais absent de la réponse admin — vérifier l'email.");
  console.log(`✔ compte GoTrue existant réutilisé : ${EMAIL} (${existant.id})`);
  return existant.id;
}

async function main() {
  const uid = await creerCompteAuth();

  // Profil applicatif — même uuid que GoTrue (le hook de claims lit les rôles par cet id).
  await prisma.utilisateur.upsert({
    where: { id: uid },
    update: { email: EMAIL, nom: NOM, prenom: PRENOM, statutCompte: "ACTIF" },
    create: {
      id: uid,
      email: EMAIL,
      nom: NOM,
      prenom: PRENOM,
      languePreferee: "FR",
      statutCompte: "ACTIF",
    },
  });
  console.log(`✔ profil utilisateur : ${PRENOM} ${NOM}`);

  // Copropriété interne — ancre du rôle SUPER_ADMIN (jamais présentée à un client).
  let interne = await prisma.copropriete.findFirst({ where: { nom: COPRO_INTERNE } });
  if (!interne) {
    interne = await prisma.copropriete.create({
      data: {
        nom: COPRO_INTERNE,
        adresse: "—",
        ville: "—",
        typeResidence: "IMMEUBLE_COLLECTIF",
        nbLots: 1,
      },
    });
    console.log(`✔ copropriété interne créée : ${COPRO_INTERNE}`);
  }

  const dejaRole = await prisma.roleUtilisateur.findFirst({
    where: { utilisateurId: uid, role: "SUPER_ADMIN" },
  });
  if (!dejaRole) {
    await prisma.roleUtilisateur.create({
      data: { utilisateurId: uid, coproprieteId: interne.id, role: "SUPER_ADMIN", actif: true },
    });
    console.log("✔ rôle SUPER_ADMIN attribué");
  } else {
    console.log("✔ rôle SUPER_ADMIN déjà présent");
  }

  console.log(
    `\nTerminé. Connexion : ${EMAIL} (onglet Email) → la console plateforme est sous /admin.\n` +
      "⚠️ Nouveau jeton requis : si une session existait déjà, se déconnecter/reconnecter."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
