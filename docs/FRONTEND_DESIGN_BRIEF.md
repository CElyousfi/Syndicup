# Brief de design frontend — SyndicUp (plateforme de gestion de copropriété, Maroc)

> **Destinataire : l'agent de design chargé de concevoir l'intégralité des écrans.**
> Ce document est autoportant : il décrit le produit, l'état exact du backend (100 % livré et
> testé), les conventions d'API que l'UI consommera, les 9 rôles et leur visibilité, puis
> l'**inventaire complet des pages à designer** avec, pour chacune : objectif, données
> (endpoints réels), actions, et états à prévoir. Rien ici n'est spéculatif — chaque endpoint
> cité existe, est testé (229 tests) et validé par la CI.

---

## 1. Le produit en une page

**SyndicUp** est une plateforme SaaS de gestion de copropriété pour le **marché marocain**
(cadre légal : Loi 18-00 / 106-12, protection des données Loi 09-08 CNDP). Un backend unique
(API REST) sert **trois clients** : web (Next.js), iOS et Android (Flutter).

**Ce que l'app fait** : gestion des lots et propriétaires, appels de fonds et paiements
(charges de copropriété), assemblées générales avec vote et procès-verbal à valeur légale,
incidents/maintenance, réservation d'espaces communs, module gardien (visiteurs), documents,
litiges, notifications multicanal.

