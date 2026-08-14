# Doc A — Taxonomie des Lots & Types de Propriété

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s1`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2 (lot), Partie 17 §1.

---

## Taxonomie des Lots & Types de Propriété

**Principe fondamental**
Dans la plateforme, un "lot" est toute fraction de copropriété dotée d'un titre foncier propre (numéro de lot, tantièmes). Certaines fractions n'ont PAS de titre propre et sont considérées "parties communes" gérées collectivement. La distinction est critique pour la gestion des charges et des droits.

### 1.1 — Appartements

| Type | Description | Tantièmes | Charges spécifiques | Cas plateforme |
| --- | --- | --- | --- | --- |
| Appartement standard | Logement dans immeuble collectif. Usage habitation. | Calculés sur surface + étage + exposition | Charges communes générales | Cas de base. Propriétaire ou locataire. |
| Appartement duplex | S'étend sur 2 étages. Souvent 1 titre foncier. | Surface totale des 2 niveaux | Identique à standard. Escalier interne = partie privative. | 1 lot = 2 étages. Numéro lot unique. |
| Appartement avec terrasse privative | Terrasse attachée au lot (titre inclus) | Surface habitable + fraction terrasse (50% souvent) | Entretien terrasse à la charge du propriétaire. Étanchéité = partie commune. | Terrasse = attribut du lot. Incidents étanchéité = parties communes. |
| Appartement RDC avec jardin privatif | Jardin attenant au lot, titre inclus | Surface habitable + fraction jardin | Entretien jardin privatif = propriétaire. Clôture mitoyenne = commun. | Jardin = attribut lot. Règles d'usage dans règlement intérieur. |
| Studio / Chambre de service | Petite surface, parfois anciennement chambre de bonne | Faibles tantièmes (petite surface) | Même charges générales mais montant faible | Peut être lié à un appartement principal ou lot indépendant. |
| Appartement en cours de construction (VEFA) | Vente en état futur d'achèvement. Propriétaire pas encore résident. | Définis dans le contrat VEFA | Charges provisoires jusqu'à livraison réelle | Lot créé, pas encore d'utilisateur invité. Statut VEFA. |
| Appartement transformé en bureau | Usage mixte ou changement d'usage (déclaré ou non) | Tantièmes inchangés (basés sur titre) | Charges standard. Usage commercial peut générer charges supplémentaires (ascenseur intensif, nettoyage). | Champ type_usage sur le lot : HABITATION / BUREAU / MIXTE / COMMERCIAL. |

### 1.2 — Parkings : le cas le plus complexe au Maroc

**Contexte Marocain Critique**
Au Maroc, la situation du parking dans un immeuble crée 4 cas distincts avec des règles radicalement différentes. C'est l'une des principales sources de conflits en copropriété. La plateforme doit gérer les 4 cas simultanément dans un même immeuble.

| Cas | Description | Titre foncier | Tantièmes | Gestion plateforme | Règles clés |
| --- | --- | --- | --- | --- | --- |
| CAS A Parking titré individuel | Place de parking avec son propre titre foncier (TF séparé ou lot dans copropriété). Ex: parking sous-terrain numéroté, vendu séparément. | OUI — lot indépendant | Tantièmes propres (ex: 50/10000) | Lot de type PARKING. Propriétaire = copropriétaire à part entière. Peut être différent du propriétaire de l'appartement. | Le propriétaire paie ses charges sur ses tantièmes parking. Vote en AG sur les sujets qui le concernent. Peut vendre/louer sa place indépendamment de l'appartement. |
| CAS B Parking commun non attribué | Places de parking dans une zone commune sans attribution nominale. "Premier arrivé premier servi." Pas de titre individuel. | NON — partie commune | Aucun tantième propre. Géré collectivement. | Pas de lot parking individuel. Règlement intérieur définit les règles d'usage. Module réservation / règles d'accès gère la rotation. | Tous les copropriétaires ont droit d'usage. Règles définies en AG. Pas de location individuelle possible. Conflits fréquents. |
| CAS C Parking commun avec attribution nominale (sans titre) | Places numérotées attribuées à des lots spécifiques par décision d'AG ou règlement intérieur, MAIS sans titre foncier individuel. | NON — partie commune à usage exclusif | Aucun tantième propre. Mais usage exclusif reconnu. | Attribut sur le lot : place_parking_attribuee = "P12". Règle d'usage dans règlement intérieur. Modifiable par AG. | L'attribution peut être modifiée par AG. Le propriétaire ne peut pas vendre la place séparément. Il peut être redevable d'une charge d'usage supplémentaire si décidé en AG. |
| CAS D Parking mixte (immeuble avec les 3 cas) | Même immeuble: certains parkings titrés (vendus), d'autres communs, d'autres attribués sans titre. Cas le plus fréquent dans les nouvelles résidences marocaines. | Mixte | Mixte | La plateforme gère les 3 types simultanément. Chaque place a un attribut : TITRE / COMMUN / ATTRIBUE_SANS_TITRE. | Charges séparées selon type. AG distingue les votes selon droits réels vs usage. |

#### Règles de gestion détaillées — Parking Commun (Cas B & C)

| Situation | Règle | Action plateforme |
| --- | --- | --- |
| Résident utilise place d'un autre | Infraction règlement intérieur. Notification au contrevenant. Escalade au syndic si récidive. | Module incident catégorie "Parking — occupation illicite". Preuve photo. Notification push au propriétaire de la place et au syndic. |
| Résident absent longue durée veut bloquer sa place | Interdit pour parking commun (Cas B). Autorisé pour parking titré (Cas A) — il peut fermer à clé ou mettre un véhicule. | Plateforme vérifie type_parking du lot avant autorisation. Alerte si tentative de blocage illégal. |
| Propriétaire parking titré veut louer sa place à un tiers externe | Légal si parking titré (Cas A). Doit informer le syndic. Tiers = accès limité au parking uniquement. | Lot parking avec locataire_parking différent du propriétaire appartement. Accès badge/code pour le locataire de place. |
| Résident sans parking veut louer une place à un autre résident | Possible si le propriétaire de la place titré accepte. Transaction privée mais le syndic doit être informé pour accès badge. | Notification syndic. Pas de gestion financière dans le MVP (transaction privée). |
| Nombre de places insuffisant (plus de résidents que de places) | Règlement intérieur définit les critères d'attribution (ancienneté, taille famille, etc.) votés en AG. | Module règles d'attribution configurable. File d'attente si nécessaire. |
| Visiteur utilise place résident | Zone visiteurs définie. Si pas de zone dédiée = règlement intérieur. | Gardien peut signaler via incident. Notification au propriétaire. |
| Parking sous-terrain : panne électricité / accès barrière | Incident critique — barrière bloquée = tous les résidents impactés. | Catégorie incident : URGENT. Notification à tous les résidents du parking. Assignation immédiate prestataire. |
| Parking : fuite d'eau / inondation sous-terrain | Incident structure = responsabilité copropriété. | Catégorie : STRUCTURE + URGENCE. Notification à tous propriétaires de places parking. |
| Moto / vélo dans place voiture | Règlement intérieur. Certaines résidences ont zones dédiées motos. | Paramètre configurable par résidence : types_vehicules_autorises par zone. |
| Véhicule abandonné dans parking commun | Procédure légale (PV, mise en demeure, fourrière). Syndic doit agir. | Incident catégorie "Véhicule abandonné". Workflow avec délais légaux. Notifications escalade. |

#### Arbre de décision — Attribution d'une place de parking

```
Nouveau résident souhaite une place de parking
│
├─► A-t-il acheté/loué un lot PARKING titré ?
│    ├─ OUI → Lot parking lui est attribué (propriétaire ou locataire)
│    │         Accès badge/code activé dans la plateforme
│    │         Charges parking calculées sur ses tantièmes
│    └─ NON ──► Y a-t-il des places à attribution nominale (Cas C) ?
│                ├─ OUI → Son appartement a-t-il une place attribuée dans le règlement ?
│                │         ├─ OUI → Place attribuée. Accès activé.
│                │         └─ NON → Liste d'attente ou règle d'AG
│                └─ NON ──► Parking commun (Cas B)
│                            ├─ Règles d'usage définies en AG
│                            ├─ Pas d'attribution personnelle dans la plateforme
│                            └─ Signalement conflits via module incidents
```

### 1.3 — Caves, Locaux Techniques, Toits-Terrasses

| Type | Statut juridique | Tantièmes | Charges | Cas plateforme |
| --- | --- | --- | --- | --- |
| Cave titrée | Lot indépendant avec TF | Oui — faibles (ex: 20/10000) | Charge sur tantièmes propres | Lot type CAVE. Peut être propriétaire différent de l'appart. |
| Cave commune attribuée | Partie commune à usage exclusif | Non | Usage gratuit ou redevance votée AG | Attribut sur lot : cave_attribuee = "C5" |
| Local vélos / poussettes | Partie commune collective | Non | Entretien inclus charges communes | Espace commun de type LOCAL. Réservation ou accès libre selon règlement. |
| Local poubelles | Partie commune — obligation légale | Non | Nettoyage = charges communes. Prestataire collecte = budget commun. | Espace commun non réservable. Incidents liés = catégorie NETTOYAGE. |
| Local technique (électricité, eau) | Partie commune — accès restreint | Non | Maintenance = charges communes | Espace commun type TECHNIQUE. Accès gardien/syndic uniquement. |
| Toit-terrasse commun | Partie commune collective | Non | Entretien, étanchéité = charges communes majeures | Espace commun. Réservable si AG a décidé usage privatif partiel. Sinon accès interdit. |
| Toit-terrasse privatif (penthouse) | Lot ou partie privative du lot supérieur | Inclus dans lot (fraction surface) | Entretien surface = propriétaire. Étanchéité structurelle = copropriété. | Attribut du lot. Incidents étanchéité = distinction charge privative vs commune. |
| Gardiennage / loge gardien | Partie commune à usage exclusif du gardien | Non | Logement gardien = charge de copropriété si prévu au règlement | Lot type LOGE_GARDIEN. Lié au compte utilisateur gardien. |
| Local commercial RDC (appartenant copropriété) | Lot partie commune générant des revenus | Oui — tantièmes propres | Loyer perçu va au compte copropriété. Charges déduites. | Lot type COMMERCIAL_COMMUN. Revenus dans module finances. |

### 1.4 — Villas en Résidence Fermée

| Cas | Description | Spécificités | Gestion plateforme |
| --- | --- | --- | --- |
| Villa individuelle avec jardin privatif | Villa isolée dans résidence. Jardin = partie privative. | Entretien jardin privatif = propriétaire. Clôture mitoyenne = règlement. Piscine privée = propriétaire. | Lot type VILLA. Jardin = attribut. Incidents jardin = privatifs sauf clôture. |
| Villa jumelée (semi-détachée) | 2 villas partageant un mur mitoyen | Mur mitoyen = responsabilité partagée entre les 2 propriétaires ET copropriété selon nature travaux. | Incident mur mitoyen = assignation aux 2 lots + syndic. Workflow validation double. |
| Villa avec piscine commune à la résidence | Piscine partagée entre toutes les villas | Charges piscine = budget commun. Entretien = prestataire choisi en AG. | Espace commun type PISCINE. Réservation créneaux si règlement le prévoit. |
| Résidence avec voirie interne privée | Routes internes à la résidence = parties communes | Entretien voirie, éclairage, signalisation = charges communes. Pas de responsabilité municipale. | Incidents voirie = catégorie VOIRIE. Prestataire spécialisé. |
| Villa avec espace vert commun devant | Bande verte devant les villas = partie commune | Entretien = charge commune. Propriétaire ne peut pas s'approprier l'espace. | Espace commun type ESPACES_VERTS. Incidents = catégorie JARDINS. |
| Résidence avec poste de sécurité / guérite | Sécurité 24h/24 = charge commune majeure | Agents de sécurité = salaire sur budget commun. Prestataire sécurité voté en AG. | Personnel type SECURITE. Contrat prestataire dans documents. Incidents sécurité = urgence. |

### 1.5 — Lots Commerciaux & Bureaux en Copropriété

| Cas | Tantièmes | Charges spécifiques | Droits AG | Gestion plateforme |
| --- | --- | --- | --- | --- |
| Local commercial RDC appartenant à un copropriétaire | Généralement plus élevés que résidentiel (coefficient commercial) | Usage intensif parties communes (vitrine, accès, livraisons). Peut générer charges supplémentaires votées AG. | Vote sur sujets communs. Certaines AG spéciales résidentiels uniquement (règlement intérieur). | Lot type COMMERCIAL. Propriétaire = copropriétaire. Peut avoir employés ≠ résidents pour accès. |
| Bureau en étage (immeuble mixte) | Selon surface et usage | Ascenseur intensif, nettoyage parties communes supplémentaire | Droits complets selon tantièmes | Lot type BUREAU. Utilisateurs du bureau = non-résidents avec accès limité. |
| Cabinet médical / pharmacie en copropriété | Standard selon surface | Déchets médicaux = obligation légale propre. Accès patients = flux important parties communes. | Droits complets. Obligations supplémentaires règlement sanitaire. | Type_activite sur lot commercial. Règles d'accès spécifiques (horaires patients). |
| Restaurant / café en RDC | Standard + coefficient si terrasse commune utilisée | Nuisances sonores, odeurs, déchets = sources de conflits. Terrasse commune = redevance à la copropriété si utilisée. | AG peut voter règles spécifiques horaires, terrasse | Incidents catégorie NUISANCES liée au lot commercial. Redevance terrasse dans module finances. |
