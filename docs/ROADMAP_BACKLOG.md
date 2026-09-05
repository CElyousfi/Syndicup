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
