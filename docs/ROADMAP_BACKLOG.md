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

- [x] Supabase Auth configuré (local) : OTP téléphone (`test_otp` + provider Twilio factice requis par GoTrue) + email/mot de passe ; `custom_access_token_hook` injecte `roles`
- [x] `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/login`, `POST /auth/refresh`
- [x] Table `invitation` (email/SMS/QR/WhatsApp) + `POST /auth/invite/accept` + `POST/GET /invitations`, `POST /invitations/:id/regenerer`
- [x] Machine à états compte utilisateur (`INVITE → EN_VALIDATION → ACTIF → SUSPENDU/DESACTIVE/ANONYMISE`) — `lib/auth/account-state.ts`
- [x] `apps/api/lib/auth/permissions.ts` : entrées onboarding ajoutées (`onboarding.inviter`, `onboarding.lister_invitations`)
- [x] Edge cases Partie 5.5 testés manuellement contre Supabase local : code déjà utilisé (409), code invalide/expiré (404), régénération bloquée si déjà acceptée (409) ; email/téléphone dupliqué implémenté dans `invitation_accepter` (SQL) mais pas encore couvert par un test automatisé
- [ ] Automatiser le test HTTP bout-en-bout (actuellement manuel) — nécessite soit un mock GoTrue, soit un job CI dédié avec conteneur `supabase/gotrue`
- [ ] **Écrans M2 non livrés** (écart au non-négociable n°4, signalé — pas résolu en silence) : login/OTP/acceptation d'invitation web (`apps/web`) + mobile (`apps/mobile`, FR/AR + RTL). `apps/web` et `apps/mobile` sont encore des placeholders — à rattraper au plus tard avec la première UI de M3, sinon consigner l'exception dans `docs/PARITE_WEB_MOBILE.md`

## M3 — Lots, propriété, occupation (cœur du domaine, pas encore de finances)

*Réf. Master Spec Partie 2.2. Doc A : `01-lots-taxonomie.md`, `02-proprietaires-occupants-statuts.md`.*

