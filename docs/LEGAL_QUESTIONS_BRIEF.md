# Brief juridique — paramètres à confirmer avant mise en production

**Statut : brouillon de travail, à faire valider par un avocat marocain spécialisé en droit de la
copropriété (Loi 18-00/106-12/30-24) et en protection des données (Loi 09-08 / CNDP) avant tout
codage en dur de ces valeurs.**

---

## ⚠️ Valeurs PROVISOIRES en vigueur (décision du propriétaire du projet, 27/08/2026)

Le propriétaire du projet a explicitement demandé le 27/08/2026 de rendre le module AG
opérationnel avec des valeurs raisonnables issues des sources convergentes de ce brief, **en
attendant** la validation par l'avocat (qui reste requise avant l'ouverture publique).

Ces valeurs ne sont PAS codées en dur : elles sont saisies comme **configuration de
copropriété** (PATCH /coproprietes/{id}, tracé en audit_log `COPROPRIETE_MODIFIEE`) et posées
par le seed local — modifiables à tout moment dans Paramètres → Paramètres légaux (page J5),
et remises à « non configuré » (null) si l'avocat infirme.

| Paramètre | Valeur provisoire | Source indicative (§ ci-dessous) |
|---|---|---|
| `delai_convocation_jours` | **15** | §1 — art. 22 (ou 16) Loi 18-00, sources convergentes |
| `quorum_premiere_convocation` | **0.5** | §2 — art. 18, moitié des voix (guide institutionnel) |
| `limite_procurations_mandataire` | **3** | §4 — maximum 3 mandants par mandataire |
| `retention_desactivation_mois` | **24** | §5 — « durée légale + 2 ans », base prudente 24 mois |
| `regime_lcd` (M15) | **NON_DEFINI** (rien de déclarable tant que non fixé) | §7 — Doc A §10.2, régime voté en AG |
| Rétention données voyageur (M15) | **= `retention_desactivation_mois`** | §7.3 — valeur propre aux séjours à confirmer |
| `seuil_approbation_conseil` (M16) | **5 000 MAD** (seed Al Amal ; NULL = approbation syndic explicite sur tout, rapports « seuil non configuré ») | §8.1 — Doc A §8.3 « seuil configurable (ex : 5000 DH) » |
| `reserve_sans_resolution_autorisee` (M16) | **false** | §8.2 — Doc A §3.6 « décision AG requise sauf urgence définie dans le règlement » |
| `tva_par_defaut` (M16) | **20 %** (pré-remplissage seulement, le TTC saisi fait foi) | §8.3 — taux normal de TVA marocain, à confirmer par poste |
| `delai_validation_justificatif_jours` (M17) | **5 jours** (seed ; NULL = aucun rappel) | §8.5 — délai de traitement d'un justificatif par le syndic |
| `majorite_approbation_comptes` (M18) | **NULL** — fournie à la soumission ou configurée par le syndic ; SIMPLE dans le seed uniquement | PROVISOIRE (§9.1) |
| `factures_visibles_residents` (M18) | **false** — activée par le syndic (true dans le seed) | PROVISOIRE (§9.3) |
| `seuil_contrat_ag` (M19) | **NULL** — configuré par le syndic ; 20 000 MAD dans le seed uniquement | PROVISOIRE (§10.2) |

**À faire au retour de l'avocat** : confirmer ou corriger chaque valeur ici même (référence
d'article + date), puis ajuster la configuration des copropriétés concernées. La déclaration
CNDP (§6) et la question Loi 30-24 (§0) restent des préalables à l'ouverture publique.

Ce document existe parce que le Master Engineering Spec (Partie 8.2, 8.3, 8.5, 5.6, 19.6) refuse
explicitement de coder en dur des valeurs légales non confirmées — c'est la bonne approche. Ce
brief rassemble, pour chaque valeur en attente, ce que des sources secondaires publiques
(cabinets, éditeurs de logiciels syndic, un guide institutionnel) indiquent, **à titre indicatif
uniquement**. Aucune de ces valeurs ne doit être codée avant confirmation. Ceci n'est pas un avis
juridique.

---

## 0. Point d'attention prioritaire : la réforme Loi 30-24 (9 juillet 2024)

**Ni le Master Spec ni Doc A ne mentionnent la Loi 30-24**, qui modifie la Loi 18-00 et a été
adoptée à l'unanimité le 9 juillet 2024. D'après plusieurs sources publiques, elle introduirait
notamment :