**Qui l'utilise** (personas réels du marché marocain) :
- le **syndic** (professionnel ou copropriétaire bénévole) — l'utilisateur pivot, gère tout ;
- le **copropriétaire** — dont le **MRE** (Marocain Résidant à l'Étranger, très fréquent :
  utilise surtout l'email, ne peut pas assister aux AG → procurations) ;
- le **locataire** — droits volontairement limités (pas de vote, pas de finances) ;
- le **gardien/concierge** — souvent peu digitalisé, usage mobile simple (visiteurs, incidents) ;
- le **conseil syndical** — élu pour contrôler le syndic, lecture étendue ;
- le **prestataire** — ne voit QUE ses tickets assignés.

**Deux tons à équilibrer** : le produit gère de l'argent et du juridique → il doit paraître
**sérieux et institutionnel** (palette sobre, hiérarchie typographique nette, densité
maîtrisée), tout en restant utilisable par un public **peu digitalisé et parfois âgé**
(gros points de contact, libellés simples, jamais de jargon technique à l'écran).

---

## 2. Contraintes de design NON NÉGOCIABLES

1. **Bilingue FR/AR avec RTL natif dès le premier écran.** Chaque écran doit être conçu pour
   fonctionner en miroir (arabe = droite→gauche). Utiliser exclusivement des propriétés
   logiques (`start`/`end`, jamais `left`/`right`). La langue vient du profil utilisateur
   (`langue_preferee : FR | AR`). Prévoir la police arabe (fallback type Noto Sans Arabic).
2. **Accessibilité WCAG 2.1 AA** : contrastes AA minimum, navigation clavier, labels,
   taille de police ≥ 14px effectif sur mobile, zones tactiles ≥ 44px.
3. **Design tokens** (Master Spec Partie 14.2, indicatifs) : `color.primary` bleu
   institutionnel foncé · `color.danger` rouge (impayés, urgences) · `color.success` vert
   (payé, résolu) · échelle de gris neutre · `radius 8px` · espacement 4/8/12/16/24/32.
4. **Composants récurrents à systématiser** : `DataTable` (lots, charges, incidents),
   `StatusBadge` (les statuts sont OMNIPRÉSENTS — voir §6), `VoteCard`, `ChargeSummaryCard`,
   `NotificationBanner` (variante visuelle distincte pour urgence maximale), `EmptyState`,
   `ConfirmDialog` — **obligatoire sur toute action irréversible** (transfert de propriété,
   clôture d'AG, activation de budget, anonymisation).
5. **Le masquage visuel n'est jamais un contrôle d'accès** : la navigation par rôle est
   résolue côté serveur ; le design doit prévoir des navigations différentes PAR RÔLE
   (voir §5), pas une seule navigation avec des éléments grisés.
6. **Argent** : tous les montants sont des chaînes décimales `"1250.00"` en MAD (dirhams).
   Toujours 2 décimales affichées, format `1 250,00 MAD`. Jamais de calcul côté client.

---

## 3. État du backend (ce qui existe — tout est livré et testé)

Le backend est **code-complet et vert en CI** : 15 modules, 82 opérations d'API, RLS
(isolation multi-tenant + confidentialité fine) sur 100 % des tables, 229 tests.

| Domaine | Livré |
|---|---|
| Auth & onboarding | OTP téléphone (SMS), email+mot de passe, invitations (email/SMS/QR) avec code 8 caractères, machine à états de compte |
| Copropriétés | Création (super admin), configuration syndic (flags, tantièmes, **paramètres légaux**) |
| Lots | CRUD, propriétaires (plein/indivision avec quote-parts = 100 %), occupants, transfert de propriété avec vérification de solde |
| Finances | Budgets AG (cycle PROPOSE→ACTIF→REMPLACE), appels de fonds batch au prorata des tantièmes, paiements (ciblé ou **FIFO** multi-échéances), quittances auto, contestations, escalade impayés N1→N6 automatique (job quotidien) |
| AG | Cycle PLANIFIEE→CONVOQUEE→EN_COURS→CLOTUREE/ANNULEE, résolutions, votes (majorité simple/double/unanimité, égalité 50/50 = rejeté), procurations, quorum, **PV avec hash d'intégrité + PDF** |
| Incidents | Catégories fermées (11), urgence 3 niveaux avec SLA, assignation prestataire, journal d'événements, mass-push urgence maximale |
| Espaces communs | Espaces réservables, réservations avec détection de conflit de créneau, validation manuelle ou automatique |
| Personnel/Visites | Fiche gardien (logement de service), enregistrement visiteur → notification push au résident → autoriser/refuser |
| Documents | Upload, visibilité à 3 niveaux (public copropriété / syndic seul / conseil syndical), téléchargement par URL signée 15 min |
| Notifications | Boîte de réception personnelle, marquer lu, templates FR/AR |
| Litiges | Déclaration, escalade 0 (syndic) → 1 (médiation AG) → 2 (tribunal) |
| Utilisateurs/CNDP | Profil, export de données (droit d'accès), anonymisation |
| Jobs | Escalade impayés (quotidien), rappels AG (J-3), anonymisation CNDP (mensuel), notification des appels de fonds |

**Volontairement absent ou désactivé** (ne PAS designer comme fonctionnel — voir §9) :
paiement en ligne CMI (décision : inactif pour l'instant), avance/avoir sur paiements,
caution de réservation, réservations récurrentes, endpoints succession, 2e convocation d'AG
automatique, PV en arabe (le PDF est FR pour l'instant).

### 3.1 Conventions d'API (impactent directement l'UI)

- **Enveloppes** : succès `{ data, meta: { request_id, total?, page?, has_more? } }` ;
  erreur `{ error: { code, message, fields? }, meta: { request_id } }`.
- **Codes d'erreur** → traitement UI :
  - `VALIDATION_ERROR` (400) : `fields` mappe champ → message — afficher sous chaque champ ;
  - `UNAUTHENTICATED` (401) : rediriger vers la connexion ;
  - `FORBIDDEN` (403) : écran/toast « accès non autorisé » ;
  - `NOT_FOUND` (404), `CONFLICT` (409) : messages contextuels ;
  - `UNPROCESSABLE_ENTITY` (422) : **règle métier** — le `message` est en français et
    destiné à l'utilisateur, l'afficher tel quel (voir « états gatés » §6.3) ;
  - `RATE_LIMITED` (429) : « Trop de tentatives, réessayez dans X s » (header Retry-After).
- **Authentification** : `Authorization: Bearer <JWT>`. Un utilisateur avec des rôles dans
  **plusieurs copropriétés** doit choisir sa copropriété active (header `X-Copropriete-Id`)
  → prévoir un **sélecteur de copropriété** (voir page A4).
- **Idempotency-Key** (UUID, généré par le client) : obligatoire sur les écritures
  financières/probantes (paiements, appels de fonds, activation budget, transfert, votes,
  visites, anonymisation). Invisible pour l'utilisateur, mais permet un pattern UI :
  **le bouton « Réessayer » après une erreur réseau est toujours sûr** (jamais de doublon).
- **Pagination** : `?page=&limit=` (max 100), `meta.total` / `meta.has_more`.
- **Langue de l'API** : tous les messages d'erreur métier sont en français, prêts à afficher.

---

## 4. Modèle mental des données (pour designer juste)

- Une **copropriété** est l'espace de travail (tenant). Tout vit dedans.
- Un **lot** (appartement, parking, cave, villa, local, bureau, loge gardien…) porte des
  **tantièmes** (quote-part, ex. 300/10000) qui déterminent charges ET poids de vote.
- Un lot a des **propriétaires** (1 en pleine propriété, ou plusieurs en **indivision** avec
  quote-parts sommant à 100 % et un représentant désigné pour le vote) et des **occupants**
  (propriétaire occupant ou locataire).
- Un **appel de fonds** (période « 2026-01 », type CHARGES_COURANTES / EXCEPTIONNEL /
  FONDS_RESERVE / REGULARISATION / URGENCE / DEMARRAGE) se décompose en **lignes par lot**
  (montant dû / payé / statut PAYE-PARTIEL-IMPAYE + niveau d'escalade N0→N6 + flag contesté).
- Une **AG** contient des **résolutions** ordonnées ; chaque résolution a un type de
  majorité et reçoit des **votes** (pour/contre/abstention) pondérés par tantièmes ;
  la clôture génère le **PV** (document légal, hash d'intégrité affichable).
- Statut de compte utilisateur : INVITE → EN_VALIDATION → ACTIF ⇄ SUSPENDU → DESACTIVE →
  ANONYMISE.

---

## 5. Les 9 rôles et leur navigation

> Chaque rôle a SA navigation. Le tableau donne les sections visibles par rôle.
> ✓ = accès complet · ◐ = accès restreint à ses propres données · ✗ = section absente.

| Section | SYNDIC | CONSEIL_SYNDICAL | PROPRIETAIRE / INDIVISAIRE / PERS. MORALE | LOCATAIRE | GARDIEN | PRESTATAIRE | SUPER_ADMIN |
|---|---|---|---|---|---|---|---|
| Tableau de bord | ✓ (gestion) | ✓ (contrôle) | ✓ (mon foyer) | ◐ | ✓ (terrain) | ◐ (mes tickets) | ✓ (plateforme) |
| Lots | ✓ CRUD | ✓ lecture | ◐ ses lots | ◐ son lot | ✓ lecture | ✗ | ✓ |
| Finances — budgets | ✓ CRUD | ✓ lecture | ✓ lecture | ✓ lecture | ✗ | ✗ | ✓ |
| Finances — appels/soldes | ✓ tout | ✓ tout | ◐ **ses lots uniquement** | ✗ (option accordable) | ✗ | ✗ | ✓ |
| Paiements (saisie) | ✓ | ✗ | ✗ (CMI désactivé) | ✗ | ✗ | ✗ | ✓ |
| Contestations | ✓ répond | ✓ lecture | ✓ crée (ses lignes) | ✗ | ✗ | ✗ | ✓ |
| AG | ✓ organise | ✓ lecture + vote | ✓ vote | ◐ PV si option | ✗ | ✗ | ✓ |
| Incidents | ✓ tout | ✓ tout | ◐ les siens | ◐ les siens | ✓ tout | ◐ assignés | ✓ |
| Prestataires | ✓ CRUD | ✓ lecture | ✗ | ✗ | ✓ lecture | ✗ | ✓ |
| Espaces communs / réservations | ✓ gère | ✓ | ✓ réserve | ✓ réserve (si config) | ✓ lecture | ✗ | ✓ |
| Visites | ✓ | ✓ | ◐ ses lots (répond) | ◐ son lot (répond) | ✓ enregistre | ✗ | ✓ |
| Personnel | ✓ CRUD | ✓ lecture | ✗ | ✗ | ◐ sa fiche | ✗ | ✓ |
| Documents | ✓ + upload | ✓ (3 niveaux) | ✓ (publics) | ✓ (publics) | ✓ (publics) | ✗ | ✓ |
| Notifications | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Litiges | ✓ tout | ✓ tout | ◐ les siens | ◐ les siens | ✗ | ✗ | ✓ |
| Paramètres copropriété | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Invitations | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Copropriétés (multi) | ◐ les siennes | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ CRUD |

**Règles de confidentialité à respecter visuellement** (appliquées par le serveur, mais le
design ne doit jamais suggérer le contraire) :
- Un résident **ne voit jamais la dette d'un autre lot** — seulement un taux global de
  recouvrement de la copropriété.
- Les **votes AG sont anonymes pour les résidents** (résultats agrégés uniquement) ; seul le
  syndic accède au détail nominatif (page dédiée, clairement étiquetée « audit »).
- Un locataire ne voit ni finances ni AG (sauf PV si le propriétaire active l'option).
- Un prestataire ne voit RIEN d'autre que ses tickets assignés — son app est minimale.

---

## 6. Vocabulaire des statuts (à traduire en badges/couleurs)

### 6.1 Badges de statut par entité
- **Ligne d'appel de fonds** : `PAYE` (succès) · `PARTIEL` (avertissement) · `IMPAYE`
  (danger) + niveau d'escalade `N0…N6` (gravité croissante : N1 rappel → N3 mise en demeure
  → N6 injonction judiciaire) + flag `conteste`.
- **Budget** : `PROPOSE` · `VOTE` · `ACTIF` (seul un ACTIF permet de générer des appels) ·
  `REMPLACE` (rectificatif : l'ancien est archivé, garder visible dans l'historique).
- **AG** : `PLANIFIEE` → `CONVOQUEE` → `EN_COURS` (séance live) → `CLOTUREE` / `ANNULEE`.
- **Résolution** : `EN_ATTENTE` → `ADOPTEE` / `REJETEE`.
- **Incident** : `OUVERT` → `EN_COURS` → `RESOLU` → `FERME` ; urgence `NORMALE` / `URGENTE`
  / `URGENCE_MAXIMALE` (SLA affiché : 48 h / 4 h / 30 min).
- **Réservation** : `EN_ATTENTE` → `CONFIRMEE` / `REJETEE` / `ANNULEE`.
- **Visite** : `EN_ATTENTE` → `AUTORISE` / `REFUSE`.
- **Litige** : `OUVERT` → `RESOLU` / `CLOS` + niveau d'escalade 0/1/2.
- **Invitation** : `EN_ATTENTE` · `ACCEPTEE` · `EXPIREE` · `REGENEREE`.
- **Compte** : `INVITE` · `EN_VALIDATION` · `ACTIF` · `SUSPENDU` · `DESACTIVE` · `ANONYMISE`.
- **Notification (envoi)** : `EN_ATTENTE` · `ENVOYE` · `ECHOUE` — en environnement de dev,
  tout est `EN_ATTENTE` (aucun fournisseur branché) : c'est normal, ne pas styler en erreur.

### 6.2 Types fermés (listes de sélection)
- Type de lot : APPARTEMENT, PARKING, CAVE, LOCAL, TOIT_TERRASSE, VILLA, COMMERCIAL,
  BUREAU, LOGE_GARDIEN.
- Catégorie d'incident (11) : PLOMBERIE, ELECTRICITE, ASCENSEUR, NETTOYAGE, SECURITE,
  STRUCTURE, JARDINS, NUISANCES, PARKING, EQUIPEMENTS, ADMINISTRATIF (+ sous-catégorie
  libre, + partie COMMUNE/PRIVATIVE).
- Méthode de paiement (manuel) : VIREMENT, ESPECES, CHEQUE.
- Type de résidence : IMMEUBLE_COLLECTIF, RESIDENCE_FERMEE, RESIDENCE_VILLAS,
  IMMEUBLE_BUREAUX, IMMEUBLE_MIXTE, RESIDENCE_ETUDIANTE.
- Canal d'invitation : EMAIL, SMS, QR_CODE, WHATSAPP.

### 6.3 ⚠️ L'état « gaté légalement » — un état UI de première classe
Certaines valeurs (délai de convocation d'AG, quorum, limite de procurations, durée de
rétention CNDP) attendent une **confirmation juridique** et sont volontairement non
configurées. Les endpoints concernés renvoient alors **422** avec un message explicite.
Le design DOIT prévoir cet état — sur les actions « Convoquer l'AG », « Ouvrir la séance »,
« Donner procuration » :
- une **bannière d'information** (pas une erreur rouge) : « Paramètre légal non configuré —
  en attente de confirmation juridique » ;
- pour le syndic : un lien vers la page Paramètres de la copropriété où saisir la valeur
  une fois confirmée.
C'est un choix produit assumé (jamais de valeur légale devinée), pas un bug.

---

## 7. INVENTAIRE COMPLET DES PAGES — application web

> Routes indicatives sous `/{locale}/…` (fr | ar). Chaque page liste : rôle(s), objectif,
> données (endpoints), actions, états particuliers. **Toutes les pages ont aussi les états
> standard : chargement (squelettes), vide (EmptyState avec action), erreur.**

### Zone A — Public & authentification

**A1. Connexion** — `/connexion`
Choix entre deux méthodes (onglets) : téléphone (par défaut — résidents/gardiens) et
email + mot de passe (MRE/syndic). Téléphone marocain `+212 6XX XX XX XX`.
Endpoints : `POST /auth/otp/request`, `POST /auth/login`. États : 429 (trop de demandes
OTP — 5/h), identifiants invalides (401, message neutre).

**A2. Vérification OTP** — `/connexion/code`
Saisie code 6 chiffres (champs séparés, auto-avance, coller supporté), renvoyer le code
(compte à rebours), retour. Endpoint : `POST /auth/otp/verify`. États : code invalide/expiré,
429 anti force-brute.

**A3. Acceptation d'invitation** — `/invitation/{code}` (cible des QR codes affichés en hall
d'immeuble). Affiche le contexte (copropriété, rôle proposé — ex. « Vous êtes invité comme
PROPRIÉTAIRE du lot A3 »), authentification (A1/A2) puis `POST /auth/invite/accept`.
États : code déjà utilisé (« déjà inscrit, connectez-vous »), expiré (« demandez au syndic
de régénérer »), email/téléphone déjà pris (409).

**A4. Sélecteur de copropriété** — `/choisir-copropriete`
Affiché quand le JWT contient plusieurs rôles (syndic multi-copropriétés, propriétaire de
lots dans 2 résidences). Cartes : nom, ville, rôle. Le choix devient le contexte de toute la
session (rappel permanent dans l'en-tête + changement rapide). Endpoint : `GET /coproprietes`.

**A5. États de compte bloquants** — écrans pleine page pour `SUSPENDU` (contacter le
syndic), `EN_VALIDATION` (finir la vérification), 404, erreur serveur générique
(avec `request_id` affiché discrètement pour le support).

### Zone B — Tableaux de bord (page d'accueil PAR RÔLE)

**B1. Dashboard syndic** — `/tableau-de-bord`
LA page la plus importante du produit. Blocs : taux de recouvrement global + montant impayé
(danger) avec répartition par niveau d'escalade N1→N6 · incidents ouverts par urgence (SLA
en retard en évidence) · prochaine AG et son statut · réservations `EN_ATTENTE` à valider ·
derniers paiements reçus · raccourcis (générer un appel de fonds, inviter un résident,
créer une AG). Données : `GET /finances/appels-de-fonds`, `GET /incidents`,
`GET /ag`, `GET /reservations`, `GET /notifications`.

**B2. Dashboard résident (propriétaire/indivisaire/personne morale)** — `/tableau-de-bord`
Mon solde par lot (montant dû, prochaine échéance, bouton « voir le détail ») · ma prochaine
AG (avec bouton procuration) · mes incidents en cours · mes réservations · notifications
récentes. Données : `GET /lots` (ses lots), `GET /finances/lots/{id}/solde`, `GET /ag`,
`GET /incidents`, `GET /notifications`.

**B3. Dashboard locataire** — version réduite de B2 : PAS de bloc finances ni AG (sauf
« PV disponibles » si option activée) ; incidents + réservations + notifications.

**B4. Dashboard conseil syndical** — comme B1 mais en **lecture** (pas de boutons d'action
de gestion) ; met en avant le contrôle : dépenses, taux de recouvrement, litiges ouverts.

**B5. Dashboard gardien** — orienté terrain (sera surtout utilisé sur mobile, voir §8) :
visites en attente de réponse · enregistrer un visiteur (action primaire, très visible) ·
incidents ouverts · signaler un incident.

**B6. Dashboard super admin** — `/admin` : liste des copropriétés de la plateforme
(recherche, statut ACTIVE/ARCHIVEE), bouton « Créer une copropriété ».
Endpoints : `GET /coproprietes`, `POST /coproprietes`.

### Zone C — Lots & résidents

**C1. Liste des lots** — `/lots`
DataTable : numéro, type (badge), étage, tantièmes, statut (OCCUPE/VACANT/…), propriétaire(s),
solde (syndic seulement). Filtres type/statut, recherche. Résident : ne voit que ses lots.
Endpoints : `GET /lots` (paginé). Action syndic : « Nouveau lot ».

**C2. Fiche lot** — `/lots/{id}`
En-tête (numéro, type, tantièmes, statut) + onglets :
- **Propriété** : propriétaires actifs et historiques (dates début/fin), quote-parts —
  l'indivision affiche la répartition (ex. 50 % / 50 %) et le **représentant** (étoile) ;
- **Occupation** : occupants (propriétaire occupant / locataire, dates) ;
- **Finances** (syndic + propriétaire du lot) : solde détaillé ligne par ligne
  (`GET /finances/lots/{id}/solde`) avec statut, escalade, flag contesté, action « Contester » ;
- **Historique** : transferts passés.
Actions syndic : modifier, ajouter propriétaire/occupant, **transférer la propriété**.

**C3. Créer/modifier un lot** — `/lots/nouveau`, `/lots/{id}/modifier` (syndic)
Formulaire : type (liste fermée), numéro, étage, tantièmes, superficie, lot parent
(rattacher un parking/cave à un appartement). Endpoints : `POST /lots`, `PATCH /lots/{id}`.
État 422 : la somme des tantièmes dépasserait le total du règlement.

**C4. Ajouter un propriétaire / un occupant** — modales depuis C2
Propriétaire : utilisateur, quote-part, type (PLEIN/INDIVISION/SCI), représentant
d'indivision. **Règle forte à visualiser : les quote-parts actives doivent sommer à 100 %**
(jauge de progression pendant la saisie). Occupant : type, accès finances accordé (pour un
locataire), reçoit les convocations. Endpoints : `POST /lots/{id}/proprietaires`,
`POST /lots/{id}/occupants`.

**C5. Transfert de propriété (vente)** — assistant en étapes depuis C2 (syndic)
Étape 1 : solde du lot affiché — si dette > 0, case obligatoire « l'acquéreur reprend la
dette » (`dette_reprise_acquereur`) avec avertissement ; Étape 2 : coordonnées du nouveau
propriétaire (une invitation lui sera envoyée) ; Étape 3 : **ConfirmDialog** irréversible ;
Résultat : code d'invitation généré à transmettre. Endpoint :
`POST /lots/{id}/transfert-propriete`. États 422 : indivision non supportée (message
explicite : traiter manuellement), dette non reprise.

### Zone D — Finances

**D1. Budgets** — `/finances/budgets`
Liste par exercice : montant, statut (PROPOSE/VOTE/ACTIF/REMPLACE), lien AG. Le badge ACTIF
de l'exercice courant est l'information clé (« sans budget actif, pas d'appel de fonds »).
Actions syndic : créer (exercice + montant + AG liée optionnelle), modifier (PROPOSE
uniquement), **Activer** (ConfirmDialog : « si un budget est déjà actif pour {exercice}, il
passera en REMPLACÉ » — budget rectificatif). Endpoints : `GET/POST /finances/budgets`,
`GET/PATCH /finances/budgets/{id}`, `POST /finances/budgets/{id}/activer`.
Lecture ouverte à tous les résidents (transparence budgétaire).

**D2. Appels de fonds** — `/finances/appels-de-fonds`
Liste : période, type, montant total, échéance, statut, taux de paiement (jauge).
Action syndic : **« Générer un appel de fonds »** (modale : période AAAA-MM, type, montant
total, date d'échéance ; explication : « réparti automatiquement au prorata des tantièmes »).
Endpoints : `GET/POST /finances/appels-de-fonds`. États : 422 pas de budget ACTIF (avec lien
vers D1), 409 période+type déjà émis.

**D3. Détail d'un appel de fonds** — `/finances/appels-de-fonds/{id}` (syndic/conseil)
Résumé (montant, somme des lignes = montant exact au centime) + DataTable des lignes par
lot : dû, payé, statut, niveau d'escalade (badge N0→N6), contesté. Action par ligne :
« Enregistrer un paiement » (→ D4).

**D4. Enregistrer un paiement** — modale/page (syndic)
Deux modes (onglets) : **Ciblé** (une ligne précise, montant, méthode VIREMENT/ESPECES/
CHEQUE, payeur optionnel, case explicite « accepter le trop-perçu ») et **FIFO** (choisir un
LOT + un montant : « imputé automatiquement sur les échéances les plus anciennes » — l'API
renvoie la répartition, l'afficher en confirmation : ligne X 40,00 soldée, ligne Y 10,00
partielle). Endpoint : `POST /finances/paiements`. États : 422 trop-perçu refusé, 422
montant FIFO > dû total (« l'avance n'est pas encore supportée »). Si paiement complet :
la **quittance est générée automatiquement** — l'afficher (lien D5).

**D5. Quittance** — `/finances/quittances/{id}`
Numéro, lot, montant, date — mise en page « document officiel » (valeur fiscale, conservée
10 ans). Endpoint : `GET /finances/quittances/{id}`.

**D6. Contestations** — `/finances/contestations`
Résident (depuis son solde, C2/B2) : contester une ligne avec motif → « le montant reste dû
pendant la contestation » (mention légale à afficher). Syndic : liste des contestations
ouvertes, répondre (statut OUVERTE → REPONDUE). Endpoints : `POST /finances/contestations`,
`POST /finances/contestations/{id}/reponse`.

**D7. Paiement en ligne (CMI)** — NE PAS designer de parcours fonctionnel : prévoir
seulement l'emplacement « Payer en ligne — bientôt disponible » (désactivé) sur le solde
résident. Le backend existe mais est volontairement inactif.

### Zone E — Assemblées générales (le module le plus riche)

**E1. Liste des AG** — `/ag`
Cartes/liste : type (ORDINAIRE/EXTRAORDINAIRE/REVOCATION), date, statut (cycle complet en
badge), quorum atteint. Action syndic : « Créer une AG ». Endpoint : `GET /ag`.

**E2. Créer une AG** — `/ag/nouvelle` (syndic)
Date de l'AG, type, puis ajout des **résolutions** (ordre, texte, type de majorité
SIMPLE/DOUBLE/UNANIMITE — avec aide contextuelle : « double majorité = majorité en nombre
ET en tantièmes »). Endpoints : `POST /ag`, `POST /ag/{id}/resolutions`.

**E3. Détail AG** — `/ag/{id}` — la page change selon le statut :
- **PLANIFIEE** (syndic) : éditer les résolutions, bouton **« Convoquer »** →
  `POST /ag/{id}/convoquer`. ⚠️ État gaté légal (§6.3) : 422 si le délai de convocation
  n'est pas configuré, ou si la date est trop proche — bannière + lien Paramètres.
  Bouton « Annuler l'AG » (motif obligatoire).
- **CONVOQUEE** : compte à rebours, liste des résolutions, **mes procurations** (E4),
  bouton syndic « Ouvrir la séance » (422 gaté si quorum non configuré).
- **EN_COURS** : → E5 (séance live).
- **CLOTUREE** : résultats par résolution (ADOPTEE/REJETEE avec agrégats), quorum, lien PV.
- **ANNULEE** : motif affiché.

**E4. Procurations** — section de E3 (statut CONVOQUEE)
Donner procuration : choisir le mandataire (un autre copropriétaire) — cas d'usage clé du
MRE. Révoquer avant l'ouverture. Endpoints : `POST /ag/{id}/procurations`,
`POST /ag/{id}/procurations/{procurationId}/revoquer`. États : 422 limite de procurations
par mandataire atteinte, 422 gaté légal si la limite n'est pas configurée.

**E5. Séance live (AG EN_COURS)** — l'écran le plus scénarisé du produit
- **Vue votant** (copropriétaire présent ou mandataire) : résolution active en grand
  (VoteCard), trois boutons POUR / CONTRE / ABSTENTION, confirmation, puis « vote
  enregistré » (un vote est immuable — le dire). Résolutions suivantes/précédentes.
  États : 422 « un indivisaire dont le lot a un impayé ne peut pas voter », 409 déjà voté,
  vote via procuration = choisir pour quel mandant on vote.
- **Vue syndic (pupitre de séance)** : par résolution — résultats agrégés en temps réel
  (tantièmes pour/contre/abstention, jauge), bouton **« Finaliser la résolution »**
  (calcule ADOPTEE/REJETEE — rappeler la règle : égalité parfaite = REJETÉE), puis
  **« Clôturer l'AG »** (ConfirmDialog : génère le PV, irréversible ; 422 si des
  résolutions restent en attente).
Endpoints : `POST /ag/{id}/votes`, `GET /ag/{id}/resolutions/{rid}/resultats` (agrégé),
`POST /ag/{id}/resolutions/{rid}/finaliser`, `POST /ag/{id}/cloturer`.

**E6. Détail nominatif des votes** — `/ag/{id}/resolutions/{rid}/votes` (SYNDIC UNIQUEMENT)
Table nominative (qui a voté quoi, tantièmes, procuration éventuelle). Bandeau explicite :
« Détail réservé au syndic à des fins d'audit — les résidents ne voient que les agrégats ».
Endpoint : `GET /ag/{id}/resolutions/{rid}/votes`.

**E7. Procès-verbal** — `/ag/{id}/pv`
Document : résolutions + résultats + quorum, **hash d'intégrité SHA-256 affiché**
(élément de confiance : « ce PV est infalsifiable »), téléchargement PDF.
Endpoint : `GET /ag/{id}/pv`. Accessible aux copropriétaires (+ locataires si option).

### Zone F — Incidents & prestataires

**F1. Liste des incidents** — `/incidents`
DataTable/cartes : catégorie (icône), sous-catégorie, urgence (badge 3 niveaux), statut,
partie (commune/privative), **SLA** (échéance, en rouge si dépassée), assigné à. Filtres.
Résident : « mes signalements ». Prestataire : « mes tickets assignés » (son unique vue).
Endpoint : `GET /incidents`.

**F2. Signaler un incident** — `/incidents/nouveau` (tous les rôles résidents + gardien)
Formulaire guidé : catégorie (11 choix illustrés), sous-catégorie, partie COMMUNE ou
PRIVATIVE (aide : « la colonne montante est commune, votre robinetterie est privative »),
urgence (avec garde-fou : URGENCE_MAXIMALE notifie tout le monde), description, lot
concerné (optionnel). Endpoint : `POST /incidents`.

**F3. Détail incident** — `/incidents/{id}`
En-tête (statuts, SLA) + **timeline** du journal (changements de statut horodatés avec
acteur et commentaire — c'est l'`incident_log` append-only). Actions selon rôle :
syndic — assigner un prestataire (`POST /incidents/{id}/assign`), changer le statut ;
prestataire assigné / gardien — changer le statut avec commentaire
(`PATCH /incidents/{id}/statut`). Le créateur reçoit une notification à chaque changement.

**F4. Prestataires** — `/prestataires` (syndic)
Liste (nom, spécialité, contact, actif) + création. Endpoints : `GET/POST /prestataires`.

### Zone G — Espaces communs & réservations

**G1. Espaces communs** — `/espaces-communs`
Cartes : nom, type (salle, piscine, terrain…), capacité, réservable, mode de validation
(auto/manuelle). Action syndic : créer un espace. Endpoints : `GET/POST /espaces-communs`.

**G2. Réserver** — depuis G1
Sélection date/heure début-fin — la **détection de conflit** est côté serveur (409/422 si
créneau pris : proposer de choisir un autre créneau). Selon l'espace : confirmation
immédiate (mode auto) ou « en attente de validation du syndic ». Endpoint :
`POST /reservations`.

**G3. Réservations** — `/reservations`
Résident : mes réservations (statut, annuler — `PATCH /reservations/{id}`).
Syndic : file des `EN_ATTENTE` avec **Valider** / **Rejeter avec motif**
(`POST /reservations/{id}/valider`, `POST /reservations/{id}/rejeter`) + vue planning
globale par espace.

### Zone H — Personnel & visites

**H1. Personnel** — `/personnel` (syndic)
Fiches gardien : statut (PRESENT/ABSENT/REMPLACE — l'absence déclenche une alerte),
logement de service (loge). Actions : créer une fiche, changer le statut.
Endpoints : `GET/POST /personnel`, `PATCH /personnel/{id}/statut`.

**H2. Visites — côté gardien** — `/visites` (surtout mobile, voir §8)
Action primaire énorme : **« Enregistrer un visiteur »** (nom du visiteur + lot visité) →
le résident reçoit un push. Liste des visites du jour avec statut (EN_ATTENTE pulsant /
AUTORISE vert / REFUSE rouge). Endpoints : `GET/POST /visites`.

**H3. Visites — côté résident** — notification + écran de réponse
« {Nom} demande l'accès à votre lot » → boutons **Autoriser** / **Refuser** (une seule
réponse possible). Endpoint : `PATCH /visites/{id}/statut`. Historique de mes visites.

### Zone I — Documents, notifications, litiges

**I1. Documents** — `/documents`
Liste filtrée par la visibilité (le serveur filtre : un propriétaire ne voit que
`PUBLIC_COPROPRIETE`) : type (règlement intérieur, PV, contrat, rapport…), nom, date.
Téléchargement = URL signée **valable 15 minutes** (générer au clic, ne pas la stocker).
Syndic : upload avec choix de visibilité (public / syndic seul / conseil syndical — expliquer
chaque niveau). Endpoints : `GET/POST /documents`, `GET /documents/{id}/download-url`.

**I2. Centre de notifications** — `/notifications` + panneau cloche dans l'en-tête
Liste personnelle : template (titre/corps rendus dans MA langue), canal, lu/non-lu,
horodatage. Marquer lu (`PATCH /notifications/{id}/read`). Badge compteur non-lus.

**I3. Litiges** — `/litiges`
Résident : déclarer un litige (type, description), suivre les siens. Syndic/conseil : tous
les litiges, **escalader** (stepper visuel 3 niveaux : 0 traitement syndic → 1 médiation AG
→ 2 tribunal, avec ConfirmDialog à chaque montée), clôturer (RESOLU/CLOS).
Endpoints : `GET/POST /litiges`, `PATCH /litiges/{id}/escalade`, `PATCH /litiges/{id}/statut`.

### Zone J — Profil, CNDP & administration

**J1. Mon profil** — `/profil`
Nom, prénom, **langue (FR/AR — change toute l'interface, y compris le sens de lecture)**.
Email/téléphone affichés non modifiables (« identifiants de connexion »). Mes rôles et
copropriétés. Endpoints : `GET/PATCH /users/me`.

**J2. Mes données (CNDP)** — `/profil/donnees`
Pédagogie Loi 09-08 : « Télécharger toutes mes données » (export JSON —
`GET /users/me/export`) ; texte sur la conservation (données financières 10 ans).

**J3. Fiche membre** — `/membres/{id}` (syndic)
Profil d'un membre de la copropriété, ses rôles/lots. **Zone danger** : « Anonymiser ce
compte (CNDP) » — uniquement si DESACTIVE, double confirmation, texte : « les nom, email et
téléphone seront effacés définitivement ; l'historique financier et les votes sont
conservés (obligation légale) ». Endpoints : `GET /users/{id}`, `POST /users/{id}/anonymize`
(422 si le compte n'est pas DESACTIVE).

**J4. Invitations** — `/invitations` (syndic)
Liste (rôle cible, lot, canal, statut, expiration) + **créer** : rôle (un PROPRIETAIRE exige
un lot ; un GARDIEN non), canal (EMAIL/SMS/QR/WhatsApp), lot. Résultat : **le code à 8
caractères + un QR code à afficher/imprimer** (le backend n'envoie pas encore les
invitations lui-même — le syndic transmet le code). Régénérer une invitation expirée.
Endpoints : `GET/POST /invitations`, `POST /invitations/{id}/regenerer`.

**J5. Paramètres de la copropriété** — `/parametres` (syndic)
Sections :
- **Identité** : nom, adresse, ville, type de résidence, nombre de lots ;
- **Règlement** : total des tantièmes (avec explication : « la somme des tantièmes des lots
  ne pourra pas dépasser ce total ») ;
- **Options** (config_json) : « les locataires voient les PV », « réservations réservées aux
  propriétaires », etc. (interrupteurs) ;
- **Recouvrement** : délais d'escalade des impayés (défauts J+3/15/30/45/60/90, surcharge) ;
- **⚠️ Paramètres légaux** — section visuellement distincte avec bannière permanente :
  « Ces valeurs doivent être confirmées par un conseil juridique avant d'être saisies »
  (délai de convocation d'AG en jours, quorum de 1re convocation, limite de procurations par
  mandataire, rétention avant anonymisation CNDP en mois). Vides par défaut ; tant qu'elles
  sont vides, les fonctions AG correspondantes affichent l'état gaté (§6.3).
Endpoints : `GET /coproprietes/{id}`, `PATCH /coproprietes/{id}`, `GET /coproprietes/{id}/config`.

**J6. Créer une copropriété** — `/admin/coproprietes/nouvelle` (super admin)
Nom, adresse, ville, type de résidence, nombre de lots ; à la création, proposer d'inviter
le premier syndic. Endpoint : `POST /coproprietes`.

---

## 8. Application mobile (Flutter) — pages spécifiques

Le mobile reprend **toutes** les fonctionnalités résident/gardien ci-dessus (parité
obligatoire, registre `docs/PARITE_WEB_MOBILE.md`), en navigation par onglets. Différences
à designer spécifiquement :

1. **Module gardien avec mode hors-ligne** (la loge est parfois mal couverte) :
   l'enregistrement d'une visite fonctionne SANS réseau — indicateur d'état de
   synchronisation (« en attente d'envoi » / « synchronisé »), file visible des visites non
   envoyées. Le backend est prêt (Idempotency-Key par visite : un retry ne double jamais).
2. **Notifications push** (FCM) : autorisation, deep-links (visite → écran de réponse H3,
   incident → F3, AG → E3, appel de fonds → solde).
3. **Vote AG sur mobile** : l'écran E5 « vue votant » est prioritairement mobile (les
   copropriétaires votent depuis leur téléphone en séance).
4. **Onboarding par QR** : scanner le QR d'invitation (A3) via la caméra.
5. Les modules finances/AG n'ont **pas** de mode hors-ligne (volontaire).

---

## 9. À NE PAS designer comme fonctionnel (limites assumées du backend)

| Sujet | État | Traitement UI |
|---|---|---|
| Paiement en ligne CMI | Backend prêt mais **désactivé volontairement** | Bouton « bientôt disponible » désactivé (D7) |
| Avance / avoir (payer plus que le dû en FIFO) | Non supporté (422 explicite) | Message d'erreur propre, pas de champ « avance » |
| Caution et réservations récurrentes | Non supporté | Ne pas prévoir ces champs |
| Succession (décès d'un propriétaire) | Modèle en base, pas d'endpoints | Aucune page |
| 2e convocation d'AG automatique (quorum non atteint) | Manuel | Le syndic recrée une AG — prévoir juste un raccourci « recréer » |
| PV en arabe | PDF FR uniquement pour l'instant | L'UI autour reste FR/AR |
| Envoi automatique des invitations | Le code est retourné à l'écran | J4 : parcours « transmettre le code » (copier, QR, partager) |
| WhatsApp | Canal listé mais transport inactif | Sélectionnable, envoi manuel comme le reste |

---

## 10. Parcours clés à scénariser (user flows prioritaires)

1. **Onboarding résident** : reçoit un code/QR → A3 → A1/A2 (OTP) → compte lié au lot → B2.
2. **Cycle financier syndic** : D1 créer + activer budget → D2 générer l'appel de fonds →
   (les propriétaires sont notifiés) → D4 encaisser les paiements → quittance auto D5 →
   les impayés s'escaladent automatiquement (badges N1→N6 sur D3).
3. **Cycle AG complet** : E2 créer + résolutions → E3 convoquer (état gaté si paramètre
   légal manquant → J5) → E4 procurations (MRE) → E5 séance live (votes → finaliser →
   clôturer) → E7 PV distribué.
4. **Incident urgent** : F2 signalement URGENCE_MAXIMALE → push massif → F3 assignation
   prestataire → le prestataire (vue minimale) met à jour → le créateur suit la timeline.
5. **Visite** : H2 le gardien enregistre (même hors-ligne) → push résident → H3 répond →
   le gardien voit la réponse.

---

## 11. Référence rapide — les 82 opérations d'API

```
Auth          POST /auth/otp/request · /auth/otp/verify · /auth/login · /auth/refresh · /auth/invite/accept
Invitations   GET|POST /invitations · POST /invitations/{id}/regenerer
Copropriétés  GET|POST /coproprietes · GET|PATCH /coproprietes/{id} · GET /coproprietes/{id}/config
Lots          GET|POST /lots · GET|PATCH /lots/{id} · POST /lots/{id}/proprietaires ·
              POST /lots/{id}/occupants · POST /lots/{id}/transfert-propriete
Utilisateurs  GET|PATCH /users/me · GET /users/me/export · GET /users/{id} · POST /users/{id}/anonymize
Finances      GET|POST /finances/budgets · GET|PATCH /finances/budgets/{id} · POST /finances/budgets/{id}/activer ·
              GET|POST /finances/appels-de-fonds · GET /finances/lots/{id}/solde · POST /finances/paiements ·
              POST /finances/paiements/cmi/initier · POST /finances/paiements/cmi/webhook (machine) ·
              GET /finances/quittances/{id} · POST /finances/contestations · POST /finances/contestations/{id}/reponse
AG            GET|POST /ag · GET /ag/{id} · POST /ag/{id}/convoquer|ouvrir|annuler|cloturer ·
              POST /ag/{id}/resolutions · POST /ag/{id}/resolutions/{rid}/finaliser ·
              GET /ag/{id}/resolutions/{rid}/resultats (agrégé) · GET /ag/{id}/resolutions/{rid}/votes (syndic) ·
              POST /ag/{id}/procurations · POST /ag/{id}/procurations/{pid}/revoquer ·
              POST /ag/{id}/votes · GET /ag/{id}/pv
Incidents     GET|POST /incidents · PATCH /incidents/{id}/statut · POST /incidents/{id}/assign · GET|POST /prestataires
Personnel     GET|POST /personnel · PATCH /personnel/{id}/statut · GET|POST /visites · PATCH /visites/{id}/statut
Espaces       GET|POST /espaces-communs · GET|POST /reservations · PATCH /reservations/{id} ·
              POST /reservations/{id}/valider|rejeter
Documents     GET|POST /documents · GET /documents/{id}/download-url
Notifications GET /notifications · PATCH /notifications/{id}/read
Litiges       GET|POST /litiges · PATCH /litiges/{id}/escalade · PATCH /litiges/{id}/statut
```

Le contrat complet (schémas de requête/réponse exacts) est dans
`packages/api-contract/openapi.yaml` — c'est la source de vérité, 100 % conforme au code.

---

## 12. Récapitulatif des livrables attendus du design

- **Web** : ~55 écrans (zones A à J) — desktop d'abord pour le back-office syndic
  (B1, C, D, E-pupitre, F, G3, H1, I, J), responsive pour tout le reste.
- **Mobile** : parcours résident complet + module gardien hors-ligne + vote AG en séance.
- **Chaque écran en FR ET en AR (RTL)** — au minimum, valider les écrans structurants
  (dashboard, solde, séance de vote, visites) dans les deux sens.
- **Le système de badges de statut** (§6) décliné pour toutes les entités.
- **Les 3 états transverses** : vide / chargement / erreur, plus l'état **gaté légal**
  (§6.3) sur les écrans AG et Paramètres.