- [x] Tables `lot`, `lot_proprietaire`, `lot_occupant`, `espace_commun`, `succession` (migration `20260817170000_m3_lots_propriete_occupation`) ; FK `invitation.lot_id` posée (placeholder UUID brut depuis M2)
- [x] Contrainte : somme des `quote_part` actives d'un lot = 100 % (`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` — s'applique au plein propriétaire unique comme à l'indivision, Doc A §2.4)
- [x] Contrainte : somme des tantièmes d'une copropriété ≤ total du règlement (trigger bloquant) — ajout du champ `copropriete.total_tantiemes` (absent du tableau Master Spec Partie 2.2, nécessaire pour cette contrainte ; nullable, non bloquant tant que le syndic ne l'a pas configuré — signalé, pas une valeur légale au sens `LEGAL_QUESTIONS_BRIEF.md`)
- [x] `GET/POST /lots`, `GET/PATCH /lots/:id`, `POST /lots/:id/proprietaires`, `POST /lots/:id/occupants` + `apps/api/lib/lots/` (schémas Zod, service, permissions `lots.*`)
- [x] Cas indivision (Doc A §2.4) : testé (`tests/lots.test.ts`, plein propriétaire unique + deux indivisaires 50/50 dans la même transaction)
- [x] Cas succession (Doc A §2.5) : table + RLS (accès syndic/conseil syndical + défunt/contact temporaire) ; **endpoints dédiés (désignation héritiers, clôture) non implémentés** — signalé comme TODO explicite (le lot reste lisible/modifiable par le syndic en attendant)
- [ ] Cas personne morale (Doc A §2.7) : reporté en Phase 2 comme prévu (Partie 17.3) — **limite connue** : la policy RLS `tenant_isolation` sur `lot` ne résout pas la visibilité via une SCI représentée (seul le représentant nommé dans `lot_proprietaire` compte aujourd'hui)
- [ ] Web : écran liste des lots + fiche lot — **différé** avec tout le reste de l'UI M2/M3 par décision explicite du propriétaire du projet (17/08/2026, voir `docs/PARITE_WEB_MOBILE.md`), backend-first jusqu'à ce que le schéma/RLS/API soit jugé complet

## M4 — Transfert de propriété

*Réf. Master Spec Partie 5.4.*

⚠️ **Conflit d'ordre de dépendance signalé et tranché avec l'humain (18/08/2026)** : l'étape 2 du
flux (vérification solde de charges) dépend du moteur financier M5, qui vient APRÈS M4 dans ce
document. Décision retenue : construire la mécanique M4 maintenant avec la vérification de solde
explicitement stubbée, à câbler sur `GET /finances/lots/:id/solde` une fois M5 livré (voir
`apps/api/lib/lots/lots.ts::transfererPropriete` pour le détail).

**Câblage réel livré (24/08/2026)** : `transfererPropriete` calcule désormais le solde réel du
lot (Σ montant_du - montant_paye sur `appel_de_fonds_lot`) — transfert bloqué (422) si dette > 0
sans `dette_reprise_acquereur = true` ; le solde au moment du transfert est tracé dans
l'audit_log (`solde_du_au_transfert`, `solde_charges_verifie_automatiquement: true`). Tests
dédiés dans `tests/lot-transfert.test.ts`.

- [x] `POST /lots/:id/transfert-propriete` (migration `20260818190000_m4_transfert_propriete_audit_log`)
- [x] Flag `dette_reprise_acquereur` — **champ requis** (pas de défaut) ; vérification réelle du solde câblée sur M5 (24/08/2026) — le flag n'est exigé que quand une dette existe réellement, sinon transfert libre
- [x] `audit_log: LOT_TRANSFERT_PROPRIETE` — table `audit_log` créée (append-only, RLS, `copropriete_id` ajouté au-delà du tableau Master Spec littéral pour permettre l'isolation tenant, comme `copropriete.total_tantiemes` en M3)
- [x] Historique conservé sur le lot : `lot_proprietaire.date_fin` fermé plutôt que supprimé
- [x] **Interprétation signalée** (à confirmer humainement si divergente de l'intention du spec) : "ancien compte propriétaire → DESACTIVE" est implémenté comme `role_utilisateur.actif = false` (ce rattachement précis), PAS `utilisateur.statut_compte = DESACTIVE` (compte global) — `utilisateur` étant une table globale (Partie 1.6), désactiver tout le compte pour la vente d'UN lot couperait l'accès de la personne ailleurs
- [x] **Limite connue** : l'indivision (>1 copropriétaire actif) n'est pas gérée par cet endpoint — rejet explicite 422, traitement manuel via `lot_proprietaire`
- [x] **Gap signalé** (pré-existant, pas introduit ici) : `invitation_accepter` (M2) ne crée jamais de ligne `lot_proprietaire` — le syndic doit appeler `POST /lots/:id/proprietaires` (M3) une fois l'invitation du nouveau propriétaire acceptée
- [x] Tests (`tests/lot-transfert.test.ts`) : permission refusée, lot introuvable, aucun copropriétaire actif, indivision rejetée, transfert nominal complet (fermeture ligne + désactivation rôle + compte global intact + invitation + audit_log)

## M5 — Moteur financier

*Réf. Master Spec Partie 6. Doc A : `03-charges-finances.md`. ⚠️ dépend de `docs/LEGAL_QUESTIONS_BRIEF.md` §3 pour rien — les délais d'escalade impayés (N0-N6) sont déjà détaillés dans Doc A §3.3, pas des paramètres légaux flous, donc ce module n'est pas bloqué par le brief juridique.*

- [x] `apps/api/lib/money/` : arithmétique décimale (`decimal.js`), aucune valeur financière codée ailleurs (déjà présent avant M5, consommé par `apps/api/lib/finances/finances.ts`)
- [x] Tables `budget_ag` (stub, vrai contenu voté en M6), `appel_de_fonds`, `appel_de_fonds_lot`, `paiement`, `quittance`, `fonds_reserve` + `fonds_reserve_mouvement`, `contestation_charge` (migration `20260819100000_m5_moteur_financier`) — RLS confidentialité stricte sur `appel_de_fonds_lot`/`paiement`/`quittance`/`contestation_charge` (syndic/conseil syndical voient tout, résident ne voit que son lot) ; `fonds_reserve`/`fonds_reserve_mouvement` restreints syndic/conseil syndical uniquement (**extension conservatrice au-delà du Master Spec littéral, à revoir si le produit veut plus de transparence résident**)
- [x] `POST /finances/appels-de-fonds` (génération batch, algorithme Partie 6.2 : budget_ag ACTIF requis, répartition au prorata des tantièmes, écart d'arrondi absorbé par le dernier lot), idempotence sur (copropriete_id, période, type) → 409
- [x] `GET /finances/appels-de-fonds`, `GET /finances/lots/:id/solde`, `POST /finances/paiements` (paiement manuel virement/espèces/chèque), `POST /finances/quittances/:id`, `POST /finances/contestations` + `POST /finances/contestations/:id/reponse` (Doc A §3.3 "Cas Particuliers")
- [x] Intégration CMI : `POST /finances/paiements/cmi/initier`, `POST /finances/paiements/cmi/webhook` signé HMAC-SHA256, idempotence stricte sur `reference_cmi` (unique en DB, vérifiée avant toute autre règle métier)
- [x] Génération quittance automatique à `montant_paye == montant_du` (numéro `QT-<8 premiers caractères de l'id>-<timestamp>` — **format simple, pas de séquence fiscale annuelle**, à revoir si une numérotation réglementaire est requise)
- [x] Test critique : somme des lignes d'un appel de fonds = montant total à la centime près (`tests/finances.test.ts`)
- [x] Test critique : idempotence du webhook CMI rejoué deux fois (`tests/finances.test.ts`)
- [x] Trop-perçu (Doc A §3.4) : `CHECK` DB (`montant_paye <= montant_du OR trop_percu_autorise`) + flag `accepter_trop_percu` explicite côté payload — rejet 422 sinon. **Pas de workflow REMBOURSER/REPORTER** (Doc A §3.4) — seul l'enregistrement du trop-perçu est supporté, la décision syndic reste manuelle/hors plateforme pour l'instant.
- [ ] **Limite connue (signalée, pas résolue en silence)** : pas d'imputation FIFO multi-lignes des paiements (Doc A §3.4 "paiement partiel imputé sur les charges les plus anciennes") — chaque paiement cible explicitement UNE `appel_de_fonds_lot_id` (cohérent avec le flux CMI Partie 6.4 qui prend cet id en entrée). Un vrai FIFO multi-lignes nécessiterait un modèle de répartition non présent dans le Master Spec littéral — à construire explicitement si demandé.
- [ ] **Écart signalé** : aucune table de "session CMI" n'existe (absente du Master Spec Partie 2.2) — la cible du paiement (`appel_de_fonds_lot_id`) est encodée dans l'`oid` transmis à CMI et re-vérifiée par HMAC au webhook plutôt que stockée. **Non testé contre un vrai bac à sable CMI** (aucun credential commerçant dans ce repo) — `CMI_HMAC_SECRET` à renseigner dans `.env.local`/secrets CI.
- [x] Escalade impayés N0→N6 (Doc A §3.3) : moteur livré dans `apps/api/lib/finances/escalade.ts` — délais J+3/15/30/45/60/90 surchargeables par `copropriete.politique_recouvrement_json`, passe idempotente (jamais deux notifications pour le même palier grâce à `niveau_escalade`/`derniere_escalade_le`), lignes contestées exclues (Doc A §3.3 Cas Particuliers), notification copropriétaire à chaque palier + alerte syndic à partir de N4, audit_log `IMPAYE_ESCALADE` acteur système. Tests `tests/escalade.test.ts` (7). **Reste à brancher** : le déclencheur cron quotidien (Inngest non câblé — `apps/api/inngest/` n'est qu'un README ; `executerEscaladeImpayesToutesCoproprietes()` est le point d'entrée prêt) et les PDF N2/N3/N6 (module Documents incomplet), plan d'apurement N4 sans table d'échéancier dédiée (à modéliser si demandé).
- [ ] **Non livré** : `budget_ag` n'a pas d'endpoint CRUD dédié (Doc A §6 : "voté en AG") — seule la lecture par `genererAppelDeFonds` existe ; création/vote réel dépend de M6 (Assemblées Générales), cohérent avec le stub déjà noté sur la table (`ag_id` sans FK, M6 pas livré).
- [ ] Web/mobile : écrans finances (solde, historique paiements, paiement CMI, quittances) — **différés** avec le reste de l'UI, backend-first (voir `docs/PARITE_WEB_MOBILE.md`)

## M6 — Assemblées Générales

*Réf. Master Spec Partie 8. Doc A : `06-assemblees-generales.md`. ⚠️ Module légalement sensible —
`docs/LEGAL_QUESTIONS_BRIEF.md` §0-4 n'a toujours pas de réponse d'avocat. Décision explicite prise
avec l'humain (23/08/2026) : construire la STRUCTURE et les mécaniques de calcul déjà données noir
sur blanc par le Master Spec (quorum/majorité, Partie 8.3/8.4), mais bloquer (422 explicite,
`ContrainteMetierError`) toute opération dépendant d'une VALEUR légale encore disputée — jamais de
valeur par défaut devinée. Si l'avocat confirme que la Loi 30-24 change qui a le droit de convoquer
une AG, revoir `apps/api/lib/auth/permissions.ts::"ag.creer"` (actuellement syndic-only) AVANT
mise en production.*

- [x] Tables `assemblee_generale`, `ag_resolution`, `ag_vote` (append-only), `ag_procuration`, `ag_pv` (append-only), `ag_notification_log` (append-only) — migrations `20260823120000_m6_assemblees_generales`, `20260823140000_m6_ag_lot_tantiemes_helper`, `20260823150000_m6_ag_procurations_actives_count`
- [x] Paramètres légaux disputés NON codés en dur : `copropriete.quorumPremiereConvocation` et `copropriete.limiteProcurationsMandataire` (nullables, en plus de `delaiConvocationJours` déjà posé en M1) — `POST /ag/:id/convoquer`, `POST /ag/:id/ouvrir` et la vérification de limite de procuration renvoient 422 explicite tant qu'ils ne sont pas configurés
- [x] **LIMITE CONNUE, signalée** : le mécanisme "quorum non atteint en 1re convocation → 2e convocation sans quorum" (Doc A §6.3) n'est PAS un état automatique de la machine à états — si le quorum manque à la clôture (`cloturerAg`), le syndic doit créer manuellement une NOUVELLE AG (2e convocation), voir commentaire en tête de `apps/api/lib/ag/ag.ts`
- [x] **LIMITE CONNUE, signalée** : le quorum (Master Spec Partie 8.3 : part des tantièmes des lots ayant émis au moins un vote) ne peut être vérifié qu'à la CLÔTURE, pas à l'ouverture — la plateforme ne modélise pas de "présence" indépendante du vote (pas de check-in physique)
- [x] `POST /ag`, `GET /ag`, `GET /ag/:id`, `POST /ag/:id/convoquer`, `POST /ag/:id/resolutions`, `POST /ag/:id/votes`, `POST /ag/:id/cloturer`, `GET /ag/:id/pv`
- [x] **Ajouts nécessaires au-delà de la liste littérale d'endpoints** (voir `apps/api/lib/auth/permissions.ts` pour la justification de chacun) : `POST /ag/:id/ouvrir` (transition CONVOQUEE→EN_COURS, Doc A §6.4 "Bouton Ouvrir l'AG"), `POST /ag/:id/annuler` (Doc A §12.2, motif obligatoire), `POST /ag/:id/resolutions/:id/finaliser` (calcule ADOPTEE/REJETEE — ne peut pas être automatique en continu vu l'écriture synchrone par vote, Partie 8.7), `GET /ag/:id/resolutions/:id/resultats` (agrégé, tous rôles) + `GET .../votes` (nominatif, syndic only), `POST/DELETE /ag/:id/procurations` (Doc A §6.5)
- [x] Génération automatique du PV à la clôture : `contenu_json` structuré + `hash_integrite` SHA-256 — la source de vérité juridique reste la ligne `ag_pv` en base, le PDF n'en est qu'un rendu
- [x] Anonymisation des résultats (Doc A §12.3) : fonction SQL `SECURITY DEFINER` `ag_resultats_resolution` (agrégats uniquement, jamais nominatif) utilisée par tous les rôles ; RLS sur `ag_vote` restreint la lecture directe de table au syndic/conseil syndical ou à sa propre ligne
- [x] Test critique : égalité parfaite 50/50 → résolution rejetée
- [x] Test critique : blocage de vote si indivisaire n'a pas payé (Doc A §2.4) — vérifié uniquement pour ce rôle explicite, pas une règle générale de blocage débiteur (non confirmée par Doc A §6.3)
- [x] Test critique : vote anonymisé pour le résident, nominatif pour le syndic
- [x] Tests (`tests/ag.test.ts`, 21 tests) : convocation (délai légal + non configuré), ouverture (date + quorum non configuré), majorité SIMPLE/DOUBLE/UNANIMITE, indivision (représentant désigné + impayé), procurations (vote par mandataire + limite légale), clôture/quorum/PV, annulation
- [x] Génération du PDF du PV (24/08/2026) : `lib/ag/pv-pdf.tsx` (`@react-pdf/renderer`, rendu FR, hash d'intégrité imprimé en pied de page) + téléversement Storage (`televerserDocument`, bucket privé `documents`, chemin `<copro>/ag-pv/<agId>.pdf`) câblé dans `cloturerAg` AVANT l'INSERT (`ag_pv` est append-only, pas d'UPDATE possible). **Best-effort signalé** : si le bucket n'est pas provisionné (cas du dev local, même limitation que M9), la clôture n'échoue pas — `pdf_url` reste null et l'échec est tracé dans l'audit_log (`pdf_erreur`). Rendu AR (RTL) non livré — même chantier que les templates FR/AR M9. Tests `tests/pv-pdf.test.ts` (2, rendu en mémoire — le happy path Storage reste non testable sans bucket)
- [ ] **Non livré** : Doc A §6.4 cas avancés non modélisés (élection bureau président/secrétaire, amendement en séance, vote à bulletin secret, retard admis en cours d'AG) — structure minimale seulement
- [ ] Web/mobile : écrans AG (convocation, vote, PV) — différés avec le reste de l'UI, backend-first (voir `docs/PARITE_WEB_MOBILE.md`)

## M7 — Incidents

*Réf. Master Spec Partie 2.2. Doc A : `05-incidents-interventions.md`.*

- [x] Tables `incident`, `incident_log` (append-only), `prestataire` (migration `20260819150000_m7_incidents`)
- [x] `GET/POST /incidents`, `PATCH /incidents/:id/statut`, `POST /incidents/:id/assign`
- [x] **Ajout nécessaire au-delà du tableau Master Spec littéral** : `GET/POST /prestataires` — aucun endpoint dédié n'existe dans le tableau Partie 3.2, mais `POST /incidents/:id/assign` a besoin d'un référentiel `prestataire_id` à choisir ; écriture réservée au syndic (voir `apps/api/lib/auth/permissions.ts::"prestataires.gerer"`)
- [x] **Écart signalé** : `CategorieIncident` reprend les 11 catégories de Doc A §5.1 (Doc A fait autorité sur le métier) plutôt que le champ texte libre du tableau Master Spec littéral, même logique que `TypeAppelDeFonds` en M5
- [x] **Écart signalé, non résolu** : `UrgenceIncident` ne garde que les 3 valeurs du Master Spec (normale/urgente/urgence_maximale) alors que Doc A §5.1 distingue en réalité un 4ᵉ palier intermédiaire "TRÈS URGENT" (ex. ascenseur bloqué avec personne, structure à risque d'effondrement) — ces cas sont classés en `URGENCE_MAXIMALE` par défaut (délai réel le plus proche, 30 min) faute de valider un 4ᵉ palier non demandé explicitement par le schéma technique ; à corriger si le produit confirme le besoin
- [x] **Simplification signalée** : `sla_deadline` est calculé uniquement à partir du palier d'urgence (48h / 4h / 30min — `apps/api/lib/incidents/incidents.ts::SLA_HEURES`), pas la grille fine par catégorie/sous-catégorie de Doc A §5.1 (30 min à 1 semaine selon le cas précis) — à affiner si demandé
- [x] **Extension conservatrice** : `prestataire.utilisateur_id` (nullable) ajouté au tableau Master Spec littéral pour porter la confidentialité RLS "un prestataire ne voit que son propre ticket" (Doc A §12.3) — sans ce lien, aucune policy ne peut relier un compte `role_utilisateur.role = PRESTATAIRE` à sa fiche
- [x] **Décision produit documentée** : l'assignation d'un ticket `OUVERT` le fait passer automatiquement en `EN_COURS` — pas dicté explicitement par le Master Spec, cohérent avec Doc A §5.3
- [x] Confidentialité RLS (Doc A §12.3) : syndic/conseil syndical/gardien voient tout ; un résident ne voit que les incidents qu'il a créés ("les siens") ; un prestataire ne voit que les incidents qui lui sont assignés — vérifié en double (RLS + `assertPrestataireAssigne` applicatif, défense en profondeur Partie 1.6)
- [x] `incidents.changer_statut` étend le tableau Master Spec littéral ("syndic/prestataire") en ajoutant le gardien, cohérent avec les workflows Doc A §5.3 ("Mise à jour statut toutes les 15 min")
- [x] Tests (`tests/incidents.test.ts`, 16 tests) : création + calcul SLA par palier, refus PRESTATAIRE à la création, confidentialité RLS (syndic voit tout / résident voit les siens / prestataire voit seulement l'assigné), assignation avec passage automatique en EN_COURS, rejet cross-tenant, changement de statut par le prestataire assigné vs refusé pour un autre, gardien autorisé, gestion prestataires, validation Zod
- [ ] **Non livré** : notification mass-push sur urgence maximale (dépend de M9, pas encore livré)
- [ ] **Non livré** : guidage produit sur la frontière parties communes/privatives (Doc A §5.2) — modélisé aujourd'hui uniquement par le champ `partie` (COMMUNE/PRIVATIVE) déclaré par le créateur, pas d'arbitrage automatique ni d'expertise assistée
- [ ] Web/mobile : écrans incidents (signalement, suivi, photos) — différés avec le reste de l'UI, backend-first (voir `docs/PARITE_WEB_MOBILE.md`)

## M8 — Parties communes

*Réf. Master Spec Partie 2.2, 9.4. Doc A : `07-parties-communes.md`.*

- [x] Table `reservation_espace_commun` (migration `20260823160000_m8_parties_communes`)
- [x] `GET/POST /espaces-communs`, `GET/POST /reservations`, `PATCH /reservations/:id`
- [x] **Ajout nécessaire** : `espace_commun.validation_automatique` (Doc A §7.2 "Validation manuelle ou auto selon paramètre" — absent du tableau Master Spec littéral)
- [x] **Ajouts nécessaires** : `POST /reservations/:id/valider` et `POST /reservations/:id/rejeter` (workflow de validation manuelle syndic, Doc A §7.2) ; `reservation_espace_commun.utilisateur_id` (auteur, peut différer du propriétaire du lot — ex. locataire) et `nombre_invites` (Doc A §7.2 "Champ nombre_invites sur réservation")
- [x] Détection de conflit de créneau en temps réel (Doc A §7.2 "2 résidents veulent le même créneau") : rejet 422 si chevauchement avec une réservation EN_ATTENTE/CONFIRMEE existante sur le même espace ; `CHECK` DB `date_fin > date_debut`
- [x] Confidentialité : planning de réservation visible à tout membre du tenant (pas de donnée sensible, contrairement aux impayés/votes) — permet la détection de conflit résident sans passer systématiquement par le syndic
- [x] Tests (`tests/espaces-communs.test.ts`, 10 tests) : permission création syndic-only, réservation scoped à un lot possédé/occupé, validation/rejet manuel, détection de conflit (+ non-blocage après annulation), annulation (auteur vs tiers vs syndic), validation automatique
- [ ] **Non livré** : caution (Doc A §7.2 "engagement moral dans le MVP, pas de paiement en ligne"), réservations récurrentes, créneaux configurables par espace, compteur d'annulations tardives, bascule HORS_SERVICE avec annulation automatique des réservations futures
- [ ] Web/mobile : écrans réservation espaces communs — différés avec le reste de l'UI, backend-first (voir `docs/PARITE_WEB_MOBILE.md`)

## M9 — Notifications & documents

*Réf. Master Spec Partie 7, 9. Doc A : preuve d'envoi croise `12-conflits-litiges-confidentialite.md`.*

- [x] Table `notification` (append-only), `document` (migration `20260824090000_m9_notifications_documents`) — RLS : `document` filtré par `visibilite` (PUBLIC_COPROPRIETE/SYNDIC_ONLY/CONSEIL_SYNDICAL), `notification` boîte de réception strictement personnelle (aucune exception syndic, contrairement aux autres tables)
- [x] `GET/POST /documents`, `GET /documents/:id/telecharger` (URL signée), `GET /notifications`, `PATCH /notifications/:id/read` + `apps/api/lib/documents/`, `apps/api/lib/notifications/`
- [x] Stockage Supabase Storage avec URL signée 15 min (`apps/api/lib/storage/supabase-storage.ts`) — **non testé contre un bucket réel** (aucun bucket `documents` provisionné dans cet environnement, même limitation que le sandbox CMI en M5)
- [x] **Bug RLS non-évident trouvé et corrigé** : `Prisma.create()` fait un `INSERT ... RETURNING *` implicite ; Postgres applique la policy `SELECT` (pas seulement `WITH CHECK`) à la ligne renvoyée par un `RETURNING`, ce qui bloquait tout envoi de notification à un tiers (ex. syndic → résident) même quand le `WITH CHECK` était satisfait. `envoyerNotification` utilise désormais un `INSERT` brut sans `RETURNING` (voir commentaire dans `apps/api/lib/notifications/notifications.ts`).
- [x] Tests (`tests/documents-notifications.test.ts`, 7 tests) : permission création syndic-only, visibilité PUBLIC_COPROPRIETE/SYNDIC_ONLY/CONSEIL_SYNDICAL, boîte de réception personnelle, marquage lu, refus de marquer la notification d'autrui
- [x] `envoyerNotification` câblé dans `ag.ts::convoquerAg` (chaque destinataire actif reçoit une notification `AG_CONVOCATION` dans sa boîte de réception générique, en plus de `ag_notification_log` qui reste la preuve légale d'envoi append-only) et dans `incidents.ts::creerIncident` (mass-push `INCIDENT_URGENCE_MAXIMALE` à SYNDIC+GARDIEN quand `urgence = URGENCE_MAXIMALE`, Doc A §5.3) — tests dans `tests/ag.test.ts`/`tests/incidents.test.ts`
- [ ] **Non livré** : le reste de la matrice événement → canal → destinataire (Partie 7.1) — seuls les deux cas ci-dessus sont câblés ; paiement/quittance/résiliation/etc. ne déclenchent encore aucune notification
- [ ] **Non livré** : templates FR/AR par `template_code`, rendu selon `langue_preferee` — `template_code` est aujourd'hui une simple chaîne libre, aucun moteur de rendu/traduction
- [ ] **Non livré** : intégration réelle FCM (push), SMS (⚠️ dépend du choix d'agrégateur — voir note en fin de document), Resend (email) — `envoyerNotification` simule l'envoi en écrivant directement `statut_envoi = ENVOYE`, aucun agrégateur réel branché
- [ ] Web/mobile : écrans notifications/documents — différés avec le reste de l'UI, backend-first (voir `docs/PARITE_WEB_MOBILE.md`)

## M10 — Personnel / gardien (+ offline mobile)

*Réf. Master Spec Partie 2.2, 13.3. Doc A : `09-personnel-gardien.md`.*

- [x] Tables `personnel`, `visite` + RLS (migrations `20260824120000_m10_personnel_visites` et `20260824121500_m10_residents_actifs_fonction` — fonction SECURITY DEFINER `residents_actifs_du_lot` pour que le gardien identifie les résidents à notifier malgré les policies de `lot_proprietaire`/`lot_occupant`). ⚠️ Le tableau Master Spec Partie 2.2 référence "Doc A §7" pour `visite`, mais seul §9.2 traite du contrôle d'accès visiteurs — écart de renumérotation signalé, §9 fait autorité (commenté dans schema.prisma)
- [x] `GET/POST /personnel`, `PATCH /personnel/:id/statut` (ajout nécessaire — Doc A §9.2 "Gardien absent / remplacé"), `GET/POST /visites`, `PATCH /visites/:id/statut` — service `lib/personnel/personnel.ts`, permissions `personnel.lire`/`visites.creer`/`visites.lire` ajoutées à la matrice (l'entrée préexistante `personnel.autoriser_visiteur` gate la réponse autorise/refuse). Contraintes : fiche personnel exige un rôle GARDIEN actif préalable ; logement de fonction limité aux lots LOGE_GARDIEN ; workflow visite câblé sur M9 (`VISITE_NOUVELLE` en PUSH aux résidents actifs du lot à l'enregistrement, `VISITE_REPONSE` au gardien à la réponse). Tests `tests/personnel.test.ts` (12)
- [ ] Mobile : `apps/mobile/lib/offline/` — sync queue Drift/SQLite, écriture optimiste, résolution "dernière écriture gagne" (visites uniquement, jamais finances) — différé avec le reste de l'UI, backend-first. ⚠️ L'idempotence sur identifiant client (openapi.yaml `POST /visites`) n'est pas encore implémentée côté serveur — à faire quand la sync queue mobile existera

## M11 — Litiges

*Réf. Master Spec Partie 2.2. Doc A : `12-conflits-litiges-confidentialite.md`. ⚠️ dépend potentiellement de `docs/LEGAL_QUESTIONS_BRIEF.md` §0 (conciliation préalable Loi 30-24) avant de figer le workflow.*

- [x] Table `conflit_litige` + RLS (migration `20260824123000_m11_litiges`) — colonnes du tableau Master Spec Partie 2.2 + `cree_par` (ajout nécessaire : porteur du litige, support de la confidentialité RLS "un résident ne voit que SES litiges", Doc A §12.3) ; `type` reste un TEXT libre (Doc A §12.1 liste 8 familles sans nomenclature fermée — pas d'enum devinée) ; `escalade_niveau` CHECK 0-2 (0 traitement syndic, 1 médiation AG, 2 tribunal — workflow Doc A §12.1)
- [x] `GET/POST /litiges`, `PATCH /litiges/:id/escalade` (motif obligatoire, monotone, audit_log `LITIGE_ESCALADE`, porteur notifié via M9 `LITIGE_ESCALADE`), `PATCH /litiges/:id/statut` (ajout nécessaire — clôture RESOLU/CLOS, Doc A §12.1 "Explication syndic suffit souvent") — service `lib/litiges/litiges.ts`, permissions `litiges.creer/lire/escalader/resoudre` dans la matrice. Tests `tests/litiges.test.ts` (6)
- [ ] Étape de conciliation modélisée si confirmée par l'avocat (`LEGAL_QUESTIONS_BRIEF.md` §0 — signalée en commentaire dans le schéma, la migration et le contrat OpenAPI, non modélisée tant que non confirmée)

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
