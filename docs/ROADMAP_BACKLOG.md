# Roadmap & Backlog — de la Phase 1 (Master Spec Partie 17) à des unités codables

Le Master Spec scope le MVP au niveau "domaine" (Partie 17.2). Ce document le découpe en unités
assez petites pour une session de développement délibérée. L'ordre reflète les dépendances réelles
(RLS et auth avant tout le reste, finances avant AG car l'AG vote des budgets, etc.) — ne pas
réordonner sans relire les dépendances indiquées.

Convention de case à cocher : `[ ]` à faire, chaque module se termine seulement quand sa ligne de
Definition of Done (`CLAUDE.md` §4) est entièrement cochée pour tous ses endpoints.

---

## M0 — Fondations infra (bloquant tout le reste)

- [ ] Projets Supabase créés : dev (ou Docker local), staging, production
- [ ] Projets Vercel créés : `api`, `web`
- [ ] Repo GitHub initialisé à partir de ce scaffold, secrets CI configurés (voir `.env.example`)
- [ ] Pipeline CI (`.github/workflows/ci.yml`) vert sur un commit vide
- [ ] Sentry, Axiom/Better Stack, Inngest, FCM : projets créés et clés dans les env vars (staging au minimum ; production peut suivre)
- [ ] Domaine réservé + Resend configuré (SPF/DKIM/DMARC vérifiés)

## M1 — Schéma de base & RLS de base (aucune feature encore)

*Réf. Master Spec Partie 2, 2.3. Aucun Doc A spécifique — c'est la fondation multi-tenant.*

- [x] `packages/database/prisma/schema.prisma` : tables `copropriete`, `utilisateur`, `role_utilisateur` (voir version de départ déjà dans ce scaffold)
- [ ] Migration initiale appliquée en local + staging *(local ✔ — staging en attente du projet Supabase, M0(b))*
- [x] Policy RLS `tenant_isolation` sur chaque table dès sa création (pas après coup)
- [x] Middleware `apps/api/lib/tenant/` : injection `copropriete_id`/`role`/`utilisateur_id` via `SET LOCAL` depuis le JWT vérifié
- [x] Wrapper client Prisma qui rend une requête sans scope tenant impossible à exécuter par erreur
- [x] Test de sécurité : un rôle `proprietaire` ne peut lire aucune ligne hors de sa copropriété même en modifiant un ID dans la requête

## M2 — Auth & onboarding

*Réf. Master Spec Partie 4, Partie 5. Doc A : `docs/domain-reference/11-onboarding-cycle-vie.md`.*

- [ ] Supabase Auth configuré : OTP téléphone + email/mot de passe
- [ ] `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/login`, `POST /auth/refresh`
- [ ] Table `invitation` (email/SMS/QR) + `POST /auth/invite/accept`
- [ ] Machine à états compte utilisateur (`INVITE → EN_VALIDATION → ACTIF → SUSPENDU/DESACTIVE/ANONYMISE`)
- [ ] `apps/api/lib/auth/permissions.ts` rempli pour les modules livrés jusqu'ici (voir squelette fourni)
- [ ] Edge cases Partie 5.5 testés : email déjà utilisé, code expiré, doublon de compte

## M3 — Lots, propriété, occupation (cœur du domaine, pas encore de finances)

*Réf. Master Spec Partie 2.2. Doc A : `01-lots-taxonomie.md`, `02-proprietaires-occupants-statuts.md`.*

- [ ] Tables `lot`, `lot_proprietaire`, `lot_occupant`, `espace_commun`, `succession`
- [ ] Contrainte : somme des `quote_part` d'un lot en indivision = 100 % (CHECK + trigger)
- [ ] Contrainte : somme des tantièmes d'une copropriété = total du règlement (trigger + alerte syndic bloquante)
- [ ] `GET/POST /lots`, `GET/PATCH /lots/:id`, `POST /lots/:id/proprietaires`, `POST /lots/:id/occupants`
- [ ] Cas indivision (Doc A §2.4), succession (Doc A §2.5), personne morale (Doc A §2.7) — ce dernier peut glisser en Phase 2 si le temps presse (Partie 17.3)
- [ ] Web : écran liste des lots + fiche lot (RTL testé dès cette première UI)

## M4 — Transfert de propriété

*Réf. Master Spec Partie 5.4.*

- [ ] `POST /lots/:id/transfert-propriete`
- [ ] Vérification solde de charges / flag `dette_reprise_acquereur`
- [ ] `audit_log: LOT_TRANSFERT_PROPRIETE`, historique conservé sur le lot pas sur le compte

## M5 — Moteur financier

*Réf. Master Spec Partie 6. Doc A : `03-charges-finances.md`. ⚠️ dépend de `docs/LEGAL_QUESTIONS_BRIEF.md` §3 pour rien — les délais d'escalade impayés (N0-N6) sont déjà détaillés dans Doc A §3.3, pas des paramètres légaux flous, donc ce module n'est pas bloqué par le brief juridique.*

- [ ] `apps/api/lib/money/` : arithmétique décimale, aucune valeur financière codée ailleurs
- [ ] Tables `budget_ag` (stub, vrai contenu voté en M6), `appel_de_fonds`, `appel_de_fonds_lot`, `paiement`, `quittance`, `fonds_reserve` + `fonds_reserve_mouvement`, `contestation_charge`
- [ ] `POST /finances/appels-de-fonds` (génération batch), idempotence sur période+type
- [ ] Escalade impayés N0→N6 (Doc A §3.3) : job Inngest quotidien, chaque palier avec son délai et son template
- [ ] Intégration CMI : `POST /finances/paiements/cmi/initier`, webhook signé HMAC, idempotence stricte sur `reference_cmi`
- [ ] Génération quittance automatique à `montant_paye == montant_du`
- [ ] Test critique : somme des lignes d'un appel de fonds = montant total à la centime près
- [ ] Test critique : idempotence du webhook CMI rejoué deux fois

## M6 — Assemblées Générales

*Réf. Master Spec Partie 8. Doc A : `06-assemblees-generales.md`. ⚠️ BLOQUÉ tant que `docs/LEGAL_QUESTIONS_BRIEF.md` §0-4 n'a pas de réponse d'avocat — en particulier le point §0 (Loi 30-24) peut changer qui a le droit de convoquer une AG.*

- [ ] Confirmer avec l'avocat avant de coder : délai convocation, quorum + mécanisme 2e convocation, grille majorités par résolution, limite procuration, impact Loi 30-24 sur `POST /ag`
- [ ] Tables `assemblee_generale`, `ag_resolution`, `ag_vote` (append-only), `ag_procuration`, `ag_pv` (append-only), `ag_notification_log`
- [ ] Machine à états incluant le cas "quorum non atteint → deuxième convocation" si confirmé par l'avocat
- [ ] `POST /ag`, `POST /ag/:id/convoquer`, `POST /ag/:id/resolutions`, `POST /ag/:id/votes`, `POST /ag/:id/cloturer`, `GET /ag/:id/pv`
- [ ] Génération PV automatique (React-PDF) + hash SHA-256 à la clôture
- [ ] Test critique : égalité parfaite 50/50 → résolution rejetée
- [ ] Test critique : blocage de vote si indivisaire n'a pas payé (Doc A §2.4)
- [ ] Test critique : vote anonymisé pour le résident, nominatif pour le syndic

## M7 — Incidents

*Réf. Master Spec Partie 2.2. Doc A : `05-incidents-interventions.md`.*

- [ ] Tables `incident`, `incident_log`, `prestataire`
- [ ] `GET/POST /incidents`, `PATCH /incidents/:id/statut`, `POST /incidents/:id/assign`
- [ ] Urgence maximale → notification mass-push (voir M9)
- [ ] Frontière parties communes/privatives (Doc A §5.2)

## M8 — Parties communes

*Réf. Master Spec Partie 2.2, 9.4. Doc A : `07-parties-communes.md`.*

- [ ] Table `reservation_espace_commun`
- [ ] `GET /espaces-communs`, `POST /reservations`, `PATCH /reservations/:id`

## M9 — Notifications & documents

*Réf. Master Spec Partie 7, 9. Doc A : preuve d'envoi croise `12-conflits-litiges-confidentialite.md`.*

- [ ] Table `notification` (append-only), `document`
- [ ] Templates FR/AR par `template_code`, rendu selon `langue_preferee`
- [ ] Intégration FCM (push), SMS (⚠️ dépend du choix d'agrégateur — voir note en fin de document), Resend (email)
- [ ] Stockage Supabase Storage avec URL signée 15 min, structure de buckets Partie 9.3
- [ ] Matrice événement → canal → destinataire (Partie 7.1) implémentée entièrement, pas juste les cas AG

## M10 — Personnel / gardien (+ offline mobile)

*Réf. Master Spec Partie 2.2, 13.3. Doc A : `09-personnel-gardien.md`.*

- [ ] Tables `personnel`, `visite`
- [ ] `GET/POST /personnel`, `POST /visites`, `PATCH /visites/:id/statut`
- [ ] Mobile : `apps/mobile/lib/offline/` — sync queue Drift/SQLite, écriture optimiste, résolution "dernière écriture gagne" (visites uniquement, jamais finances)

## M11 — Litiges

*Réf. Master Spec Partie 2.2. Doc A : `12-conflits-litiges-confidentialite.md`. ⚠️ dépend potentiellement de `docs/LEGAL_QUESTIONS_BRIEF.md` §0 (conciliation préalable Loi 30-24) avant de figer le workflow.*

- [ ] Table `conflit_litige`
- [ ] `GET/POST /litiges`, `PATCH /litiges/:id/escalade`
- [ ] Étape de conciliation modélisée si confirmée par l'avocat

## M12 — Web & Mobile : montée en gamme transverse

Pas un module séquentiel — chaque module ci-dessus livre son écran web + mobile correspondant au
fil de l'eau plutôt qu'en bloc à la fin, pour rester testable en continu. Rappels transverses :

- [ ] Accessibilité WCAG 2.1 AA vérifiée à chaque écran, pas en audit final
- [ ] RTL testé à chaque écran, pas en audit final
- [ ] `apps/web` : layout `(dashboard)` résout le rôle **côté serveur**, jamais un simple masquage CSS

## M13 — Anonymisation CNDP & conformité

*Réf. Master Spec Partie 5.6, 10.1. Dépend de `docs/LEGAL_QUESTIONS_BRIEF.md` §5-6.*

- [ ] Job Inngest mensuel d'anonymisation
- [ ] Déclaration préalable du traitement déposée sur portail.cndp.ma (démarche administrative, pas du code — cf. brief juridique §6)
- [ ] CGU + politique de confidentialité FR/AR publiées et liées

## M14 — Avant ouverture publique

*Réf. Master Spec Partie 16.3, 13.6, 11.6.*

- [ ] Cohorte pilote 2-3 copropriétés réelles en staging, un cycle mensuel complet
- [ ] Test de charge k6 sur les deux pics identifiés (notif massive AG, génération batch appels de fonds)
- [ ] Checklist soumission stores (comptes développeur actifs, écrans de démo FR+AR, permissions justifiées)
- [ ] Test de pénétration externe

---

## Notes de dépendance externe (non-code, à suivre en parallèle — pas dans l'ordre des modules)

- **Agrégateur SMS** : nécessaire pour tester M2 (OTP) et M9 (notifications) en conditions réelles — mais le module peut se construire contre un mock/sandbox en attendant. Ne bloque pas le début du code, bloque le test end-to-end réel.
- **Compte marchand CMI** : nécessaire pour tester M5 en conditions réelles — même logique, construire contre le sandbox CMI (documentation à obtenir séparément) en attendant l'ouverture du compte bancaire.
- **Comptes Apple/Google Developer** : à créer dès que possible, ne bloquent rien avant M14.