- Une **conciliation préalable obligatoire** avant certains litiges — non modélisée aujourd'hui
  dans la table `conflit_litige` (Master Spec Partie 2.2) ni dans Doc A §12.1.
- La possibilité pour **un ou plusieurs copropriétaires de convoquer eux-mêmes une AG**, sans
  passer par le syndic (cas probable : syndic défaillant ou absent) — alors que l'API actuelle
  modélise `POST /ag` comme **syndic-only** (Master Spec Partie 3.2, 4.2).
- Un délai de notification des décisions d'AG sous **8 jours** après la prise de décision.

**Questions à poser à l'avocat :**
1. Le texte intégral de la Loi 30-24 est-il disponible et confirmé ? Quelles sont ses dispositions
   exactes sur (a) la conciliation préalable, (b) la convocation d'AG par les copropriétaires,
   (c) les délais de notification ?
2. Ces dispositions changent-elles le modèle de permissions de l'AG (qui a le droit de créer/
   convoquer une AG) et le workflow de litiges (faut-il une étape de conciliation avant escalade) ?
3. Le Master Spec et Doc A doivent-ils être mis à jour en conséquence avant que le module AG et le
   module litiges ne soient construits ?

Ce point est signalé en premier parce que — contrairement aux autres valeurs de ce brief qui sont
des paramètres de configuration — une réponse positive ici change potentiellement la structure de
permissions et de tables, pas seulement une valeur.

---

## 1. Délai de convocation AG (`copropriete.delai_convocation_jours`)

**Master Spec Partie 8.2** : paramètre configurable, valeur non fixée dans le document.

**Indication trouvée (convergente sur plusieurs sources marocaines)** : 15 jours minimum entre
l'envoi de la convocation et la date de l'AG, article 22 (parfois cité article 16) de la Loi 18-00,
envoi par lettre recommandée avec accusé de réception ou remise en main propre contre décharge.

**À confirmer :** ce délai est-il inchangé par la Loi 30-24 ? Le mode d'envoi (recommandé papier)
est-il compatible avec un envoi 100% dématérialisé (email/SMS/push), ou la plateforme doit-elle
prévoir un mode d'envoi postal en parallèle pour rester opposable juridiquement ?

## 2. Quorum de tenue de l'AG (`ag_resolution` / `assemblee_generale.quorum_requis`)

**Master Spec Partie 8.3** : quorum requis dépend du type d'AG et de la résolution, à confirmer et
stocker par type de résolution.

**Indication trouvée** (guide institutionnel « Direction de la Promotion Immobilière ») : quorum
fixé à la moitié des voix des copropriétaires (article 18). Si non atteint, une deuxième réunion
se tient sous 30 jours et délibère sans condition de quorum, décisions prises à la majorité des
voix des présents/représentés.

