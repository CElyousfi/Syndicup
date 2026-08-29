/**
 * Seed Supabase Auth LOCAL — crée dans `auth.users` (+ `auth.identities`) un compte GoTrue pour
 * chaque `utilisateur` seedé, avec le MÊME uuid (convention utilisateur.id ≡ auth uid, migration
 * m2 : le custom_access_token_hook lit les rôles par cet id). Sans ce script, aucun compte du
 * seed ne peut se connecter (ni email/mot de passe, ni OTP — GoTrue créerait un uid frais sans
 * rôle).
 *
 * STRICTEMENT LOCAL : refuse de tourner hors 127.0.0.1 (même garde-fou que seed.ts).
 * Mot de passe commun de démo : SyndicUp2026!
 *
 * Usage : npm run seed:auth --workspace=@copropriete-maroc/database
 */
import { PrismaClient } from "@prisma/client";

const MOT_DE_PASSE_DEMO = "SyndicUp2026!";

const direct = process.env.DIRECT_URL ?? "";
if (!direct.includes("127.0.0.1") && !direct.includes("localhost")) {
  console.error("seed-auth-local : DIRECT_URL ne pointe pas sur une base locale — abandon.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: direct });

async function main() {
  const utilisateurs = await prisma.utilisateur.findMany({
    select: { id: true, email: true, telephone: true, nom: true, prenom: true },
  });
  if (utilisateurs.length === 0) {
    console.error("Aucun utilisateur seedé — lancer d'abord `npm run db:seed`.");
    process.exit(1);
  }

  for (const u of utilisateurs) {
    // Email de connexion : celui du profil, sinon un email local de démo (l'identité GoTrue est
    // portée par l'uuid, pas par l'email — le profil applicatif reste inchangé).
    const email =
      u.email ??
      `${(u.prenom ?? "compte").toLowerCase()}.${(u.nom ?? u.id.slice(0, 8)).toLowerCase()}@demo.local`;
    const telephone = u.telephone ? u.telephone.replace(/^\+/, "") : null;

    // Purge les comptes GoTrue orphelins (créés par d'anciens tests/OTP) qui squattent l'email
    // ou le téléphone avec un AUTRE uuid — local uniquement, aucun risque de perte réelle.
    await prisma.$executeRawUnsafe(
      `DELETE FROM auth.users WHERE id <> $1::uuid AND (email = $2 OR ($3::text IS NOT NULL AND phone = $3))`,
      u.id,
      email,
      telephone
    );

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, phone, phone_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        -- GoTrue scanne ces colonnes texte en NOT NULL côté Go : NULL casse le login
        -- ("converting NULL to string is unsupported") — toujours '' pour un insert manuel.
        confirmation_token, recovery_token, email_change, email_change_token_new,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', $1::uuid, 'authenticated', 'authenticated',
        $2, crypt($3, gen_salt('bf')),
        now(), $4::text, CASE WHEN $4::text IS NULL THEN NULL ELSE now() END,
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', '', '', '', '', ''
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        phone = EXCLUDED.phone,
        phone_confirmed_at = EXCLUDED.phone_confirmed_at,
        confirmation_token = '', recovery_token = '', email_change = '',
        email_change_token_new = '', email_change_token_current = '',
        phone_change = '', phone_change_token = '', reauthentication_token = '',
        updated_at = now()
      `,
      u.id,
      email,
      MOT_DE_PASSE_DEMO,
      telephone
    );

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, $1::text,
        jsonb_build_object('sub', $1::text, 'email', $2, 'email_verified', true),
        'email', now(), now(), now()
      )
      ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = now()
      `,
      u.id,
      email
    );

    console.log(`✔ auth.users : ${email}${telephone ? ` / +${telephone}` : ""} (${u.id})`);
  }

  console.log(`\nComptes locaux prêts — mot de passe commun : ${MOT_DE_PASSE_DEMO}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
