# Import Excel et onboarding — une résidence en une heure

> Domaine dérivé de Doc A §11 (onboarding : chaque syndic démarre avec un tableur — lots,
> propriétaires, tantièmes, téléphones, et « qui doit quoi ») et Master Spec Partie 5.3 (l'invitation
> lie compte ↔ lot ↔ rôle). Sans reprise du **solde**, le premier appel de fonds est faux et la
> confiance est perdue le premier jour. Doc A ne décrit pas de mécanique d'import : ce fichier fixe
> le module M24 — il ne réécrit pas Doc A. Le solde d'ouverture, le compte fantôme et la
> démonstration sont des choix produit signalés (brief §15).

---

## 21.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Le fichier tel qu'il est | Le syndic n'a pas à reformater son tableur. | `POST /import` lit xlsx / csv côté serveur (`exceljs`, csv maison : `;` `,` tabulation, BOM), ignore lignes vides et lignes de titre, hérite la cellule fusionnée du n° de lot, détecte les colonnes par **synonymes FR / AR / EN** (« N° lot / Appartement / الشقة », « Tantièmes / Quote-part / millièmes », « Propriétaire / Nom », « Téléphone / GSM », « Solde / Reste à payer »), normalise téléphones (06 → +212), décimaux (« 1 250,50 », « 25/1000 »), dates (jj/mm/aaaa, série Excel). |
| Voir avant d'écrire | Aperçu validé ligne à ligne avant toute écriture. | `apercu_json` : 20 premières lignes projetées sur le mapping, erreurs (bloquantes pour la ligne) et avertissements ; avertissements globaux (doublons de lot, somme des tantièmes ≠ `copropriete.total_tantiemes`, téléphones invalides, même personne sur plusieurs lots, colonnes obligatoires non reconnues → statut `ANALYSE`). `PATCH /import/{id}/mapping` corrige et ré-analyse. |
| Jamais deux fois | Rejouer un fichier (corrigé) ne recrée rien. | Exécution par chunks de 50 (job Inngest `import-executer`, `?sync=1` en ligne), transactionnelle par chunk, **savepoint par ligne** (une ligne en erreur n'annule pas le chunk), idempotente par **empreinte de ligne** (`import_job_log.hash`, type + valeurs normalisées) et par clé naturelle (n° de lot, nom de prestataire, plaque, identifiant de badge, téléphone). Annulation entre deux chunks. |
| Pas de compte fantôme | Partie 5.3 : le compte naît de l'invitation. | Un propriétaire / employé inconnu devient une **invitation pré-remplie** (`invitation.pre_rempli_json` : nom, prénom, téléphone, e-mail, langue, lots [{ lot_id, quote_part, type_propriete }], poste…), une par personne (même téléphone = même personne, tous ses lots), **jamais envoyée seule**. `invitation_accepter` matérialise à l'acceptation : `utilisateur` (nom / prénom), `lot_proprietaire` / `lot_occupant` / `personnel`, `accepte_par_id`. Indivision : les quote-parts des co-indivisaires déjà rattachés sont normalisées à 100 % (contrainte Partie 2.4) et retrouvent leurs valeurs prévues quand le dernier accepte. Un membre déjà connu (téléphone / e-mail) est rattaché directement. |
| Envoi maîtrisé | Le syndic choisit quand et comment. | `POST /invitations/envoyer-en-masse` : SMS / EMAIL via les transports de notification, ou csv « nom, téléphone, e-mail, rôle, lot, code, lien, lien WhatsApp » pour un envoi manuel (aucun agrégateur) ; `envoyee_le` posé ; audit `INVITATIONS_ENVOI_MASSE`. |
| Le solde d'ouverture est une dette comme une autre | Doc A §3.4 : FIFO sur les charges les plus anciennes ; §3.3 escalade. | `solde_ouverture` (unique par lot) : un **dû** (> 0) est matérialisé comme ligne d'appel de fonds `SOLDE_OUVERTURE` (⚠️ valeur d'enum ajoutée) à la `date_reference` → première ligne du relevé, réglée en premier par le FIFO M17, escaladée par le job M5 ; un **avoir** (< 0) est déduit du solde affiché (`GET /finances/lots/{id}/solde` : `avoir_ouverture`, `solde_ouverture`). Jamais compté comme « premier appel envoyé ». |
| Démarrer guidé | Le syndic sait ce qu'il lui reste à faire. | `GET /coproprietes/{id}/onboarding` calculé depuis les données : résidence créée → lots importés → tantièmes cohérents → propriétaires invités → % acceptés (≥ 50 %) → budget actif → premier appel envoyé → RIB saisi → assurance saisie → gardien créé. Carte « Démarrage » (web / mobile) tant que `complet = false`. |
| Démonstration jetable | Un prospect clique partout sans polluer. | `POST /coproprietes/{id}/demo` (SUPER_ADMIN) : copropriété `est_demo` inspirée du seed Al Amal (lots, budget, appel, paiement, incidents, annonce, emplacements, assurance) + code d'invitation SYNDIC ; exclue des exports / rapports transverses ; purgée par `demo-purge-quotidien` après `demo_expire_le` (30 jours). |
| Qui voit quoi | Doc A §12. | RLS `import_job` / `import_job_log` (append-only) / `solde_ouverture` : syndic écrit, conseil lit ; le fichier source est un `document` `IMPORT_SOURCE` **SYNDIC_ONLY** (téléphones, soldes). Un import de la copropriété A ne peut rien créer dans B, même avec un id forgé (contexte tenant + RLS). |

## 21.1 — Types d'import et champs

| Type | Champs (obligatoires en gras) | Effets |
| --- | --- | --- |
| `LOTS_PROPRIETAIRES` | **numero**, **tantiemes**, type_lot, etage, batiment, superficie, nom, prenom, telephone, email, quote_part, type_propriete, langue | lot créé / mis à jour (tantièmes, étage, bâtiment) ; propriétaire connu rattaché ; inconnu → invitation pré-remplie PROPRIETAIRE / INDIVISAIRE (quote-part < 100). |
| `SOLDES_OUVERTURE` | **numero**, **montant**, date_reference, commentaire | `solde_ouverture` + ligne d'appel `SOLDE_OUVERTURE` (dû) ; avoir déduit ; une ligne déjà réglée ne se modifie plus. |
| `PRESTATAIRES` | **nom**, specialite, telephone, email, ice, rc, adresse, notes | créé, ou complété (champs vides) s'il existe (nom insensible à la casse). |
| `CONTRATS` | **libelle**, **type**, **date_debut**, prestataire, date_fin, periodicite, montant_periode, reference, tacite, notes | contrat ACTIF (EXPIRE si fin passée) + journal ; prestataire créé à la volée ; doublon (libellé + début) ignoré. |
| `VEHICULES_BADGES` | **numero**, immatriculation, marque, couleur, type_vehicule, badge_type, badge_identifiant, caution | véhicule (plaque normalisée, unique) et / ou badge (unique par type). |
| `PERSONNEL` | **nom**, **telephone**, prenom, email, poste, date_embauche, salaire_brut_mensuel, numero_cnss | gardien connu → fiche `personnel` ; inconnu → invitation GARDIEN pré-remplie (fiche créée à l'acceptation). |

Modèles xlsx FR / AR : `GET /import/modeles/{type}?langue=fr|ar`. Rapport ligne à ligne :
`GET /import/{id}/rapport.csv`. Cycle : `TELEVERSE → ANALYSE | PRET → EN_COURS → TERMINE | ECHOUE | ANNULE`.

## 21.2 — Jobs et notifications

| Job | Déclencheur | Effets | Idempotence |
| --- | --- | --- | --- |
| `import-executer` | événement `import/executer` | chunks de 50, progression `nb_traitees`, `TERMINE` / `ECHOUE`, `IMPORT_TERMINE` au lanceur. | empreintes de ligne ; retries Inngest sûrs. |
| `demo-purge-quotidien` | 03:30 | supprime les copropriétés `est_demo` expirées (ordre des dépendances). | une démo = une transaction ; erreur journalisée, jamais bloquante. |

Notifications FR/AR : `IMPORT_TERMINE` (deep-link fiche import web / tableau de bord mobile),
`INVITATION_ENVOI` (message d'invitation avec lien, rendu pour SMS / e-mail / WhatsApp).

## 21.3 — Liens avec les autres modules

- **M2 Onboarding** : `invitation` étendue (pré-remplie, envoyée, acceptée par, import) ; RPC `invitation_accepter`.
- **M3 Lots** : lots / propriétaires / occupants ; trigger quote-parts respecté (normalisation).
- **M5 / M17 Finances** : ligne `SOLDE_OUVERTURE`, FIFO, escalade, solde et relevé du lot.
- **M16 / M19** : prestataires et contrats importés (BROUILLON ⇒ ACTIF direct, tracé).
- **M20 Personnel** : fiche créée à l'acceptation de l'invitation GARDIEN pré-remplie.
- **M23 Parkings** : véhicules et badges importés.
- **M25 Cabinet** : la démo et l'onboarding servent la prise en main d'une nouvelle résidence du portefeuille.