**À confirmer :** ce mécanisme de première/deuxième convocation doit être modélisé explicitement
dans la machine à états de l'AG (Master Spec Partie 8.1) — actuellement `PLANIFIEE → CONVOQUEE →
EN_COURS → CLOTUREE` ne prévoit pas d'état intermédiaire pour un quorum non atteint suivi d'une
deuxième convocation. À valider avec l'avocat avant de figer le schéma `assemblee_generale`.

## 3. Grille des majorités par type de décision

**Master Spec Partie 8.4** donne la mécanique de calcul (simple/double/unanimité/égalité) mais pas
la table de correspondance décision → type de majorité requis.

**Indication trouvée — attention, les sources se contredisent** : certaines indiquent majorité
simple pour l'élection du syndic, d'autres indiquent 3/4 pour la nomination/révocation du syndic
et pour les travaux d'amélioration, d'autres encore indiquent double majorité pour les mêmes
travaux. L'unanimité reviendrait de façon assez constante pour la modification des tantièmes ou de
la destination de l'immeuble.

**À confirmer :** la grille complète décision → majorité requise, résolution par résolution — ne
pas trancher par recoupement de blogs, c'est exactement le cas où les sources divergent le plus.

## 4. Procuration (vote par mandataire)

**Master Spec Partie 8.5** : limite de procurations par mandataire à confirmer.

**Indication trouvée :** maximum 3 copropriétaires représentés par un même mandataire ; une source
(forum spécialisé, fiabilité moindre) ajoute un plafond de 10 % du total des voix cumulées
représentées par un même mandataire.

**À confirmer :** le chiffre de 3 et l'éventuel plafond de 10 % — et si la Loi 30-24 les modifie.

## 5. Durée de rétention CNDP avant anonymisation (Loi 09-08)

**Master Spec Partie 5.6 / 10.1** : anonymisation après « durée légale + 2 ans » — la durée légale
de base n'est pas chiffrée dans le document.

**À confirmer :** la durée légale de base pour chaque catégorie de donnée (identité, finances —
10 ans déjà retenu pour les quittances par obligation fiscale, historique de vote/PV) avant
d'appliquer le « + 2 ans ».

## 6. Déclaration préalable du traitement auprès de la CNDP — action manquante des deux documents

Distinct du job d'anonymisation déjà prévu (Partie 5.6) : la loi 09-08 impose une **déclaration
préalable du traitement lui-même** auprès de la CNDP (portail.cndp.ma, formulaire F211 ou F214
selon le type de traitement, récépissé sous 24h annoncé par la CNDP) avant la mise en œuvre de tout
traitement de données personnelles — donc avant l'ouverture publique de la plateforme, pas
seulement avant l'anonymisation des comptes désactivés.

**Action :** déterminer avec l'avocat si un traitement couvrant finances/identité/vote nécessite
une déclaration simple ou une autorisation préalable (régime renforcé pour données sensibles,
article 21), et lancer la démarche suffisamment tôt — elle est indépendante du calendrier de dev.

---

## 7. Location courte durée — régime, déclaration des voyageurs, données voyageur (module M15)

**Ni le Master Spec ni Doc A ne développent le sujet** au-delà de Doc A §10.2 (« Règlement
intérieur peut interdire la location courte durée (nuisances). À voter en AG. Paramètre
règlement : location_courte_duree = AUTORISEE / INTERDITE / ENCADREE. Si incident Airbnb =
signalement facilité »). Le module M15 implémente ce paramètre **sans coder aucune valeur
légale** : tout est configuration de copropriété (`copropriete.regime_lcd`,
`copropriete.parametres_lcd_json`, `PUT /lcd/reglement`, audit `LCD_REGLEMENT_MODIFIE`),
nullable, 422 explicite tant que non configuré — même discipline que `delai_convocation_jours`.

| Paramètre | Valeur provisoire | Statut |
|---|---|---|
| `regime_lcd` | **NON_DEFINI** (aucune déclaration possible tant que l'AG / le syndic n'a pas fixé le régime) | PROVISOIRE |
| `parametres_lcd_json.*` (ENCADREE) | **aucune valeur par défaut** — le syndic saisit celles votées ; une limite `null` n'est pas appliquée | PROVISOIRE |
| Rétention des données voyageur | **= `retention_desactivation_mois`** de la copropriété (§5), comptée depuis la date de départ ; copropriété non configurée = séjours jamais anonymisés automatiquement | PROVISOIRE |
| Données voyageur collectées | nom du voyageur principal, nombre, téléphone (opt.), nationalité (opt.), type de pièce + **4 derniers caractères** (opt.), plaque (opt.) — jamais de numéro complet ni de scan | PROVISOIRE (minimisation prudente) |

### 7.1 — Un règlement de copropriété peut-il interdire ou limiter la LCD ? (Loi 18-00, Loi 30-24)

**Indication trouvée** : Doc A §10.2 tient pour acquis qu'un règlement intérieur peut interdire
la LCD « à voter en AG ». Des sources secondaires évoquent la destination de l'immeuble
(habitation) et l'article 8/9 de la Loi 18-00 (règlement de copropriété, destination des parties
privatives), sans jurisprudence consolidée sur les locations meublées de courte durée.

**À confirmer :**
1. Le règlement de copropriété (ou intérieur) peut-il **interdire** purement la LCD, ou seulement
   l'**encadrer** (nuisances, sécurité) ? Avec quelle majorité d'AG (grille §3) la clause est-elle
   valablement adoptée / modifiée ? La Loi 30-24 change-t-elle ce point ?
2. La **suspension** d'une déclaration par le syndic après incidents répétés (décision manuelle,
   motif obligatoire — `POST /lcd/declarations/{id}/decision` SUSPENDUE) est-elle opposable au
   propriétaire sans décision d'AG ni conciliation préalable (§0, Loi 30-24) ?
3. Une **redevance LCD** (participation aux charges accrues : sécurité, nettoyage) est-elle licite
   si votée en AG ? Hors périmètre de cette version — le module ne modifie aucune ligne
   financière tant que ce point n'est pas confirmé (roadmap M15).

### 7.2 — Déclaration des voyageurs : obligation du propriétaire vs de la copropriété

**Indication trouvée** : l'obligation de déclaration des voyageurs (fiches de police /
plateforme dédiée des autorités) pèse en principe sur l'**hébergeur** (propriétaire ou
gestionnaire), pas sur la copropriété. La plateforme SyndicUp n'est **pas** ce canal de
déclaration officiel et ne prétend pas s'y substituer.

**À confirmer :**
1. La copropriété (syndic, gardien) a-t-elle une base légale pour **exiger** du propriétaire une
   déclaration préalable des séjours (`declaration_prealable_obligatoire`) et un délai
   (`delai_declaration_heures`) ? Ou seulement une **information** du gardien pour le contrôle
   d'accès (Doc A §9.2) ?
2. Le gardien peut-il légitimement **confirmer l'arrivée / le départ** et consigner un nombre de
   voyageurs constaté (`sejour_evenement`, append-only) ? Quelle valeur probante de ce journal en
   cas de litige ?

### 7.3 — CNDP : quelles données voyageur la copropriété peut-elle détenir, et combien de temps ?

**Indication trouvée** : Loi 09-08 — finalité, proportionnalité, durée limitée. Le voyageur n'est
pas membre de la copropriété ; la finalité retenue est la **sécurité de l'immeuble et la
gestion des nuisances**, pas l'identification administrative.

**À confirmer :**
1. Les données retenues (nom du voyageur principal, nombre, téléphone facultatif, nationalité
   facultative, type de pièce + 4 derniers caractères, plaque) sont-elles proportionnées à cette
   finalité ? Faut-il retirer la nationalité et/ou la pièce d'identité ?
2. Durée de conservation : la valeur provisoire réutilise `retention_desactivation_mois` (§5).
   Faut-il une durée **propre aux séjours**, probablement plus courte (ex. quelques mois après
   le départ) ? Le job `anonymisation-cndp-mensuelle` efface alors nom, téléphone, nationalité,
   pièce, plaque (les dates, le lot et le nombre restent pour les statistiques de quota).
3. Information du voyageur : qui l'informe du traitement (l'hébergeur ?) et la déclaration CNDP
   de la plateforme (§6) doit-elle mentionner cette catégorie de personnes ?
4. Le gestionnaire LCD (conciergerie) est-il un **sous-traitant** au sens de la loi 09-08 ?
   Conséquences contractuelles (le rôle `GESTIONNAIRE_LCD` lui donne accès aux séjours de ses
   lots uniquement).

---

## 8. Dépenses, approbation par le conseil syndical, fonds de réserve, TVA (module M16)

**Doc A §8.3** : « Toute dépense > seuil configurable (ex : 5000 DH) doit être liée à une résolution
AG ou classée comme urgence. Dépenses non liées = alerte conseil syndical » ; « Transparence : 3
devis obligatoires au-delà d'un seuil ». **Doc A §3.6** : « Utilisation fonds de réserve :
décision AG requise sauf urgence (définie dans le règlement) ». Le module M16 implémente ces règles
**sans coder aucune valeur** : trois paramètres de copropriété nullables (`PATCH /coproprietes/{id}`,
audité), 422 explicite ou approbation explicite tant que non configurés.

| Paramètre | Valeur provisoire | Statut |
|---|---|---|
| `seuil_approbation_conseil` | **NULL par défaut** (5 000 MAD posé par le seed de démonstration) — NULL = toute dépense soumise exige l'approbation explicite du syndic et les rapports signalent « seuil non configuré » | PROVISOIRE |
| `reserve_sans_resolution_autorisee` | **false** — un décaissement de la réserve exige une résolution d'AG ADOPTEE (`DEPENSE_RESERVE_RESOLUTION_REQUISE`) | PROVISOIRE |
| `tva_par_defaut` | **NULL par défaut** (20 posé par le seed) — simple pré-remplissage du formulaire, le TTC saisi depuis la facture fait foi | PROVISOIRE |

### 8.1 — Le seuil d'approbation du conseil est-il légal, et qui le fixe ?

**Indication trouvée** : Doc A §8.3 parle d'un seuil « configurable » avec 5 000 DH en exemple,
sans base légale citée. La Loi 18-00 confie au conseil syndical un rôle d'assistance et de
contrôle du syndic (art. 31 et suivants selon les sources) sans montant chiffré.

**À confirmer :**
1. Le règlement de copropriété ou l'AG peuvent-ils fixer un seuil au-delà duquel le syndic ne peut
   engager une dépense sans l'aval du conseil syndical ? Ce seuil doit-il être voté (résolution
   liée) ou peut-il être une simple décision de gestion ?
2. Une dépense au-dessus du seuil approuvée par le conseil mais **non votée en AG** (travaux non
   prévus au budget) engage-t-elle la responsabilité personnelle du syndic ? Faut-il exiger une
   résolution d'AG au-delà d'un second seuil (`seuil_contrat_ag`, prévu M19) ?
3. La règle « 3 devis obligatoires au-delà d'un seuil » (Doc A §8.3) a-t-elle une base légale ou
   n'est-elle qu'une bonne pratique ? Le type de document `DEVIS` est déclaré, le comparatif n'est
   pas modélisé tant que ce point n'est pas tranché.

### 8.2 — Décaissement du fonds de réserve sans résolution d'AG

**Indication trouvée** : Doc A §3.6 admet une exception « urgence (définie dans le règlement) ».

**À confirmer :** la définition de l'urgence (sinistre, mise en sécurité…) et qui la constate
(syndic seul ? conseil ?). Tant que ce n'est pas tranché, `reserve_sans_resolution_autorisee`
reste `false` par défaut et toute activation est une décision de règlement tracée en audit.

### 8.3 — TVA et mentions fiscales des factures

**Indication trouvée** : taux normal de TVA 20 % au Maroc ; certains postes (eau, électricité,
prestations de services) relèvent de taux réduits ou d'exonérations selon la nature du fournisseur.

**À confirmer :** la copropriété (non assujettie en principe) doit-elle contrôler la ventilation
HT/TVA des factures reçues ? Le module ne fait qu'un contrôle arithmétique (HT + TVA = TTC) et un
pré-remplissage ; aucun taux n'est appliqué automatiquement.

### 8.5 — Justificatifs de paiement des résidents (module M17)

| Paramètre | Valeur provisoire | Statut |
|---|---|---|
| `delai_validation_justificatif_jours` | **NULL par défaut** (5 posé par le seed) — rappel au syndic tant qu'un justificatif attend | PROVISOIRE |

**À confirmer :** (1) la déclaration de paiement avec preuve téléversée (reçu de virement, photo de
chèque) a-t-elle une valeur probante vis-à-vis du syndic tant qu'elle n'est pas validée ? Le module
ne déduit rien du solde avant validation et suspend seulement l'escalade des impayés sur la ligne
couverte ; (2) conservation des preuves (données bancaires du résident : banque émettrice,
référence) — durée et base CNDP, aujourd'hui alignée sur la rétention des pièces financières ;
(3) espèces reçues par le gardien : la remise enregistrée dans l'application (horodatée, confirmée
par le syndic) vaut-elle reçu, ou un reçu papier reste-t-il obligatoire ?

### 8.4 — Approbation des comptes en AG et conservation des pièces

**À confirmer :** durée de conservation des factures et preuves de paiement (les quittances sont
déjà conservées 10 ans, Master Spec Partie 9) — le module ne supprime jamais une dépense PAYEE ni
sa preuve ; l'approbation annuelle des comptes est portée par le rapport de gestion (M18).

---

## 9. Rapport de gestion, approbation des comptes, transparence, exports (module M18)

| Paramètre | Valeur provisoire | Statut |
|---|---|---|
| `config_json.majorite_approbation_comptes` | **NULL par défaut** (SIMPLE posé par le seed de démonstration) — la soumission du rapport à l'AG exige la majorité dans le payload ou dans la config, sinon 422 `RAPPORT_PARAMETRE_NON_CONFIGURE` | PROVISOIRE |
| `copropriete.factures_visibles_residents` | **false par défaut** (true dans le seed) — les résidents voient la liste des dépenses payées, les factures seulement sur activation du syndic | PROVISOIRE |

### 9.1 — Majorité requise pour l'approbation des comptes annuels

**À confirmer :** la Loi 18-00 (art. 12 et s. sur les décisions de l'AG) fixe-t-elle une majorité
spécifique pour l'approbation des comptes du syndic, ou est-ce la majorité simple des voix des
copropriétaires présents ou représentés ? Le module crée la résolution « Approbation des comptes de
l'exercice N » via le moteur AG existant avec la majorité fournie ; aucune valeur n'est codée en dur.

### 9.2 — Contenu minimal et conservation du rapport de gestion

**À confirmer :** (1) le contenu minimal légal du compte rendu de gestion remis à l'AG (le module
fige trésorerie estimée, recouvrement, impayés, budget vs réalisé, dépenses, réserve, faits
marquants) ; (2) la durée de conservation du rapport approuvé et de son PDF — aujourd'hui alignée
sur les 10 ans des pièces financières (Master Spec Partie 9) ; (3) la valeur de la signature
électronique / du bloc de signatures (syndic, président du conseil) sur le PDF généré.

### 9.3 — Transparence et données personnelles (CNDP)

**À confirmer :** (1) un résident (locataire compris) peut-il connaître le NOMBRE de lots en retard
et le montant global des impayés de la copropriété (le module ne montre jamais quel lot ni combien
par lot) ; (2) l'exposition des factures fournisseurs aux résidents (nom du prestataire, montant)
relève-t-elle d'une décision du syndic, du conseil ou de l'AG ; (3) le journal `export_log`
(qui a extrait quelles données, quand) suffit-il à l'obligation de traçabilité des extractions
de données personnelles (annuaire des propriétaires : nom, contact, quote-part).

### 9.4 — « État daté » remis au notaire (Doc A §11)

**À confirmer :** le contenu exigé de l'état daté lors de la vente d'un lot (le relevé de charges
du module donne appels, paiements, déclarations en attente, solde de l'exercice et solde total dû)
et qui peut le délivrer (syndic ; le propriétaire du lot peut-il le produire lui-même ?).

## 10. Contrats prestataires, assurance de l'immeuble, engagement en AG (module M19)

| Paramètre | Valeur provisoire | Statut |
|---|---|---|
| `copropriete.seuil_contrat_ag` | **NULL par défaut** (20 000 MAD posé par le seed de démonstration) — au-dessus, l'activation d'un contrat exige une résolution d'AG ADOPTEE ; non configuré = aucun contrôle | PROVISOIRE |
| Alerte « assurance immeuble absente » | mensuelle, syndic + conseil, tant qu'aucun contrat ASSURANCE_IMMEUBLE n'est ACTIF et non échu | PROVISOIRE |

### 10.1 — L'assurance de l'immeuble est-elle obligatoire, et pour qui ?

**À confirmer :** la Loi 18-00 (et le règlement de copropriété type) impose-t-elle au syndicat une
assurance multirisque immeuble / responsabilité civile, avec quel contenu minimal de garanties ? Le
module traite l'absence d'assurance immeuble ACTIVE comme une alerte bloquante visuellement (bannière
rouge, notification mensuelle) sans empêcher aucune opération.

### 10.2 — Engagements contractuels soumis à l'AG

**À confirmer :** au-dessus de quel montant (ou pour quels types : gardiennage, syndic professionnel,
travaux) un contrat pluriannuel doit-il être voté en AG, et à quelle majorité ? Le module n'applique
le contrôle que si `seuil_contrat_ag` est renseigné par le syndic.

### 10.3 — Reconduction tacite et préavis

**À confirmer :** validité de la reconduction tacite des contrats de prestation (durée, information
préalable du conseil, préavis minimal de résiliation). Le module prolonge d'une période égale et
notifie le syndic ; le préavis est un paramètre libre par contrat.

## Comment utiliser ce document

1. Envoyer ce fichier tel quel à l'avocat, section par section.
2. Chaque réponse confirmée est reportée dans `packages/database/seed/legal-params.md` (ou
   directement en valeur de configuration `copropriete` / `ag_resolution` selon le Master Spec)
   **avec la référence de l'article de loi et la date de confirmation**, jamais comme un nombre nu.
3. Tant qu'une valeur n'est pas confirmée ici, le module correspondant (AG en particulier) ne doit
   pas être considéré comme prêt pour la production — le dev peut avancer sur la structure, pas sur
   la valeur figée en dur.
