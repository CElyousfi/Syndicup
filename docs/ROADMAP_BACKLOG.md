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
- [ ] Upstash Redis (rate limiting global multi-instances — le limiteur mémoire par instance suffit avant lancement)
- [ ] Compte marchand CMI (bac à sable puis production) — le payload webhook implémenté est une hypothèse à valider contre le contrat commerçant réel
- [ ] Agrégateur SMS marocain contractualisé (adaptateur `lib/notifications/transports/sms.ts` à finaliser sur son format)

*Tous les seams de code sont prêts (27/08) : chaque service ci-dessus s'active par variable
d'environnement (`.env.example`) sans changement de code, sauf CMI (payload à ajuster), FCM
(tokens d'appareils + OAuth2 avec le client mobile) et SMS (format agrégateur).*

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
- [x] Écrans M2 **web livrés (28/08/2026)** : login téléphone (OTP) / email, saisie du code, acceptation d'invitation, états de compte (validation/suspendu/sans accès), FR/AR + RTL — vérifiés par parcours automatisé multi-rôles (`apps/web`). **Mobile (`apps/mobile`) livré le 04/09/2026** : accueil, OTP/e-mail, invitation par code ou QR (caméra), sélecteur de copropriété, états de compte — FR/AR + RTL (écart résorbé, voir `docs/PARITE_WEB_MOBILE.md`)

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
- [x] ~~Pas d'imputation FIFO multi-lignes~~ **Livré (27/08)** : `POST /finances/paiements` accepte `lot_id` (mode FIFO — répartition par date d'échéance croissante, une ligne `paiement` append-only par affectation, audit `PAIEMENT_FIFO_AFFECTE`) en plus du mode ciblé `appel_de_fonds_lot_id`. **Écart restant signalé** : le surplus au-delà du dû total est rejeté 422 — le "paiement en avance" (avoir, Doc A §3.4) n'est pas modélisé.
- [x] ~~Écart signalé : aucune table de "session CMI"~~ **Levé (26/08, migration M12 `paiement_cmi_session`)** : la cible du paiement est persistée en session (oid unique), le webhook la résout via `cmi_session_copropriete_id()` (SECURITY DEFINER), signature HMAC comparée en temps constant (`timingSafeEqual`), variable standardisée `CMI_WEBHOOK_HMAC_SECRET`. Reste : **non testé contre un vrai bac à sable CMI** (aucun credential commerçant dans ce repo) — payload webhook à ajuster au contrat commerçant réel.
- [x] Escalade impayés N0→N6 (Doc A §3.3) : moteur livré dans `apps/api/lib/finances/escalade.ts` — délais J+3/15/30/45/60/90 surchargeables par `copropriete.politique_recouvrement_json`, passe idempotente (jamais deux notifications pour le même palier grâce à `niveau_escalade`/`derniere_escalade_le`), lignes contestées exclues (Doc A §3.3 Cas Particuliers), notification copropriétaire à chaque palier + alerte syndic à partir de N4, audit_log `IMPAYE_ESCALADE` acteur système. Tests `tests/escalade.test.ts` (7). **Cron branché (27/08)** : job Inngest quotidien `escalade-impayes-quotidienne` (`apps/api/inngest/functions/`). Restent les PDF N2/N3/N6 (module Documents incomplet), plan d'apurement N4 sans table d'échéancier dédiée (à modéliser si demandé).
- [x] ~~budget_ag sans CRUD~~ **Livré (27/08)** : `GET/POST /finances/budgets`, `GET/PATCH /finances/budgets/{id}` (modifiable en PROPOSE), `POST /finances/budgets/{id}/activer` (Idempotency-Key ; l'ACTIF existant du même exercice passe REMPLACE = budget rectificatif Doc A §3.2). Lien `ag_id` nullable vers la résolution AG. Audit BUDGET_CREE/MODIFIE/ACTIVE/REMPLACE. Tests `tests/budgets.test.ts` (5).
- [x] Web (28/08) + mobile (04/09) : écrans finances — solde ligne par ligne, contestation, budgets, appels de fonds, paiement ciblé/FIFO (syndic), quittance + PDF, comptabilité / mon relevé. CMI volontairement inactif (« bientôt disponible »)

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
- [x] Web (28/08) + mobile (04/09) : écrans AG — liste, création + résolutions, convocation/ouverture/annulation (état gaté légal), procurations (cas MRE), séance live (vue votant sombre + pupitre syndic), PV avec hash, détail nominatif syndic

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
- [x] Notification mass-push sur urgence maximale **livrée** : `notifierUrgenceMaximale` (apps/api/lib/incidents/incidents.ts) — destinataires SYNDIC + GARDIEN via le registre de templates M9 (`INCIDENT_URGENCE_MAXIMALE`), jamais l'auteur du signalement
- [ ] **Non livré** : guidage produit sur la frontière parties communes/privatives (Doc A §5.2) — modélisé aujourd'hui uniquement par le champ `partie` (COMMUNE/PRIVATIVE) déclaré par le créateur, pas d'arbitrage automatique ni d'expertise assistée
- [x] Web : écrans incidents **livrés (28/08/2026)** — signalement guidé (catégories, urgence avec garde-fou, **photos caméra/galerie compressées côté client**), suivi avec journal append-only et galerie photos (URLs signées 15 min via `GET /incidents/:id/photos`, colonne `photos` ajoutée — voir openapi.yaml). Mobile Flutter livré le 04/09 (signalement guidé caméra/galerie, détail + timeline, changement de statut, assignation prestataire)

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
- [x] Web (28/08) + mobile (04/09) : espaces communs (création syndic), réservation (créneau, conflit serveur annoncé), file de validation syndic, annulation

## M9 — Notifications & documents

*Réf. Master Spec Partie 7, 9. Doc A : preuve d'envoi croise `12-conflits-litiges-confidentialite.md`.*

- [x] Table `notification` (append-only), `document` (migration `20260824090000_m9_notifications_documents`) — RLS : `document` filtré par `visibilite` (PUBLIC_COPROPRIETE/SYNDIC_ONLY/CONSEIL_SYNDICAL), `notification` boîte de réception strictement personnelle (aucune exception syndic, contrairement aux autres tables)
- [x] `GET/POST /documents`, `GET /documents/:id/telecharger` (URL signée), `GET /notifications`, `PATCH /notifications/:id/read` + `apps/api/lib/documents/`, `apps/api/lib/notifications/`
- [x] Stockage Supabase Storage avec URL signée 15 min (`apps/api/lib/storage/supabase-storage.ts`) — **non testé contre un bucket réel** (aucun bucket `documents` provisionné dans cet environnement, même limitation que le sandbox CMI en M5)
- [x] **Bug RLS non-évident trouvé et corrigé** : `Prisma.create()` fait un `INSERT ... RETURNING *` implicite ; Postgres applique la policy `SELECT` (pas seulement `WITH CHECK`) à la ligne renvoyée par un `RETURNING`, ce qui bloquait tout envoi de notification à un tiers (ex. syndic → résident) même quand le `WITH CHECK` était satisfait. `envoyerNotification` utilise désormais un `INSERT` brut sans `RETURNING` (voir commentaire dans `apps/api/lib/notifications/notifications.ts`).
- [x] Tests (`tests/documents-notifications.test.ts`, 7 tests) : permission création syndic-only, visibilité PUBLIC_COPROPRIETE/SYNDIC_ONLY/CONSEIL_SYNDICAL, boîte de réception personnelle, marquage lu, refus de marquer la notification d'autrui
- [x] `envoyerNotification` câblé dans `ag.ts::convoquerAg` (chaque destinataire actif reçoit une notification `AG_CONVOCATION` dans sa boîte de réception générique, en plus de `ag_notification_log` qui reste la preuve légale d'envoi append-only) et dans `incidents.ts::creerIncident` (mass-push `INCIDENT_URGENCE_MAXIMALE` à SYNDIC+GARDIEN quand `urgence = URGENCE_MAXIMALE`, Doc A §5.3) — tests dans `tests/ag.test.ts`/`tests/incidents.test.ts`
- [x] **Partiellement livré (27/08)** : matrice 7.1 complétée pour — appel de fonds émis → propriétaires EMAIL+PUSH (fan-out Inngest idempotent), PV disponible → copropriétaires (+ locataires si `locataire_voit_pv`), changement de statut incident → créateur, rappels AG J-3. Restent : quittance générée, visiteur temps réel (Realtime), résiliation/divers.
- [x] ~~templates FR/AR~~ **Livré (27/08)** : registre `lib/notifications/templates.ts` (tous les codes émis couverts, interpolation {{param}}, code inconnu = erreur explicite), rendu selon `langue_preferee`. ⚠️ Chaînes AR = première passe machine, À FAIRE RELIRE par un locuteur natif avant production.
- [ ] **Seams livrés (27/08), intégrations réelles en attente de comptes (M0)** : adaptateurs env-gated `lib/notifications/transports/` — Resend (EMAIL, fonctionnel dès RESEND_API_KEY+RESEND_FROM+domaine DNS), FCM (stub explicite — tokens d'appareils + OAuth2 à finir avec le client mobile), SMS (stub — agrégateur à contractualiser). `envoyerNotification` écrit désormais le statut RÉEL retourné (EN_ATTENTE en dev via noop — plus jamais de ENVOYE simulé).
- [x] Web (28/08) + mobile (04/09) : centre de notifications (SSE live, deep-links), documents (URL signée 15 min, upload syndic). **M19 (04/09) — push FCM réel** : table `appareil_push` (migration m19, RLS), `POST/DELETE /users/me/appareils`, transport FCM HTTP v1 (OAuth2 service account, nettoyage des jetons invalides), enregistrement du jeton par l'app mobile
- [x] **M20 (04/09) — tout dans l'application + photos de la résidence.** (1) Documents, PV d'AG et quittances s'ouvrent DANS l'application sur les deux clients : web = visionneuse modale pdf.js/`<img>` alimentée par les proxys même-origine (`/api/document-inline`, `/api/pv-pdf`, `/api/quittance-pdf` désormais servis `inline`, `?download=1` pour télécharger) ; mobile = écran `/visionneuse` (pdfx page par page, image zoomable, partage `share_plus` pour les autres types) — plus aucun `launchUrl` vers le stockage. (2) Personnalisation par le syndic : colonne `copropriete.photos_json` (migration m20, `{ cle: chemin }` dans le périmètre `<copropriete>/branding/…` comme le logo), `GET /coproprietes/{id}/photos` (URLs signées 15 min, tout membre), `POST /coproprietes/{id}/photos/upload-url` (syndic), PATCH `photos_json`. Emplacements : `accueil` (carte héro), `entree` (lots, gardien, invitation), `cour` (documents, prestataires), `salle` (AG), `piscine`, `espace:<id>` (carte d'un espace commun). Section « Photos de la résidence » dans Paramètres (web + mobile), bandeaux photo sur lots / AG / documents / tableaux de bord gardien et prestataire ; image du produit par défaut pour tout emplacement absent.

## M10 — Personnel / gardien (+ offline mobile)

*Réf. Master Spec Partie 2.2, 13.3. Doc A : `09-personnel-gardien.md`.*

- [x] Tables `personnel`, `visite` + RLS (migrations `20260824120000_m10_personnel_visites` et `20260824121500_m10_residents_actifs_fonction` — fonction SECURITY DEFINER `residents_actifs_du_lot` pour que le gardien identifie les résidents à notifier malgré les policies de `lot_proprietaire`/`lot_occupant`). ⚠️ Le tableau Master Spec Partie 2.2 référence "Doc A §7" pour `visite`, mais seul §9.2 traite du contrôle d'accès visiteurs — écart de renumérotation signalé, §9 fait autorité (commenté dans schema.prisma)
- [x] `GET/POST /personnel`, `PATCH /personnel/:id/statut` (ajout nécessaire — Doc A §9.2 "Gardien absent / remplacé"), `GET/POST /visites`, `PATCH /visites/:id/statut` — service `lib/personnel/personnel.ts`, permissions `personnel.lire`/`visites.creer`/`visites.lire` ajoutées à la matrice (l'entrée préexistante `personnel.autoriser_visiteur` gate la réponse autorise/refuse). Contraintes : fiche personnel exige un rôle GARDIEN actif préalable ; logement de fonction limité aux lots LOGE_GARDIEN ; workflow visite câblé sur M9 (`VISITE_NOUVELLE` en PUSH aux résidents actifs du lot à l'enregistrement, `VISITE_REPONSE` au gardien à la réponse). Tests `tests/personnel.test.ts` (12)
- [x] Mobile (04/09) : `apps/mobile/lib/offline/` — file Drift/SQLite des visites, écriture optimiste, Idempotency-Key = id local (le serveur rejoue la réponse mémorisée : jamais de doublon), retry au retour du réseau + périodique, cache de lecture des lots. Reste : exécution en arrière-plan OS (WorkManager / BGTaskScheduler)

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
- [x] **Livré (29/08)** — Modifier/supprimer sur les données de référence, contract-first : `PATCH/DELETE /espaces-communs/{id}`, `PATCH/DELETE /prestataires/{id}`, `DELETE /documents/{id}` (téléversés uniquement — PV/quittances refusés 409), `DELETE /invitations/{id}` (annulation → EXPIREE, trace conservée), `DELETE /lots/{id}` (lot vierge uniquement). Règle commune : une donnée qui a un historique ne se supprime pas (409 + message), elle se désactive. Audit `*_MODIFIE` / `*_SUPPRIME` / `INVITATION_ANNULEE`. Web : composant `ConfirmDelete` (question nominative + avertissement irréversible), modales de modification espaces/prestataires, contrôles sur documents, invitations, fiche lot. Tests `tests/modifications-suppressions.test.ts`.
- [x] **Livré (29/08)** — Temps réel : `GET /notifications/stream` (Server-Sent Events, tick 2 s sous RLS, `etat`/`notification`/`ping`), relais web `/api/notifications-stream`, `useLive` (EventSource → toast + cloche + `router.refresh()` à chaque notification, repli sondage 15 s si le flux tombe, re-synchronisation 25 s + retour d'onglet). Nouvelles notifications : `INCIDENT_NOUVEAU` (syndic + gardien, chaque signalement), `RESERVATION_NOUVELLE` (syndic, demande à valider). Mesuré : toast + liste à jour < 2 s après création. Toasts aussi sur succès d'action. Reste (M9) : Web Push/FCM pour l'application fermée.
- [x] **Livré (29/08)** — Logo de la résidence (migration m18 `copropriete.logo_storage_path`) : `POST /coproprietes/{id}/logo/upload-url`, `GET /coproprietes/{id}/logo` (URL signée), `PATCH logo_storage_path` (préfixe `<copro>/branding/` vérifié), proxy web `/api/copro-logo`, carte « Logo de la résidence » dans Paramètres ; affiché dans la barre latérale, la barre mobile et le menu « Plus » pour tous les membres.
- [x] **Livré (29/08)** — Invitations à usage strictement unique (migration m17) : le premier scan/saisie lie le code à l'appareil (jeton secret en cookie httpOnly, haché en base — `invitation.ouverte_le`, `jeton_ouverture_hash`) ; tout autre appareil reçoit `OUVERTE` (écran explicatif, FR/AR) et `invitation_accepter` refuse (DEJA_UTILISEE) sans le jeton du premier lecteur ; l'acceptation passe le code à ACCEPTEE. Le syndic voit « Ouverte le … / Jamais ouverte » dans la liste et régénère si l'invité a changé d'appareil.
- [x] **Livré (29/08)** — Annuaire des membres (syndic) : `GET /users` (toute personne ayant un rôle dans la copropriété, rôles actifs/inactifs, lots propriétaire/occupant, coordonnées, état du compte, membre depuis), page `/membres` avec recherche + filtre par rôle, KPI, lien vers la fiche et les lots ; entrée « Membres » dans Administration. Résident → 403.
- [x] **Livré (29/08)** — Coque mobile « application » (< lg) : barre de titre compacte sous l'encoche, barre d'onglets fixe (4 destinations par rôle + « Plus »), menu complet en feuille du bas, modales → feuilles du bas (poignée, zone sûre), tables → listes de cartes (libellés recopiés en `data-label`), cartes statistiques en tuiles 2 colonnes, filtres en rangées, champs 16px (pas de zoom iOS), cibles 44px, manifeste PWA + icônes (ajout à l'écran d'accueil). Desktop inchangé. Reste : offline/PWA service worker (M10), push FCM (M9).
- [x] **Livré (29/08)** — Comptabilité guidée pour syndic non expert : `ParcoursCompta` (budget → appel → paiements, état réel + CTA, masqué une fois complet), encart « Comment lire ce relevé » côté résident, raccourci « Enregistrer un paiement » par lot en retard dans le relevé.

## M13 — Anonymisation CNDP & conformité

*Réf. Master Spec Partie 5.6, 10.1. Dépend de `docs/LEGAL_QUESTIONS_BRIEF.md` §5-6.*

- [x] **Livré (27/08)** — module utilisateurs : `GET/PATCH /users/me` (rectification CNDP), `GET /users/me/export` (droit d'accès, JSON multi-copropriétés, audit `EXPORT_DONNEES_CNDP`), `GET /users/{id}` (syndic), `POST /users/{id}/anonymize` (DESACTIVE requis, PII effacées, lignes financières/votes/PV conservées, audit `ANONYMISATION_CNDP`). Colonnes `utilisateur.desactive_le/anonymise_le`, `copropriete.retention_desactivation_mois` (nullable — légalement gaté §5).
- [x] **Livré (27/08)** — Job Inngest mensuel `anonymisation-cndp-mensuelle` : anonymise les comptes DESACTIVE dont la rétention est échue ; **saute toute copropriété sans `retention_desactivation_mois` configurée** (jamais de durée devinée). ⚠️ Ne devient effectif en production qu'après la réponse de l'avocat (§5) ET la saisie de la valeur confirmée par copropriété.
- [ ] Déclaration préalable du traitement déposée sur portail.cndp.ma (démarche administrative, pas du code — cf. brief juridique §6)
- [ ] CGU + politique de confidentialité FR/AR publiées et liées

## M15 — Location courte durée (côté copropriété)

*Réf. Doc A §10.2 (« location_courte_duree = AUTORISEE / INTERDITE / ENCADREE », « signalement
facilité »), §2.1/§2.2 (propriétaire absent, propriétaire seul redevable), §9.2 (contrôle d'accès
gardien). Domaine : `docs/domain-reference/13-location-courte-duree.md`. Juridique :
`docs/LEGAL_QUESTIONS_BRIEF.md` §7 (tout PROVISOIRE). Branche `feature/lcd-location-courte-duree`.*

⚠️ **Ajouts signalés au-delà du Master Spec (CLAUDE.md §2)** : `RoleType.GESTIONNAIRE_LCD`
(scopé aux lots via `lot_location_courte_duree.gestionnaire_id`, jamais à la copropriété) ;
enums `RegimeLocationCourteDuree`, `StatutDeclarationLcd`, `StatutSejour`, `TypePieceIdentite`,
`TypeEvenementSejour` ; tables `lot_location_courte_duree`, `sejour_courte_duree`,
`sejour_evenement` (append-only) ; colonnes `copropriete.regime_lcd / parametres_lcd_json /
regime_lcd_ag_resolution_id`, `incident.sejour_id`. `TypeUsageLot` **non modifié** (la
déclaration porte l'usage LCD — aucun schéma Zod/test existant touché).

- [x] **Livré (05/09)** — Schéma + migration `20260905100000_m15_location_courte_duree` + RLS
  (propriétaire actif du lot, gestionnaire désigné, gardien = déclarations VALIDEES + tous les
  séjours, syndic/conseil ; locataires et voisins : rien ; aucune policy existante assouplie),
  fonctions SECURITY DEFINER dédiées, seed Al Amal (ENCADREE, lot A1 VALIDEE + gestionnaire,
  séjours PREVU/EN_COURS), tests RLS `tests/lcd-rls.test.ts`.
- [x] **Livré (05/09)** — API tag `LCD` (14 opérations, exemples `POST /lcd/sejours` et
  `POST /lcd/declarations/{id}/decision`), permissions `lcd.*`, codes explicites
  `LCD_REGIME_NON_DEFINI` / `LCD_INTERDITE` / `LCD_PARAMETRE_NON_CONFIGURE` /
  `LCD_GESTIONNAIRE_REQUIS` / `LCD_DECLARATION_NON_VALIDEE` / `LCD_VOYAGEURS_MAX` /
  `LCD_DELAI_DECLARATION` / `LCD_QUOTA_NUITS_DEPASSE` (422) / `LCD_SEJOUR_CHEVAUCHEMENT` (409),
  Idempotency-Key sur décision / séjour / annulation / arrivée / départ, audit
  `LCD_REGLEMENT_MODIFIE`, `LCD_DECLARATION_CREEE/MODIFIEE/DECISION/CLOTUREE`,
  `LCD_GESTIONNAIRE_DESIGNE`, `LCD_SEJOUR_DECLARE/MODIFIE/ANNULE/ARRIVEE/DEPART` ; incidents
  `sejour_id` (EN_COURS ou TERMINE ≤ 7 j) → événement `INCIDENT_LIE`. Gestionnaire : compte de la
  copropriété (rôle créé) ou invitation M2 `GESTIONNAIRE_LCD` liée à l'acceptation.
- [x] **Livré (05/09)** — Notifications FR/AR (`LCD_DECLARATION_A_VALIDER`,
  `LCD_DECLARATION_DECISION`, `LCD_SEJOUR_DECLARE`, `LCD_SEJOUR_GARDIEN`, `LCD_SEJOUR_ANNULE`,
  `LCD_ARRIVEE_AUJOURDHUI`), job Inngest `lcd-sejours-quotidien` (rappel gardien le jour J une
  seule fois, clôture automatique EN_COURS→TERMINE le lendemain du départ, jamais
  PREVU→EN_COURS, idempotent), anonymisation CNDP des voyageurs par le job M13 (étendu, pas
  forké).
- [x] **Livré (05/09)** — Web `location-courte-duree/` (landing par rôle, règlement syndic,
  détail déclaration + décision + gestionnaire, séjour nouveau/détail), section LCD sur la fiche
  lot, « lier à un séjour » sur le signalement d'incident, navigation, FR/AR.
- [x] **Livré (05/09)** — Mobile `features/lcd/` (propriétaire, gestionnaire, syndic, gardien),
  confirmations gardien hors-ligne (file de sync M10, même Idempotency-Key rejouée), section
  fiche lot, lien incident ↔ séjour, FR/AR, `docs/PARITE_WEB_MOBILE.md` à jour.
- [x] **Livré (05/09)** — Pièces jointes de séjour (photo prise / galerie / PDF) : colonne
  `sejour_courte_duree.pieces_jointes`, `POST /lcd/sejours/upload-url`, `GET/POST/DELETE
  /lcd/sejours/{id}/pieces-jointes` (URL signée 15 min, 10 max, jamais de pièce d'identité),
  web (formulaire + galerie + visionneuse intégrée) et mobile (caméra, galerie, fichier),
  effacement par le job CNDP.
- [x] Tests API (`tests/lcd.test.ts`, `tests/lcd-rls.test.ts`) : régimes, gestionnaire requis,
  déclaration non validée, chevauchement, quota, délai, transitions + journal append-only, job
  idempotent, RLS, incident lié, anonymisation.
- [ ] **Hors périmètre (décisions AG / juridiques en attente — §7 du brief)** : redevance LCD
  votée en AG (le propriétaire reste seul débiteur, aucune ligne financière créée).
- [ ] Suspension automatique après N incidents liés (aujourd'hui : décision manuelle du syndic,
  motif obligatoire).
- [ ] Auto-check-in voyageur par QR (le voyageur n'a jamais de compte dans cette version).
- [ ] Scan / OCR de pièce d'identité (interdit par la minimisation CNDP retenue : 4 caractères).
- [ ] Durée de rétention propre aux séjours (aujourd'hui = `retention_desactivation_mois`).
- [ ] Exécution en arrière-plan OS de la file hors-ligne gardien (comme les visites M10).

## M16 — Dépenses, factures, fournisseurs, postes budgétaires

*Réf. Doc A §3 (charges — §3.5 postes, §3.6 fonds de réserve, §3.7 dépassement du budget), §8
(obligations du syndic — §8.3 « dépense > seuil configurable → conseil syndical », « 3 devis »),
§6 (approbation des comptes). Domaine : `docs/domain-reference/14-depenses-comptabilite.md`.
Juridique : `docs/LEGAL_QUESTIONS_BRIEF.md` §8 (tout PROVISOIRE). Branche
`feature/m16-depenses`. Décisions du prompt maître (non rouvertes) : aucune API bancaire
(rapprochement manuel sur preuve), l'argent qui sort est le miroir de l'argent qui entre,
`fonds_reserve_mouvement` reste l'unique grand livre de la réserve, un seul `document` pour tous
les fichiers, paramètres légaux jamais codés en dur.*

⚠️ **Ajouts signalés au-delà du Master Spec Partie 2.2 / 3.2 (CLAUDE.md §2)** : enums
`CategorieDepense`, `StatutDepense`, `SourceFinancement`, `StatutFacture`, `TypeDepenseLog` ;
tables `budget_poste`, `depense`, `facture`, `depense_log` (append-only) ; colonnes
`copropriete.seuil_approbation_conseil` / `reserve_sans_resolution_autorisee` / `tva_par_defaut`
(nullables, brief §8), `prestataire.ice / rc / adresse / email / telephone / rib / notes /
note_moyenne`, `incident.note_prestataire / commentaire_prestataire / evalue_le`,
`fonds_reserve_mouvement.depense_id`, `depense.contrat_id` (sans FK, posée pour M19) ;
permissions `depenses.lire / gerer / approuver / exporter`, `prestataires.rib.lire`,
`incidents.evaluer` ; codes 422/409 `DEPENSE_STATUT_INVALIDE`, `DEPENSE_APPROBATION_CONSEIL_REQUISE`,
`DEPENSE_RESERVE_RESOLUTION_REQUISE`, `FONDS_RESERVE_INSUFFISANT`, `BUDGET_TOTAL_DERIVE_DES_POSTES`,
`BUDGET_POSTE_UTILISE`, `INCIDENT_NON_RESOLU`, `INCIDENT_DEJA_EVALUE`. **Écarts par rapport au
prompt maître, signalés** : (1) le mouvement de réserve utilise le type existant `DEPENSE` de
`TypeMouvementFondsReserve` plutôt qu'une nouvelle valeur `RETRAIT` (deux noms pour la même chose) ;
(2) `document.type` reste un TEXT libre — les documents téléversés par le syndic portent un type
saisi librement dans l'UI existante — les types système M16 sont des constantes fermées
(`apps/api/lib/documents/types.ts` : `FACTURE`, `JUSTIFICATIF_DEPENSE`, `DEVIS`…), pas un enum
Postgres, pour ne pas casser les données ; (3) `tva_par_defaut` est nullable **sans défaut DB**
(valeur fiscale → discipline du brief), le seed pose 20 ; (4) `Prestataire.contact` est conservé
et recopié dans `telephone` / `email` par la migration quand la valeur est reconnaissable.

- [x] **Livré (05/09)** — Schéma + migrations `20260905142547_m16_depenses` et
  `..._m16_prestataire_note_fn` : tables, CHECKs (`montant_ttc > 0`, HT/TVA ensemble, note 1–5,
  signe des mouvements de réserve), triggers `budget_poste_recalculer_total` (invariant
  `budget_ag.montant_total = Σ postes`) et `fonds_reserve_solde_non_negatif`, reprise (une ligne
  AUTRE / « Budget global » par budget existant, `contact` → `telephone`/`email`), RLS (syndic /
  conseil : tout ; résidents : dépenses PAYEE seulement, aucune facture ni journal ; gardien,
  prestataire, autre copropriété : rien ; `depense_log` sans UPDATE/DELETE), fonction SECURITY
  DEFINER `prestataire_recalculer_note`. Tests `tests/depenses-rls.test.ts` (8).
- [x] **Livré (05/09)** — API tag `Dépenses` (20 opérations) : postes du budget
  (`/finances/budgets/{id}/postes[/{posteId}]`), `/finances/budget-vs-realise`, `/depenses` (filtres,
  pagination, tri, `format=csv` journalisé), `upload-url`, détail / PATCH (BROUILLON, REJETEE),
  `soumettre` / `approuver` / `rejeter` / `payer` / `annuler` (Idempotency-Key), factures,
  documents signés, `POST /incidents/{id}/depense`, `POST /incidents/{id}/evaluation`,
  `GET /prestataires/{id}` (fiche + historique), `GET /prestataires/{id}/rib` (audité). Routage
  d'approbation par seuil ; réserve : résolution ADOPTEE ou paramètre, solde jamais négatif,
  mouvement `DEPENSE` dans la même transaction ; preuve de paiement = `document`
  `JUSTIFICATIF_DEPENSE` ; factures RECUE/VERIFIEE → REGLEE au paiement ; RIB masqué (4 derniers).
  Helpers partagés M16→M25 : `lib/http/pagination.ts`, `lib/http/export.ts` (CSV BOM « ; »,
  formules neutralisées, journalisation), `lib/documents/attach.ts`, `lib/documents/types.ts`.
  Budgets M12 : la création pose une ligne globale, le total est dérivé des postes. Tests
  `tests/depenses.test.ts` (17) ; suite complète verte.
- [x] **Livré (05/09)** — Notifications FR/AR `DEPENSE_A_APPROUVER` (conseil), `DEPENSE_APPROUVEE`
  / `DEPENSE_REJETEE` (créateur), `FACTURE_ECHEANCE_PROCHE` ; job Inngest quotidien
  `depenses-factures-echeances` (J-7, une seule fois par facture, idempotent) ; audit `DEPENSE_*`,
  `FACTURE_*`, `BUDGET_POSTE_*` (+ `BUDGET_POSTE_MODIFIE_APRES_ACTIVATION`),
  `PRESTATAIRE_RIB_CONSULTE`, `INCIDENT_PRESTATAIRE_EVALUE`, `DEPENSES_EXPORTEES`.
- [x] **Livré (05/09)** — Web : `finances/depenses` (onglets par statut, filtres, totaux, KPI,
  export CSV), création / modification, détail (factures + visionneuse intégrée, journal, preuve,
  dialogues soumettre / approuver / rejeter / payer avec photo / annuler), `finances/budgets/[id]`
  (éditeur de postes, barres prévu vs consommé), `prestataires/[id]` (onglets, RIB masqué + lecture
  auditée, évaluations), fiche incident (dépenses liées, création depuis l'incident, évaluation),
  navigation « Dépenses » (syndic, conseil), proxys `/api/depense-document` et `/api/depenses-csv`,
  FR/AR RTL.
- [x] **Livré (05/09)** — Mobile `features/depenses/` : liste (KPI, onglets), détail, approbation /
  rejet du conseil (push → décision avec motif), paiement avec photo du reçu (syndic), évaluation du
  prestataire par le résident, dépenses liées sur l'incident, deep-links `DEPENSE_*` /
  `FACTURE_ECHEANCE_PROCHE`. Écarts de parité consignés dans `docs/PARITE_WEB_MOBILE.md`.
- [x] Seed Al Amal : 6 postes, 7 dépenses (tous statuts, une payée depuis la réserve sur résolution
  ADOPTEE d'une AG passée), facture à échéance J+5, membre du conseil syndical (`+212600000007`),
  fiche fournisseur avec RIB, incident résolu évalué.
- [ ] **Hors périmètre M16 (repris ensuite ou à confirmer — domaine 14.7)** : transparence résident et
  rapport de gestion (M18), dépenses de contrat (M19) et de paie (M20), comparatif de 3 devis (Doc A
  §8.3 — type `DEVIS` déclaré seulement), avance du syndic (Doc A §3.6 `AVANCE_SYNDIC`), saisie
  mobile d'une dépense (web-first), rappel d'échéance de facture par email (PUSH seulement).

## M17 — Justificatifs de paiement (preuve de virement / chèque / espèces, validation syndic)

*Réf. Doc A §3.3 (« virement mal référencé », « chèque sans provision »), §3.4 (imputation FIFO,
locataire payeur), §12.3 (confidentialité par lot). Domaine : `03-charges-finances.md` §3.8.
Juridique : brief §8.5. Branche `feature/m17-justificatifs`. Décision projet : aucune API bancaire,
rapprochement manuel sur preuve ; la donnée est prête pour un import CSV bancaire ultérieur (mêmes
lignes `justificatif_paiement`).*

⚠️ **Ajouts signalés au-delà du Master Spec** : enum `StatutJustificatif` (EN_ATTENTE, VALIDE,
REJETE, **ANNULE** — ajout au prompt pour l'annulation par le déclarant), table
`justificatif_paiement`, colonnes `copropriete.comptes_bancaires_json` /
`delai_validation_justificatif_jours`, `paiement.justificatif_id` / `enregistre_par_id` /
`date_valeur` / `document_id` ; permissions `justificatifs.declarer / lire / valider`,
`paiements.especes.saisir`, `coproprietes.comptes_bancaires.lire / gerer` ; codes
`JUSTIFICATIF_STATUT_INVALIDE`, `JUSTIFICATIF_PREUVE_REQUISE`. **Écarts par rapport au prompt** :
(1) `paiement` est append-only (GRANT SELECT, INSERT) → aucun paiement « EN_ATTENTE » créé par le
gardien puis basculé VALIDE : la remise d'espèces du gardien est un justificatif ESPECES EN_ATTENTE,
`POST /finances/paiements/{id}/confirmer` prend l'id du justificatif et équivaut à `/valider` ;
(2) aucune nouvelle `VisibiliteDocument` : la preuve est un document SYNDIC_ONLY écrit et relu par
deux fonctions SECURITY DEFINER (`justificatif_attacher_preuve`, `justificatif_preuve_chemin`)
après filtrage RLS du justificatif — aucune policy existante modifiée ; (3) validation en masse et
file hors-ligne gardien non livrées (voir parité).

- [x] **Livré (05/09)** — Migrations `..._m17_justificatifs` (+ `_m17_preuve_fn`) : table, CHECKs,
  RLS (syndic/conseil tout ; résident : lots dont il est propriétaire ou occupant ; gardien : ses
  saisies), fonctions SECURITY DEFINER ; seed Al Amal (2 comptes bancaires, justificatif validé du
  MRE avec paiement + quittance, chèque en attente sur solde, espèces du gardien en attente).
- [x] **Livré (05/09)** — API tag `Justificatifs` (12 opérations) : upload-url, déclaration
  (preuve obligatoire sauf espèces internes, ligne PAYE refusée), liste (EN_ATTENTE d'abord,
  compteurs), détail (preuve signée 15 min + échéances ouvertes), valider (ciblé ou FIFO via
  `appliquerPaiement` / `appliquerPaiementFifo` exportés du moteur M5 avec provenance ; avance >
  dû → 422, rien écrit), rejeter, annuler, espèces (gardien → EN_ATTENTE, syndic → VALIDE),
  confirmer ; comptes bancaires (RIB masqué, `PUT` syndic, RIB complet audité `RIB_CONSULTE`).
  `GET /finances/lots/{id}/solde` → `justificatifs_en_attente` ; `escalade.ts` : ligne couverte
  par un justificatif EN_ATTENTE non escaladée (test). Job `justificatifs-relance-syndic`
  (délai configuré, une fois). Notifications FR/AR `JUSTIFICATIF_DECLARE`, `PAIEMENT_VALIDE`,
  `JUSTIFICATIF_REJETE`, `JUSTIFICATIF_A_VALIDER_RELANCE`, `PAIEMENT_ESPECES_SAISI`. Audit
  `JUSTIFICATIF_DECLARE/VALIDE/REJETE/ANNULE`, `PAIEMENT_ESPECES_SAISI/CONFIRME`,
  `COMPTES_BANCAIRES_MODIFIES`, `RIB_CONSULTE`. Tests `tests/justificatifs.test.ts` (7).
- [x] **Livré (05/09)** — Web : `finances/payer` (résident : comptes, déclaration avec preuve,
  mes déclarations, montant en attente), `finances/justificatifs` (file par statut, comptes
  bancaires + RIB audité, déclaration au nom d'un lot), `finances/justificatifs/[id]` (preuve dans
  la visionneuse, échéances ouvertes, valider / rejeter), `finances/especes` (gardien), proxy
  `/api/justificatif-preuve`, navigation Payer / Justificatifs / Espèces reçues, FR/AR.
- [x] **Livré (05/09)** — Mobile `features/justificatifs/` : Payer, file de validation, détail
  (preuve, valider / rejeter), espèces du gardien (en ligne), deep-links.
- [ ] **Non livré / à confirmer** : validation en masse ; file hors-ligne du gardien pour les
  espèces (finances exclues de la file locale) ; import CSV bancaire (rattachement automatique
  aux justificatifs) ; paiement « en avance » (avoir) toujours refusé (Doc A §3.4).

## M18 — Rapports, rapport de gestion annuel, exports, transparence

*Réf. Doc A §8 (reddition des comptes), §6 (approbation des comptes en AG), §3.5 (transparence),
§11 (« état daté »). Domaine : `15-rapports-transparence.md`. Juridique : brief §9. Branche
`feature/m18-rapports`. Décision projet : aucune API bancaire — le compte courant est une
estimation (paiements validés − dépenses payées), la réserve est le ledger M5/M16.*

⚠️ **Ajouts signalés au-delà du Master Spec** : enum `StatutRapportGestion` (BROUILLON, GENERE,
SOUMIS_AG, APPROUVE, REJETE), tables `rapport_gestion` et `export_log` (append-only), colonne
`copropriete.factures_visibles_residents` ; fonctions SECURITY DEFINER `transparence_factures`,
`transparence_agregats` ; permissions `rapports.syndic.lire`, `rapports.transparence.lire`,
`rapports.gestion.gerer`, `exports.lire`, `exports.proprietaires`, `exports.releve_lot` ; codes
`RAPPORT_STATUT_INVALIDE`, `RAPPORT_PARAMETRE_NON_CONFIGURE` ; clé de config
`majorite_approbation_comptes` ; dépendance `exceljs` (XLSX). **Écarts par rapport au prompt** :
(1) le PDF stocké en Document est la variante « publique » FR (sans détail par lot) ; les variantes
AR et « complète » sont rendues à la demande depuis l'instantané (déterministe) et journalisées —
pas de second Document ; (2) la transaction idempotente couvre l'instantané, le rendu PDF + upload
se font hors transaction (délai), un échec laisse le rapport BROUILLON régénérable ; (3) un rapport
BROUILLON / GENERE du même exercice est RÉGÉNÉRÉ par `POST /rapports/gestion` (200) au lieu d'un
409 — seul un rapport SOUMIS_AG / APPROUVE bloque ; (4) « contrats échus / à échoir » du tableau
de bord et « contrats signés » des faits marquants restent vides jusqu'à M19 ; (5) exports
contrats / personnel / parkings livrés avec M19 / M20 / M23.

- [x] **Livré (06/09)** — Migrations `..._m18_rapports` (tables, CHECK exercice, index unique
  partiel `(copropriete, exercice) WHERE statut <> 'REJETE'`, RLS syndic / conseil ; `export_log`
  GRANT SELECT, INSERT + INSERT par l'auteur quel que soit son rôle) et `..._m18_transparence_fn`
  (fonctions SECURITY DEFINER bornées à la copropriété courante — aucune policy assouplie).
  `lib/http/export.ts` : `export_log` remplace l'audit `*_EXPORTEES` de M16, XLSX `exceljs`.
  Seed Al Amal : rapport N-1 APPROUVE (résolution ADOPTEE sur l'AG passée, document public),
  rapport N GENERE, `factures_visibles_residents`, `majorite_approbation_comptes` (PROVISOIRE),
  deux lignes `export_log`. L'instantané du seed est construit par la MÊME fonction que l'API.
- [x] **Livré (06/09)** — API tag `Rapports` (13 opérations) : tableau de bord, transparence,
  grand livre (json / csv / xlsx), rapports de gestion (liste, génération idempotente, détail avec
  instantané, PDF FR / AR publique / complète, soumission à l'AG via `creerResolutionDb` — jamais
  dupliqué), impayés (tranches, tri, export), propriétaires (syndic, format obligatoire), journal
  des exports, relevé de charges json / PDF, `PATCH /coproprietes/{id}/transparence` ;
  `format=csv|xlsx` sur `/lots`, `/finances/paiements`, `/incidents`, `/depenses`. Hook
  `ag.ts::finaliserResolution` → APPROUVE / REJETE. Notification FR/AR `RAPPORT_GESTION_DISPONIBLE`.
  Audit `RAPPORT_GESTION_GENERE/REGENERE/SOUMIS_AG/APPROUVE/REJETE/PDF_ECHEC`,
  `TRANSPARENCE_FACTURES_MODIFIEE`. PDF : `lib/rapports/pdf-commun.tsx` (Noto Sans Arabic, bidi
  `direction: rtl`, dictionnaire FR/AR), `rapport-gestion-pdf.tsx`, `releve-pdf.tsx`. Tests
  `tests/rapports.test.ts` (10) : réconciliation instantané ↔ grand livre, PDF FR + AR (rapport,
  relevé), transparence sans aucune donnée par lot (LOCATAIRE, PROPRIETAIRE), factures via option,
  exports journalisés (propriétaire scopé), hook AG (422 majorité, SOUMIS_AG, APPROUVE, 409).
- [x] **Livré (06/09)** — Web : `rapports/` (tableau de bord : trésorerie 12 mois `TresorerieChart`,
  ancienneté `AgeingBars`, top lots, budget vs réalisé `Bars`, dépenses `Donut`, incidents,
  justificatifs), `rapports/grand-livre`, `rapports/gestion` (+ `[id]` : synthèse, PDF FR / AR
  dans la visionneuse, soumission à l'AG, instantané), `rapports/impayes`, `rapports/exports`
  (centre d'exports, journal, option factures), `rapports/transparence` (tout membre), relevé PDF
  sur la fiche lot, `ExportButtons` csv / xlsx sur lots, incidents, paiements, dépenses ; proxies
  `/api/export`, `/api/rapport-pdf`, `/api/releve-pdf` ; navigation Rapports (syndic, conseil) /
  Transparence (résidents, locataire) ; FR/AR RTL (sélecteur d'exercice, graphiques inversés).
- [x] **Livré (06/09)** — Mobile `features/rapports/` : transparence (parité), tableau de bord
  lecture (CustomPaint 12 mois), rapports annuels + PDF, relevé PDF sur la fiche lot ;
  `ApiClient.getBytes` + visionneuse par octets (corrige aussi l'ouverture des quittances et PV
  rendus par l'API) ; deep-link `RAPPORT_GESTION_*` → transparence.
- [ ] **Non livré / à confirmer** : import du relevé bancaire (rapprochement) ; relecture native
  du PDF arabe ; contrats (M19) dans le tableau de bord et les faits marquants ; génération /
  soumission depuis le mobile (web-first, voir parité).

## M19 — Contrats, assurances, échéances

*Réf. Doc A §7 (ascenseur, nettoyage, gardiennage, jardins), §8 (assurance obligatoire,
responsabilité du syndic), §5. Domaine : `16-contrats-assurances.md`. Juridique : brief §10.
Branche `feature/m19-contrats`.*

⚠️ **Ajouts signalés au-delà du Master Spec** : enums `TypeContrat`, `StatutContrat`, `Periodicite`,
`TypeEcheance`, `StatutEcheanceContrat`, `TypeContratLog` ; tables `contrat`, `contrat_echeance`,
`contrat_log` (append-only) ; colonnes `copropriete.seuil_contrat_ag` /
`assurance_alerte_envoyee_le`, `contrat_echeance.notifie_j30_le` / `notifie_j7_le`,
`contrat.attestation_document_id` (attestation distincte du contrat signé) ; FK
`depense.contrat_id` ; permissions `contrats.lire`, `contrats.gerer` ; codes
`CONTRAT_STATUT_INVALIDE`, `CONTRAT_RESOLUTION_AG_REQUISE`, `CONTRAT_ECHEANCE_STATUT_INVALIDE`.
**Écarts par rapport au prompt** : (1) les tâches M22 de renouvellement ne sont pas créées (table
`tache` absente) — `contrat_echeance.tache_id` est posé, l'échéance RENOUVELLEMENT tient lieu de
rappel ; (2) `PATCH /contrats/{id}` porte aussi les documents (contrat signé / attestation) — pas
d'endpoint dédié ; (3) la génération d'échéances n'est pas un endpoint « generate » séparé : `POST
/contrats/{id}/echeances` sans `date_echeance` régénère, avec `type` + `date_echeance` crée une
échéance manuelle ; (4) le job traite la fin de contrat AVANT les rappels pour que les échéances
créées par la reconduction soient notifiées dans le même passage (rejeu = 0 effet).

- [x] **Livré (06/09)** — Migration `..._m19_contrats` : tables, CHECKs (dates, montants, motif de
  résiliation), fonction `contrat_copropriete_id`, RLS syndic / conseil (aucun résident, gardien,
  prestataire), `contrat_log` GRANT SELECT+INSERT. `creerDepenseDb` extrait de M16 (transaction
  partagée). Seed Al Amal : ascenseur ACTIF (tacite, préavis, contrat signé, échéancier + visite
  technique), nettoyage ACTIF lié à la dépense payée, multirisque immeuble ACTIF (police +
  attestation), dératisation BROUILLON, gardiennage EXPIRE ; `seuil_contrat_ag` (PROVISOIRE).
- [x] **Livré (06/09)** — API tag `Contrats` (15 opérations) : liste (filtres, tri, `meta.par_statut`,
  `meta.assurance`, export csv / xlsx journalisé), création, upload-url, échéancier transverse
  (`from`/`to`), à renouveler, état assurance, détail (documents signés, échéancier, dépenses,
  journal), modification (régénère l'échéancier si dates / périodicité / montant changent),
  activer (seuil AG → 422), suspendre, résilier (échéances futures annulées), échéances (génération
  idempotente / manuelle, modification de statut), génération de dépense BROUILLON liée
  (Idempotency-Key). Jobs `contrats-echeances-quotidien` (J-30 / J-7 une fois, MANQUEE, EXPIRE,
  reconduction tacite prolongeant l'échéancier) et `contrats-assurance-mensuel` (dédoublonné 28 j).
  Notifications FR/AR `CONTRAT_ECHEANCE_PROCHE`, `CONTRAT_ECHEANCE_MANQUEE`, `CONTRAT_EXPIRE`,
  `CONTRAT_RECONDUIT`, `ASSURANCE_IMMEUBLE_ABSENTE`. Audit `CONTRAT_CREE/MODIFIE/ACTIVE/SUSPENDU/
  RESILIE/DEPENSE_GENEREE`. Hooks M18 : tableau de bord `contrats`, faits marquants `contrats_signes`,
  export `CONTRATS`. Tests `tests/contrats.test.ts` (9) : calcul pur des échéances par périodicité
  (fins de mois, horizon, préavis), seuil AG, dépense liée idempotente, résiliation, RLS propriétaire,
  job (idempotent), assurance absente / active, tableau de bord.
- [x] **Livré (06/09)** — Web : `contrats/` (statistiques, bannière assurance, onglets statut + « à
  renouveler », filtre type, export), `contrats/nouveau` et `[id]/modifier` (formulaire, bloc police
  d'assurance, fichiers), `contrats/[id]` (échéancier avec actions : créer la dépense, réalisée,
  annuler, ajouter une échéance, régénérer ; activer / suspendre / résilier ; documents dans la
  visionneuse ; dépenses liées ; journal), `contrats/calendrier` (vue mois), indicateurs sur le
  tableau de bord Rapports, `?contrat_id=` sur la liste des dépenses, navigation « Contrats »
  (syndic, conseil), FR/AR RTL.
- [x] **Livré (06/09)** — Mobile `features/contrats/` : liste (assurance, à renouveler, échéances 30
  jours, onglets), fiche lecture (police, documents, échéancier, dépenses, journal), deep-links.
- [ ] **Non livré / à confirmer** : tâches M22 de renouvellement ; indexation / révision de prix ;
  saisie et transitions depuis le mobile (web-first, voir parité) ; exports personnel / parkings
  (M20 / M23).

## M20 — Personnel RH : paie, congés, présences, évaluations

*Réf. Doc A §9 (gardien : présence, loge, fiche visible), §8 (le syndicat employeur, salaires
dans les charges). Domaine : `17-personnel-rh.md`. Juridique : brief §11. Branche
`feature/m20-personnel`.*

⚠️ **Ajouts signalés au-delà du Master Spec** : valeurs `StatutPersonnel.PRE_EMBAUCHE` / `PARTI` ;
enums `PostePersonnel`, `TypeContratTravail`, `StatutFichePaie`, `TypeConge`, `StatutConge`,
`StatutPresence`, `TypePersonnelLog` ; colonnes RH sur `personnel` (poste, type_contrat,
date_embauche, date_fin_contrat, salaire_brut_mensuel, numero_cnss, document_contrat_id,
contact_urgence, horaires_json, notes, fin_contrat_notifie_le, modifie_le) ; tables `fiche_paie`,
`conge`, `evaluation_personnel`, `presence_personnel`, `personnel_log` (append-only) ; colonne
`copropriete.parametres_paie_json` ; colonnes `depense.personnel_id` / `periode_paie` ; type de
document `CERTIFICAT_CONGE` ; marqueurs `conge.rappel_envoye_le` ; permissions `personnel.rh.lire`
(GARDIEN scoped), `personnel.rh.gerer`, `personnel.conges.demander`, `personnel.conges.approuver`,
`personnel.evaluer` (syndic + conseil), `personnel.presence.saisir`, `personnel.planning.lire` ;
codes `PAIE_PARAMETRES_NON_CONFIGURES`, `PAIE_STATUT_INVALIDE`, `CONGE_STATUT_INVALIDE`,
`CONGE_SOLDE_INSUFFISANT`, `PERSONNEL_STATUT_INVALIDE`. **Écarts par rapport au prompt** : (1) le
PDF de paie est rendu à la demande depuis `fiche_paie.details_json` (l'employé lit sa fiche sans
nouvelle visibilité de document : le Document stocké reste SYNDIC_ONLY) ; (2) le certificat de
congé envoyé par l'employé est rattaché comme Document à l'approbation par le syndic (chemin gardé
dans `personnel_log`), les employés n'ayant pas le droit d'écrire `document` ; (3) le job de paie
tourne le 25 (brouillons + `PAIE_A_VALIDER`) et porte aussi l'alerte de fin de CDD ; (4) le
paiement d'une fiche = paiement de la dépense liée (aucun second flux d'argent) ; (5) les
évaluations et la saisie de paie restent web-first sur le mobile.

- [x] **Livré (06/09)** — Migration `..._m20_personnel_rh` : colonnes / tables, CHECKs (périodes,
  dates, notes 1-5), fonctions `personnel_utilisateur_id` / `personnel_copropriete_id`, RLS :
  `fiche_paie` syndic + employé, `conge` syndic / conseil + employé (INSERT propre),
  `evaluation_personnel` syndic + conseil, `presence_personnel` syndic / conseil + employé (écriture
  propre), `personnel_log` GRANT SELECT+INSERT. Seed Al Amal : gardien CDI (horaires, CNSS, contrat
  signé) + agent d'entretien CDD finissant sous 25 jours (`+212600000009`), paramètres de paie
  PROVISOIRES, fiche PAYEE du mois précédent (dépense liée) + brouillon, congé approuvé avec
  remplaçant + demande maladie en attente, présences, évaluations, journal RH.
- [x] **Livré (06/09)** — API tag `Personnel RH` (26 opérations) : dossier (`PATCH /personnel/{id}`,
  contrat signé, `PARTI` libère la loge), `GET /personnel/{id}/cnss` audité, paramètres de paie
  (`GET/PATCH /coproprietes/{id}/parametres-paie`), fiches (préparer / recalculer, valider avec
  Idempotency-Key → dépense PERSONNEL soumise dans la même transaction, payer via la dépense, PDF
  FR/AR), paie du mois (`GET /personnel/fiches-paie?periode=`), congés (demande propre ou au nom,
  approbation avec remplaçant et présences posées, refus motivé, annulation, filtres, export),
  présences (saisie en masse, `POST /personnel/me/presence` idempotent, période), évaluations,
  planning hebdomadaire, exports csv / xlsx `PERSONNEL` / `CONGES` sans CNSS. Jobs
  `personnel-mensuel` (25) et `personnel-conges-rappel`. Notifications FR/AR `PAIE_A_VALIDER`,
  `PAIE_VALIDEE`, `CONGE_DEMANDE`, `CONGE_APPROUVE`, `CONGE_REFUSE`, `CONGE_EN_ATTENTE_RAPPEL`,
  `CONTRAT_TRAVAIL_FIN_PROCHE`. Hook M16 `payerDepense` → fiche PAYEE. Tests
  `tests/personnel-rh.test.ts` (9) : table de cas de paie (SMIG, plafond, absences), masquage par
  rôle + CNSS audité, validation refusée sans paramètres (rien d'écrit), validation idempotente avec
  dépense, RLS employé / collègue / conseil, congés (jours ouvrables, chevauchement, solde,
  annulation), pointage idempotent, jobs rejoués, `personnel_log` append-only, exports.
- [x] **Livré (06/09)** — Web : `personnel/` (poste, liens dossier / planning / paie du mois,
  export), `personnel/[id]` (onglets fiche / paie / congés / présences / évaluations, modale du
  dossier avec horaires 7 × 2 plages et contrat, n° CNSS à la demande, préparer / valider / payer une
  fiche, PDF dans la visionneuse, demande et décision de congé, grille des présences du mois,
  pointage, évaluation), `personnel/planning`, `personnel/paie`, `personnel/me` (gardien),
  Paramètres → Paie (taux, barème IR, congés), navigation « Mon dossier » du gardien, FR/AR RTL.
- [x] **Livré (06/09)** — Mobile `features/personnel/personnel_rh_screens.dart` : dossier (fiche,
  fiches de paie + PDF, congés avec demande / annulation / décision syndic, présences du mois),
  « Mon dossier » avec pointage **hors-ligne** (Drift v3 `presences_queue`, `presence_sync.dart`,
  Idempotency-Key = id de ligne), planning hebdomadaire, bannière des congés à décider, deep-links
  `CONGE_*` / `PAIE_*` / `CONTRAT_TRAVAIL_FIN_PROCHE` ; test routeur M20.
- [ ] **Non livré / à confirmer** : déclarations CNSS / DSN et bordereaux (hors périmètre, brief
  §11.1) ; recalcul rétroactif des fiches validées ; tâches M22 de fin de CDD ; saisie de paie et
  évaluations sur mobile (web-first, voir parité) ; purge / rétention du dossier après départ.

## M21 — Communication : tableau d'affichage, sondages, contacts utiles

*Réf. Doc A §8 (information des copropriétaires), §12 (confidentialité), §6 (seule l'AG décide).
Domaine : `18-communication.md`. Juridique : brief §12. Branche `feature/m21-communication`.*

⚠️ **Ajouts signalés au-delà du Master Spec** : enums `CategorieAnnonce`, `AudienceCommunication`,
`StatutAnnonce`, `StatutSondage` ; tables `annonce`, `annonce_lecture`, `annonce_commentaire`,
`sondage`, `sondage_reponse`, `contact_utile` ; colonnes `utilisateur.preferences_notification_json`
(préférences de notification, absente du Master Spec — le prompt demandait de la signaler),
`lot.batiment` (cible de l'audience BATIMENT, absente du modèle `lot`), `document.annonce_id`
(pièces jointes ANNONCE_PJ) ; fonctions SQL `communication_audience_ok`, `annonce_visible`,
`sondage_visible`, `sondage_resultats`, `sondage_participation`, `communication_identites`
(SECURITY DEFINER) ; permissions `annonces.lire / gerer / commenter / moderer`, `sondages.gerer /
repondre`, `contacts.gerer` ; codes `ANNONCE_STATUT_INVALIDE`, `COMMENTAIRES_DESACTIVES`,
`SONDAGE_STATUT_INVALIDE`, `SONDAGE_DEJA_REPONDU` (409), `SONDAGE_CHOIX_INVALIDE` ; plafond
`RATE_LIMIT_COMMENTAIRE_MAX` (10 / 10 min). **Écarts par rapport au prompt** : (1) la publication
programmée garde l'annonce en BROUILLON (invisible) et un job horaire la publie — pas de statut
supplémentaire ; (2) le digest « e-mail » par défaut suit le repli SMS existant quand l'utilisateur
n'a pas d'e-mail (comportement de `envoyerNotification`) ; (3) le test « négatif sur la vue SQL » est
porté par la policy RLS de `sondage_reponse` (chacun ne lit que la sienne, même le syndic) et par la
fonction agrégée — pas de vue ; (4) les pièces jointes, la modification d'un brouillon et la gestion
des contacts restent web-first sur le mobile (parité) ; (5) contacts utiles seedés avec les numéros
nationaux (15, 19, 177, 141) — le CHECK initial (≥ 3 caractères) a été assoupli par migration.

- [x] **Livré (08/09)** — Migrations `..._m21_communication` (tables, CHECKs, fonctions d'audience
  et de résultats agrégés, RLS : annonces / sondages lus par audience ou gestion, lectures et réponses
  append-only et propres à chacun, commentaires modérables par le syndic, contacts tenant),
  `..._m21_identites_fn`, `..._m21_contact_telephone_court`. Seed Al Amal : bâtiments A / B, 7
  contacts utiles, 7 annonces (URGENCE épinglée commentée avec un commentaire masqué, TRAVAUX
  bâtiment B avec pièce jointe, AG propriétaires, convivialité, règlement, brouillon programmé,
  archivée), 3 sondages (ouvert pondéré avec réponses, clos multi-choix, brouillon), préférences.
- [x] **Livré (08/09)** — API tag `Communication` (27 opérations) : annonces (liste filtrée par
  audience + `meta.non_lues`, export csv / xlsx, création assainie, upload-url, détail avec pièces
  signées et commentaires, modification, suppression d'un brouillon, publication immédiate /
  programmée avec fan-out et SMS d'urgence, archivage, accusé de lecture idempotent, statistiques de
  lecture, commentaire limité en débit, modération), sondages (liste, création, détail avec ma
  réponse et résultats agrégés, modification / suppression d'un brouillon, ouvrir, clore, répondre
  409 / 422, résultats pondérés et non pondérés), contacts utiles (CRUD), préférences de
  notification. `PATCH /lots/{id}` accepte `batiment`. Jobs `communication-digest-hebdo` (lundi 09:00,
  idempotent par semaine ISO, préférences respectées) et `communication-programmees-horaire`.
  Notifications FR/AR `ANNONCE_PUBLIEE`, `ANNONCE_URGENTE`, `ANNONCE_COMMENTAIRE`, `SONDAGE_OUVERT`,
  `SONDAGE_CLOS`, `COMMUNICATION_DIGEST`. Audit `ANNONCE_CREEE/MODIFIEE/PUBLIEE/PROGRAMMEE/ARCHIVEE/
  SUPPRIMEE`, `COMMENTAIRE_MASQUE`, `SONDAGE_CREE/MODIFIE/OUVERT/CLOS/SUPPRIME`, `CONTACT_UTILE_*`.
  Tests `tests/communication.test.ts` (10) : assainissement, audience PROPRIETAIRES (RLS + fan-out :
  le locataire ne reçoit rien), audience BATIMENT, URGENCE push + SMS, lectures (comptes gestion,
  liste interdite au résident, RLS), commentaires / modération / désactivation, publication
  programmée par le job (une fois), sondage (ouverture, 409 double réponse, choix contrôlés, résultats
  pondérés 60 / 40 sans jamais un répondant, RLS négative sur `sondage_reponse`), clôture manuelle /
  automatique, digest idempotent et préférences, contacts.
- [x] **Livré (08/09)** — Web : `affichage/` (fil épinglé, catégories, brouillons / archivées pour la
  gestion, badge non lues, sondages, contacts tap-to-call, export), `affichage/[id]` (Markdown rendu
  sans HTML, pièces jointes dans la visionneuse, commentaires + modération, accusé de lecture
  automatique, lectures « lu par n / N » pour la gestion, publier / programmer / archiver / supprimer),
  `affichage/nouveau` et `[id]/modifier` (composer : audience, bâtiment, expiration, épingle,
  commentaires, pièces jointes, brouillon ou publication immédiate), `affichage/sondages/nouveau` et
  `[id]` (réponse, résultats en barres, ouvrir / clore), `affichage/contacts` (syndic), préférences
  de notification dans le profil, carte « Tableau d'affichage » du tableau de bord résident, champ
  bâtiment sur le formulaire de lot, navigation pour tous les rôles sauf prestataire, FR/AR RTL.
- [x] **Livré (08/09)** — Mobile `features/communication/communication_screens.dart` : fil (chips de
  catégorie, badge non lues, sondages, contacts tap-to-call), détail (lecture automatique, pièces
  jointes, commentaires, modération / publier / archiver pour la gestion, « lu par n / N »), sondage
  (réponse, résultats, ouvrir / clore), composer d'annonce et de sondage (feuilles), préférences dans
  le profil, section du tableau de bord résident, onglet « Annonces » des résidents, deep-links,
  invalidation temps réel ; test routeur M21.
- [ ] **Non livré / à confirmer** : pièces jointes depuis le mobile ; envoi WhatsApp (canal phase 2) ;
  brouillons collaboratifs ; traduction automatique FR ↔ AR du contenu ; rétention / anonymisation
  des commentaires (brief §12.3).

## M22 — Tâches et suivi des décisions

*Réf. Doc A §6 (exécution des résolutions), §8 (obligations du syndic), §12. Domaine :
`19-taches.md`. Juridique : brief §13. Branche `feature/m22-taches`.*

⚠️ **Ajouts signalés au-delà du Master Spec** : enums `OrigineTache`, `PrioriteTache`,
`StatutTache`, `TypeTacheLog` ; tables `tache`, `tache_commentaire`, `tache_log` (append-only) ;
colonnes `ag_resolution.necessite_execution`, `copropriete.delai_execution_resolution_jours`
(paramètre légal nullable, PROVISOIRE brief §13), `document.tache_id` (pièces jointes TACHE_PJ),
`tache.rapport_gestion_id` et `tache.recurrence_parente_id` (idempotence des hooks et de la
récurrence), marqueurs `rappel_j3_le` / `rappel_j0_le` / `rappel_retard_le` ; FK
`contrat_echeance.tache_id` (posée en M19, désormais unique) ; fonctions SQL `tache_visible`,
`tache_copropriete_id`, `resolution_execution` (SECURITY DEFINER) ; permissions `taches.gerer`,
`taches.lire` (GARDIEN scoped), `taches.maj_propre` (CONSEIL / GARDIEN scoped) ; codes
`TACHE_STATUT_INVALIDE`, `TACHE_ASSIGNEE_INVALIDE`. **Écarts par rapport au prompt** : (1) pas de
DELETE : une tâche s'annule (statut ANNULEE, historique conservé) ; (2) la récurrence est un objet
`{ frequence }` fermé (mensuelle / trimestrielle / semestrielle / annuelle), pas un sous-ensemble
RRULE libre ; (3) l'annulation d'une échéance de contrat annule sa tâche et sa réalisation la
termine (bidirectionnel) ; (4) la policy d'insertion de `tache` autorise l'assigné(e) à créer
l'occurrence suivante de SA tâche récurrente (migration `m22_recurrence_assignee`, même module —
sinon un gardien ne pourrait pas clore une tâche récurrente hors-ligne) ; (5) la photo de fin de
tâche s'envoie en ligne, seul le statut est mis en file hors-ligne.

- [x] **Livré (08/09)** — Migrations `..._m22_taches` (tables, CHECKs, fonctions, RLS : syndic tout,
  conseil `visible_conseil`, assigné(e) ses tâches ; lectures et journal append-only) et
  `..._m22_recurrence_assignee`. Seed Al Amal : résolution « pompe » marquée à exécuter avec sa tâche
  TERMINEE, tâches d'échéances du contrat ascenseur, dépense d'incident à régler (EN_COURS),
  rapport à soumettre (en retard, rappels posés), cuves d'eau trimestrielles (occurrence précédente
  terminée par le gardien, suivante en cours avec checklist), extincteurs BLOQUEE (conseil),
  déclaration CNSS mensuelle invisible du conseil ; `delai_execution_resolution_jours` (PROVISOIRE).
- [x] **Livré (08/09)** — API tag `Tâches` (12 opérations) : liste filtrée (statut, priorité,
  origine, assigné, retard, ouvertes, q ; `meta.par_statut` / `meta.retard`), export csv / xlsx,
  création, upload-url, détail (pièces signées, commentaires, journal), modification, statut
  (transitions, commentaire, photo, récurrence, échéance de contrat réalisée, rejouable), assignation,
  checklist (remplacement ou bascule), commentaires, mes-taches, retard, suivi d'exécution d'une
  résolution (copropriétaires). Hooks : `finaliserResolution` (ADOPTEE + `necessite_execution`),
  `regenererEcheances` / `ajouterEcheance` (synchronisation des tâches d'échéances), incident RESOLU
  avec dépense en attente, rapport GENERE / soumis. Job `taches-rappels-quotidien`. Notifications
  FR/AR `TACHE_ASSIGNEE`, `TACHE_STATUT`, `TACHE_COMMENTAIRE`, `TACHE_ECHEANCE`,
  `TACHES_EN_RETARD_HEBDO`. Audit `TACHE_CREEE/MODIFIEE/STATUT_CHANGE/ASSIGNEE`. `PATCH
  /coproprietes/{id}` et `POST /ag/{id}/resolutions` étendus. Tests `tests/taches.test.ts` (7) :
  hooks idempotents (résolution, échéances — jamais pour un PAIEMENT —, incident, rapport), RLS
  (gardien ses tâches, conseil sans les cachées, propriétaire refusé, journal append-only),
  checklist + clôture par le gardien avec récurrence créée une seule fois et rejeu `deja`,
  réassignation + commentaire, suivi d'exécution sans l'assigné, job J-3 / J-0 / retard / hebdo
  rejouable.
- [x] **Livré (08/09)** — Web : `taches/` (liste + kanban, statistiques, filtres, export),
  `taches/[id]` (checklist cochable, commentaires, journal, pièces jointes, objet source, statut avec
  photo, assignation, annulation), `taches/nouveau` et `[id]/modifier`, suivi d'exécution par
  résolution sur la fiche AG, case « nécessite exécution », délai d'exécution dans Paramètres →
  légaux, bandeau des retards sur le tableau de bord syndic, navigation « Tâches » (syndic, conseil)
  et « Mes tâches » (gardien), FR/AR RTL.
- [x] **Livré (08/09)** — Mobile `features/taches/taches_screens.dart` : mes tâches / registre
  filtré, fiche (checklist, statut avec photo, commentaires, journal, objet source), statut
  **hors-ligne** (Drift v4 `taches_queue`, `taches_sync.dart`), ligne d'exécution sur la fiche AG,
  case « nécessite exécution », onglet « Tâches » du gardien, deep-links, invalidation temps réel ;
  test routeur M22.
- [ ] **Non livré / à confirmer** : RRULE libre (jours fixes, fin de récurrence) ; modèles
  d'obligations légales pré-remplis (brief §13.3) ; création / assignation depuis le mobile
  (web-first, voir parité) ; rattachement d'une annonce TRAVAUX à une tâche.

## M23 — Parkings et caves : emplacements non titrés, attributions, véhicules, badges

*Réf. Doc A §4 (parkings : modèle, scénarios conflictuels), §9 (gardien, visiteurs), §12.
Domaine : `20-parkings-caves.md`. Juridique : brief §14. Branche `feature/m23-parkings`.*

⚠️ **Ajouts signalés au-delà du Master Spec** : enums `TypeEmplacement`, `StatutEmplacement`,
`TypeAttributionEmplacement`, `TypeVehicule`, `TypeBadge`, `StatutBadge` ; valeur
`TypeAppelDeFonds.REDEVANCE_PARKING` ; tables `emplacement`, `attribution_emplacement`,
`vehicule`, `badge` ; colonnes `visite.emplacement_id` / `immatriculation` / `heure_limite`,
`sejour_courte_duree.emplacement_id`, `incident.emplacement_id` / `immatriculation_signalee`,
`attribution_emplacement.expiree_notifiee_le` (idempotence du job), `badge.caution_paiement_id`
(FK `paiement`) ; fonctions SQL `lots_du_resident_courant()` et `residents_du_lot(uuid)`
(SECURITY DEFINER) ; policy `resident_perdu` sur `badge` (UPDATE ACTIF → PERDU pour ses lots) ;
permissions `parkings.gerer`, `parkings.lire` (résidents scoped), `vehicules.gerer_propres`,
`vehicules.rechercher` (GARDIEN / SYNDIC) ; codes `EMPLACEMENT_STATUT_INVALIDE`,
`EMPLACEMENT_CODE_EXISTANT`, `EMPLACEMENT_NON_VISITEUR`, `ATTRIBUTION_CHEVAUCHEMENT`,
`IMMATRICULATION_EXISTANTE`, `IMMATRICULATION_INCONNUE`, `BADGE_STATUT_INVALIDE`,
`BADGE_IDENTIFIANT_EXISTANT` ; audit `EMPLACEMENT_*`, `VEHICULE_DECLARE/MODIFIE/RECHERCHE`,
`BADGE_*`, `VISITE_EMPLACEMENT`. **Écarts par rapport au prompt** : (1) les places titrées ne
sont pas dupliquées : elles restent des lots (Doc A §4.1 TITRE = lot) ; (2) un véhicule ne se
supprime pas, il se désactive (historique des recherches) ; (3) `date_fin` = dernier jour
d'occupation inclus, « libérer » sans date = fin hier ; (4) la caution d'un badge est un montant +
un lien facultatif vers un paiement M17 du lot — aucune écriture comptable dédiée (brief §14.4) ;
(5) la tâche « désactiver le badge » n'est créée que lorsque le syndic déclare la perte (le
résident déclenche la notification, le syndic qualifie) ; (6) la recherche de plaque compare sans
tirets (« 12345a6 » → « 12345-A-6 ») et le plan est une grille par niveau, pas une CAO.

- [x] **Livré (08/09)** — Migrations `..._m23_parkings` (tables, CHECKs plaque / caution / dates,
  `lots_du_resident_courant()`, RLS : emplacement tenant / syndic ; attribution, véhicule, badge :
  gestion et gardien tout, résident ses lots ; véhicule écrit par le résident pour ses lots),
  `..._m23_badge_perdu_resident`, `..._m23_residents_du_lot`. Seed Al Amal : 8 emplacements (2
  visiteurs, 2 communes dont P-12 louée en interne 150 MAD/mois au lot A2 sur résolution d'AG, PMR,
  moto en rotation, local vélos, cave hors service), attribution temporaire expirée, 4 véhicules
  (un inactif), télécommande avec caution, badge perdu + tâche M22 terminée, clé de cave restituée,
  visite du jour placée en P-V1 (heure limite dépassée), séjour LCD placé en P-V2, incident
  « véhicule sur ma place » avec plaque, appel `REDEVANCE_PARKING` du mois précédent réglé.
- [x] **Livré (08/09)** — API tag `Parkings` (24 opérations) : emplacements (liste filtrée +
  `meta.par_statut` + export, plan par niveau, fiche, création, modification, suppression,
  attribuer avec Idempotency-Key, libérer, attributions), véhicules (liste, déclaration, modification,
  retrait, recherche auditée, plaques actives), badges (liste, remise, modification, perdu,
  restituer, désactiver), places visiteurs du jour, place visiteur d'une visite, « notifier le
  véhicule » d'un incident ; `POST /incidents` et `PATCH /lcd/sejours/{id}` étendus. Jobs
  `parkings-quotidien`, `parkings-redevances-mensuel`. Notifications FR/AR (6). Tests
  `tests/parkings.test.ts` (10) : codes uniques, place visiteur non attribuable, chevauchement 409,
  notification et libération, RLS résident (attributions, véhicules, badges de ses lots, 404 sur un
  badge étranger), normalisation et unicité des plaques (doublon invisible sous RLS), recherche
  auditée / refusée aux résidents, caution liée au lot, badge perdu → tâche unique, restitution,
  place visiteur (422 / 409), véhicule gênant (notification, plaque inconnue), jobs rejouables
  (expiration, démarrage, dépassement, redevance mensuelle idempotente).
- [x] **Livré (08/09)** — Web : `parkings/` (plan, emplacements + filtres + export, véhicules +
  recherche, badges, visiteurs du jour), `parkings/[id]` (attribution en cours, historique,
  attribuer / libérer / modifier / supprimer), onglet « Parkings & badges » du lot, place visiteur
  sur la visite du jour, champs parking du formulaire d'incident + bloc « Parking » et « Prévenir le
  propriétaire du véhicule » sur la fiche, navigation « Parkings & badges » (tous rôles sauf
  prestataire et gestionnaire LCD), FR/AR RTL, deep-links.
- [x] **Livré (08/09)** — Mobile `features/parkings/parkings_screens.dart` : onglets par rôle
  (plan, mes emplacements, véhicules avec déclaration / modification / retrait, badges avec perte,
  visiteurs du jour), fiche emplacement (lecture), recherche de plaque du gardien avec cache
  hors-ligne (`cache_entries`), feuille « place visiteur » sur la visite, champs parking de
  l'incident + « prévenir le propriétaire », onglet parkings du lot, deep-links, invalidation temps
  réel ; test routeur M23. Vérifié sur l'émulateur (gardien : places du jour, recherche
  « 98765b40 » → lot A2, changement de place P-V1 → P-V2).
- [ ] **Non livré / à confirmer** : plan graphique (CAO) ; rotation automatique des places
  (tirage au sort, file d'attente) ; gestion des places titrées ici (restent des lots) ; lecture
  automatique de plaque (caméra) ; écriture comptable de la caution (brief §14.4) ; création /
  attribution / remise de badge depuis le mobile (web-first, voir parité).

## M24 — Import Excel et onboarding d'une résidence en une heure

*Réf. Doc A §11 (onboarding), §3.4 (FIFO), Master Spec Partie 5.3 (invitation ↔ compte ↔ lot).
Domaine : `21-import-onboarding.md`. Juridique : brief §15. Branche `feature/m24-import`.*

⚠️ **Ajouts signalés au-delà du Master Spec** : enums `TypeImport`, `StatutImport`,
`TypeImportJobLog` ; valeur `TypeAppelDeFonds.SOLDE_OUVERTURE` ; tables `import_job`,
`import_job_log` (append-only), `solde_ouverture` ; colonnes `invitation.pre_rempli_json`,
`invitation.envoyee_le`, `invitation.accepte_par_id`, `invitation.import_job_id`,
`copropriete.est_demo`, `copropriete.demo_expire_le` ; fonction `invitation_accepter` étendue
(identité et rattachements pré-remplis, normalisation des quote-parts d'indivision — migrations
`m24_import_onboarding` et `m24_invitation_accepter_normalisation`) ; type de document
`IMPORT_SOURCE` (déjà réservé en M16) ; permissions `import.gerer`, `import.lire`,
`onboarding.lire`, `demo.gerer` ; codes `IMPORT_FICHIER_ILLISIBLE`, `IMPORT_STATUT_INVALIDE`,
`DEMO_INTERDIT` ; audit `IMPORT_CREE/LANCE/TERMINE/ECHOUE/ANNULE`, `INVITATIONS_ENVOI_MASSE`,
`COPROPRIETE_DEMO_CREEE` ; `GET /finances/lots/{id}/solde` étendu (`avoir_ouverture`,
`solde_ouverture`). **Écarts par rapport au prompt** : (1) **aucun compte fantôme** : les
propriétaires / employés inconnus deviennent des invitations pré-remplies matérialisées à
l'acceptation (`utilisateur.telephone` est unique et `invitation_accepter` refuse un numéro déjà
pris — créer des `utilisateur` sans compte aurait bloqué l'inscription ou exigé une fusion de
comptes) ; les membres déjà connus sont rattachés directement ; (2) le **solde d'ouverture dû est
matérialisé comme ligne d'appel `SOLDE_OUVERTURE`** plutôt que traité comme une entité financière
parallèle : le FIFO M17, l'escalade M5, les quittances et le relevé le voient sans code spécial ;
l'avoir (négatif) reste dans `solde_ouverture` et est déduit du solde affiché (l'avance n'est pas
supportée par le moteur, écart M5) ; (3) la progression se lit par `GET /import/{id}` (polling
2 s côté web) — le flux SSE existant ne transporte que les notifications ; `IMPORT_TERMINE` y
arrive ; (4) l'envoi SMS / e-mail en masse passe par les transports de notification sans ligne
`notification` (pas d'utilisateur) : statistiques dans la réponse, `envoyee_le` + audit ;
(5) `POST /coproprietes/{id}/demo` crée la démo depuis une fixture code (sous-ensemble d'Al Amal),
pas depuis le script de seed (qui crée des comptes à téléphones fixes) ; (6) la démo est purgée
par suppression ordonnée des tables qu'elle alimente — une démo enrichie hors périmètre reste
signalée dans les erreurs du job, jamais supprimée à moitié.

- [x] **Livré (08/09)** — Migrations `..._m24_import_onboarding` (tables, CHECKs, RLS syndic /
  conseil, journal append-only, `invitation_accepter` étendue) et
  `..._m24_invitation_accepter_normalisation`. Seed Al Amal : import LOTS_PROPRIETAIRES terminé
  (fichier source SYNDIC_ONLY, journal ligne à ligne, audit), invitation LOCATAIRE pré-remplie jamais
  envoyée, solde d'ouverture de A3 (600 MAD, ligne `SOLDE_OUVERTURE` escaladée N2) et avoir de A1.
- [x] **Livré (08/09)** — API tag `Import` (13 opérations) : upload-url, création + analyse
  (synonymes FR/AR/EN, tableurs sales, aperçu, avertissements), historique, fiche / progression,
  aperçu, mapping, exécution (job Inngest `import-executer`, chunks idempotents, savepoint par
  ligne, `?sync=1`), annulation, rapport csv, modèles xlsx FR/AR, invitations en masse (SMS /
  e-mail / csv WhatsApp), checklist d'onboarding, démo SUPER_ADMIN ; job `demo-purge-quotidien`.
  Exécuteurs : lots + propriétaires, soldes d'ouverture, prestataires, contrats, véhicules / badges,
  personnel. Notifications FR/AR `IMPORT_TERMINE`, `INVITATION_ENVOI`. Tests `tests/import.test.ts`
  (12) : normalisation, détection FR / AR / EN et csv sale, analyse (mapping, doublons, tantièmes,
  même personne), exécution (membre connu rattaché, une invitation par personne avec ses lots,
  indivision, rejeu = rien deux fois, rapport), mapping corrigé, conseil en lecture, annulation,
  acceptation pré-remplie (identité, lot, 100 → 50/50, `accepte_par_id`), envoi en masse jamais
  automatique (csv, audit), soldes d'ouverture (ligne la plus ancienne, avoir, FIFO, escalade),
  autres types, RLS (id forgé → refus, rien créé dans B), checklist, démo + purge.
- [x] **Livré (08/09)** — Web : `import/` (Démarrer : checklist + modèles ; Imports : historique ;
  Invitations en masse), `import/nouveau` (type, fichier, options), `import/[id]` (étapes, colonnes
  corrigeables, aperçu avec erreurs, exécution + progression, résultat, rapport csv, invitations),
  carte « Démarrage » sur le tableau de bord syndic, bouton « Envoyer les invitations » sur la page
  Invitations, « Créer une démo » dans la console SUPER_ADMIN, relais `/api/import-fichier`,
  navigation « Importer & démarrer », FR/AR RTL, deep-link.
- [x] **Livré (08/09)** — Mobile : carte « Démarrage » sur le tableau de bord syndic (lecture,
  rafraîchie par push), deep-link `IMPORT_TERMINE` ; test routeur M24.
- [ ] **Non livré / à confirmer** : reprise des paiements passés (historique des quittances) ;
  import des occupants / locataires en masse (hors PERSONNEL) ; envoi WhatsApp par agrégateur ;
  avance / trop-perçu comme avoir automatique (moteur M5) ; fusion d'un compte existant avec une
  invitation d'un autre numéro ; import depuis le mobile (web-first, voir parité).

## M25 — Cabinet / portefeuille multi-résidences

*Réf. Doc A §8 (syndic professionnel), Master Spec Partie 1.6 (deux couches), 2.4 (un syndic
actif), 4 (rôles). Domaine : `22-cabinet.md`. Juridique : brief §16. Branche
`feature/m25-cabinet`.*

⚠️ **Ajouts signalés au-delà du Master Spec** : enums `StatutCabinet`, `RoleCabinet`,
`StatutMandat`, `TypeCabinetLog` ; **valeur `RoleType.SYNDIC_COMPTABLE`** (comptable d'un cabinet,
lecture seule des finances — policies SELECT **additives** `comptable_select` sur depense,
depense_log, facture, justificatif_paiement, fonds_reserve(+mouvement), contrat, contrat_echeance,
contrat_log, rapport_gestion, contestation_charge, appel_de_fonds_lot, paiement, quittance,
lot_proprietaire, lot_occupant, lot, export_log (+ INSERT), solde_ouverture, import_job ; aucune
policy existante modifiée) ; tables `cabinet`, `cabinet_membre`, `cabinet_copropriete`,
`cabinet_log` (append-only), `cabinet_prestataire` ; colonnes `copropriete.cabinet_id`,
`role_utilisateur.cabinet_id` (rôle posé par le cabinet), `prestataire.cabinet_prestataire_id` ;
fonctions SQL `cabinet_role_courant`, `cabinet_appliquer_acces`, `cabinet_mandat_confirmer`,
`cabinet_mandat_terminer`, `cabinet_portefeuille`, `cabinet_coproprietes_visibles`,
`cabinet_identites`, `cabinet_trouver_utilisateur`, `cabinet_creer_copropriete`,
`cabinet_fiche_publique`, `cabinet_marque`, `cabinet_coproprietes_fiche`,
`portefeuille_kpi_rafraichir` ; vue matérialisée `portefeuille_kpi` ; helper `withActeur`
(transaction sans copropriété) ; permissions `cabinet.mandat.confirmer`, `cabinet.mandat.lire` +
`SYNDIC_COMPTABLE: true` sur 19 lectures finances ; codes `CABINET_STATUT_INVALIDE`,
`MANDAT_EXISTANT`, `MANDAT_STATUT_INVALIDE`, `CONFLIT_SYNDIC`. **Écarts par rapport au prompt** :
(1) l'annuaire partagé est une table `cabinet_prestataire` copiée dans `prestataire`
(`Prestataire.cabinetId` aurait créé une ligne sans copropriété, impossible sous RLS) ; (2) un
membre de cabinet sans aucun rôle de copropriété entre dans un **mode « cabinet seul »** (rôle
applicatif `MEMBRE_CABINET`, côté clients uniquement — pas de valeur d'enum en base ni de claim JWT) :
espace cabinet + profil, aucune copropriété active, boutons « ouvrir la résidence » masqués tant
qu'un mandat ne lui a pas donné de rôle ; (3) la fin de mandat laisse la copropriété sans
syndic (l'opérateur ou l'AG désigne le suivant) — pas de réactivation automatique de l'ancien ;
(4) les KPI agrégés (agenda, alertes) sont calculés copropriété par copropriété sous un contexte
système interne après vérification de l'appartenance (les policies ne regardent jamais le
cabinet) ; (5) la marque du cabinet apparaît sur le rapport de gestion et les relevés (texte),
pas encore sur les convocations d'AG ni en logo.

- [x] **Livré (08/09)** — Migrations `..._m25_cabinet` (tables, RLS par appartenance,
  réconciliation des accès, confirmation / fin de mandat SQL, vue matérialisée + fonctions,
  policies du comptable), `..._m25_cabinet_fonctions`, `..._m25_cabinet_copro_fiche`,
  `..._m25_comptable_lot`. Seed Al Amal : cabinet « Atlas Gestion » (syndic = admin, gestionnaire
  Salma Tahiri +212600000010), mandat actif sur Al Amal (honoraires 2 500 MAD → contrat
  SYNDIC_PROFESSIONNEL) et sur une seconde résidence « Les Palmiers » (3 lots, budget, appel,
  impayés N1, incident urgent — la gestionnaire en est SYNDIC via `cabinet_id`), annuaire (Otis,
  Clean Pro), journal, vue rafraîchie.
- [x] **Livré (08/09)** — API tag `Cabinet` (19 opérations) : cabinets (liste / fiche / création
  SUPER_ADMIN / modification), membres (ajout par id / téléphone / e-mail, rôle, retrait),
  mandats (proposer sur une copropriété existante ou créer une résidence, modifier, terminer,
  **confirmer** par le syndic en place), portefeuille (tri, alertes, csv / xlsx), agenda, alertes,
  annuaire (modèles, copie), `GET /coproprietes/{id}/mandat`. Job `portefeuille-kpi-refresh`
  (*/15). Notifications FR/AR `MANDAT_PROPOSE`, `MANDAT_CONFIRME`, `MANDAT_TERMINE`. Marque du
  cabinet sur rapport de gestion et relevé. Tests `tests/cabinet.test.ts` (7) : création /
  appartenance / étranger, passation (rôle cédé, SYNDIC + SYNDIC_COMPTABLE posés, contrat
  d'honoraires, doublon 409, conseil refusé), comptable lecture seule (solde, appels ; écriture
  refusée ; rien dans une autre copropriété), KPI de la vue = données (lots, appelé, encaissé,
  taux, impayés, incidents, tâches, AG, assurance, alertes, totaux), gestionnaire ne voit que ses
  copropriétés / cabinet B rien, changement de gestionnaire bascule SYNDIC, résidence créée =
  mandat actif, retrait du comptable et fin de mandat révoquent atomiquement, dernier admin
  protégé, annuaire copié idempotent / hors portefeuille refusé.
- [x] **Livré (08/09)** — Web : `cabinet/` (portefeuille avec totaux, tri, filtre alertes, export,
  ouverture d'une copropriété en un clic ; alertes ; agenda ; équipe + mandats ; annuaire ;
  paramètres), sélecteur de cabinet, lien « cabinet » au-dessus de la copropriété active,
  Paramètres → « Cabinet de syndic » (mandat proposé / actif, **confirmation de la passation**),
  rôle `SYNDIC_COMPTABLE` (navigation finance en lecture, tableau de bord en lecture, gardes des
  pages finances / rapports / contrats / import / lots), FR/AR RTL.
- [x] **Livré (08/09)** — Mobile `features/cabinet/cabinet_screens.dart` : portefeuille (cartes
  KPI), alertes, agenda (lecture), sélecteur de cabinet, navigation (syndic : administration ;
  comptable : finances en lecture) ; test routeur M25.
- [x] **Livré (08/09)** — mode « cabinet seul » web + mobile pour un membre sans rôle de
  copropriété (`getAppContext` / `AppStateController` interrogent `/cabinets` avant de conclure
  « sans accès ») ; test routeur mobile.
- [ ] **Non livré / à confirmer** : convocations d'AG avec marque et logo du cabinet ; sparklines historiques (la vue
  ne garde que l'instantané) ; facturation des honoraires par le cabinet (avoir / relance) ;
  gestion (membres, mandats) depuis le mobile (web-first, voir parité) ; désignation du syndic
  suivant à la fin d'un mandat.

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
