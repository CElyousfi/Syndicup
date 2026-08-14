# Doc A — Parkings — Règles Complètes & Tous les Scénarios Maroc

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s4`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2 (lot — type_lot=parking).

---

## Parkings — Règles Complètes & Tous les Scénarios Maroc

### 4.1 — Modèle de données complet pour les parkings

| Attribut | Valeurs possibles | Impact fonctionnel |
| --- | --- | --- |
| type_parking | TITRE / COMMUN / ATTRIBUE_SANS_TITRE / MOTO / VELO / VISITEUR | Détermine toutes les règles de gestion |
| localisation | SOUS_TERRAIN / RDC / EXTERIEUR / TOIT | Incidents spécifiques selon localisation |
| numero_place | Ex: "P12", "SS1-A3" | Identification unique dans l'immeuble |
| proprietaire_id | User ID ou null (commun) | Null = commun. Renseigné = titré ou attribué |
| lot_appartement_associe | Lot ID ou null | Si associé, les 2 changent ensemble à la vente |
| acces_badge | Numéro badge ou code | Lié au compte utilisateur pour activation/désactivation |
| vehicule_autorise | VOITURE / MOTO / SUV / CARAVANE / AUCUNE_RESTRICTION | Règlement intérieur paramétrable |
| hauteur_max_cm | Ex: 190, 210, 250 | Certains sous-terrains limitent la hauteur — champ informatif |
| statut | ACTIF / LIBRE / RESERVE / LITIGE / TRAVAUX | Gestion dynamique |

### 4.2 — Scénarios Conflictuels Parkings (les plus fréquents au Maroc)

| Scénario | Déclencheur | Workflow complet | Résolution |
| --- | --- | --- | --- |
| Résident occupe place titrée d'un autre | Propriétaire de la place arrive et trouve son parking occupé | 1. Propriétaire signale via app (photo + numéro place) → 2. Notification au gardien (URGENT) → 3. Gardien vérifie sur place → 4. Identification du véhicule contrevenant → 5. Notification au contrevenant identifié → 6. Si pas de réponse sous 1h → Syndic décide (fourrière, blocage sortie) | Contrevenant déplace son véhicule. Incident archivé. 3ème récidive = mise en demeure. |
| Visiteur externe occupe parking résident | Véhicule sans badge/sticker résident | 1. Gardien ou résident signale → 2. Ticket incident VISITEUR_PARKING → 3. Gardien tente d'identifier via interphone → 4. Si injoignable → Mise en fourrière selon règlement | Procédure fourrière si règlement l'autorise. Affichage rules à l'entrée requis. |
| Propriétaire parking titré veut le vendre séparément de l'appartement | Propriétaire décide de vendre sa place à un voisin ou externe | 1. Notification au syndic de la vente imminente → 2. Vérification : lot parking a-t-il un TF propre ? → 3. Si OUI : syndic prépare attestation de situation financière → 4. Après vente : mise à jour nouveau propriétaire dans plateforme → 5. Accès badge transféré | Lot parking avec nouveau propriétaire distinct de l'appartement. 2 comptes propriétaires différents possibles sur un même étage. |
| Parking commun : dispute sur place "non officielle" mais habituellement occupée | Résident A occupe toujours la place P5 depuis 3 ans "par habitude". Résident B s'y gare. Conflit. | 1. Résident A signale "occupation de ma place" → 2. Syndic vérifie : place P5 est-elle titrée ou attribuée ? → 3. Si COMMUN : pas de droit exclusif → 4. Médiation syndic → 5. Si récurrent → Proposition à l'AG d'un système d'attribution formelle | Rappel règlement : parking commun = pas de droit exclusif. Proposition évolution règlement en AG. |
| Barrière du parking sous-terrain en panne | Barrière bloquée (ouverte ou fermée) | 1. Gardien ou résident signale → 2. Ticket URGENT catégorie ACCES_PARKING → 3. Notification à TOUS les propriétaires de places parking → 4. Prestataire ascensoriste/barrière contacté en urgence → 5. Mise à jour statut toutes les 30 min | Intervention sous 4h maximum. Si nuit : procédure gardien pour accès manuel. |
| Parking sous-terrain : inondation lors de pluies | Infiltration eau lors d'orages (fréquent à Casablanca, Rabat) | 1. Détection par gardien ou résident → 2. Ticket URGENCE STRUCTURE → 3. Notification immédiate TOUS copropriétaires parking → 4. Sortie des véhicules recommandée → 5. Coupure électricité si eau atteint niveau critique → 6. Expertise étanchéité convoquée | Travaux étanchéité = charge commune. Assurance copropriété activée. Expertise contradictoire si réclamations. |
| Charge parking : propriétaire parking titré conteste payer autant que les appartements | Propriétaire de 2 places parking (sans appartement) reçoit appel de fonds | Calcul sur tantièmes parking uniquement. Tableau de calcul affiché dans l'app. Si contestation → Syndic explique règlement de copropriété. | Transparence du calcul dans l'app = résout la majorité des contestations. |
