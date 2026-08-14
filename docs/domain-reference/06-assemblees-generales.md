# Doc A — Assemblées Générales — Tous les Cas Loi 18-00

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s6`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 8 (Moteur AG), Partie 2 (assemblées générales).

---

## Assemblées Générales — Tous les Cas Loi 18-00

### 6.1 — Types d'AG et Déclencheurs

| Type | Fréquence | Déclencheur | Convocation (délai légal) | Quorum légal |
| --- | --- | --- | --- | --- |
| AG Ordinaire Annuelle | 1 fois / an minimum | Obligation légale (Art. 25 Loi 18-00) | 15 jours minimum avant la date | 1re convocation : ≥ 1/2 tantièmes. 2e convocation : sans quorum. |
| AG Extraordinaire (travaux urgents) | À la demande | Travaux urgents, sinistre, décision urgente | 8 jours minimum (urgence reconnue) | Selon objet (voir grille majorités) |
| AG Extraordinaire (modification règlement) | À la demande | Changement règlement de copropriété | 15 jours minimum | Unanimité ou double majorité selon l'objet |
| AG Constitutive | Unique (création) | Première AG de la copropriété | Promoteur convoque tous les premiers acquéreurs | Majorité simple des présents si quorum 2/3 |
| AG à la demande des copropriétaires | À la demande | Pétition d'1/4 des copropriétaires représentant 1/4 des tantièmes (Art. 26 Loi 18-00) | 15 jours minimum | Selon ordre du jour |
| AG de désignation / révocation syndic | À la demande | Fin de mandat, révocation pour faute | 15 jours minimum | Majorité simple (désignation) / Double majorité (révocation) |

### 6.2 — Grille Complète des Majorités (Loi 18-00)

| Objet de la résolution | Type de majorité | Définition | Exemple |
| --- | --- | --- | --- |
| Décisions de gestion courante (budget, prestataires courants) | Majorité simple | Plus de 50% des voix des copropriétaires présents ou représentés | Approbation budget annuel |
| Travaux d'amélioration ou d'entretien importants | Double majorité | Majorité en nombre ET majorité des tantièmes | Ravalement de façade, installation ascenseur |
| Modification du règlement de copropriété | Double majorité renforcée ou unanimité | 2/3 des copropriétaires ET 2/3 des tantièmes (Art. 30) | Changement clés de répartition |
| Aliénation d'une partie commune | Unanimité | 100% des copropriétaires et tantièmes | Vente d'une partie commune |
| Désignation du syndic | Majorité simple | Plus de 50% des présents/représentés | Élection nouveau syndic |
| Révocation du syndic pour faute | Double majorité | Majorité en nombre ET tantièmes | Révocation syndic défaillant |
| Travaux d'urgence (nécessaires immédiats) | Majorité simple (AG extraordinaire) | Ou décision seule du syndic en cas d'urgence absolue (avec ratification AG suivante) | Réparation toiture après tempête |
| Approbation des comptes | Majorité simple | 50% + 1 des présents/représentés | Approbation bilan annuel |
| Constitution fonds de réserve | Double majorité | Majorité en nombre ET tantièmes | Création fonds travaux |

### 6.3 — Tous les Cas de Quorum

| Cas | Règle | Gestion plateforme |
| --- | --- | --- |
| 1re convocation — quorum atteint | Votes exprimés ≥ 50% des tantièmes totaux | AG ouverte automatiquement à l'heure prévue si quorum atteint. Votes validés. |
| 1re convocation — quorum non atteint | AG ne peut pas délibérer. Doit être reconvoquée (2e convocation). | Alerte automatique si quorum non atteint à l'heure d'ouverture. Syndic choisit date 2e convocation (minimum 8 jours après). Notifications envoyées. |
| 2e convocation — sans quorum | La 2e convocation délibère valablement quel que soit le nombre de présents (Art. 31) | Mention claire "2e convocation — aucun quorum requis". AG ouvre automatiquement. |
| Copropriétaire présent en retard | Si l'AG a commencé, il peut participer aux votes restants. Les votes déjà exprimés ne sont pas invalidés. | Retard admis jusqu'à la clôture. Les votes déjà clôturés restent valides. Quorum recalculé avec le retardataire pour les votes suivants. |
| Copropriétaire voulant voter par anticipation | Pas prévu par Loi 18-00. Procuration = mécanisme légal pour voter à distance. | Vote anticipé en ligne = assimilé à vote électronique (acceptable si règlement le prévoit). Ou procuration obligatoire. |
| Procuration | Un copropriétaire peut déléguer son vote à un autre. Limite : 3 procurations max par mandataire (Art. 35). | Module procuration : upload PDF ou acceptation in-app. Vérification limite 3 pouvoirs. Tantièmes du mandant ajoutés au mandataire pour ce vote. |
| Propriétaire de plusieurs lots | Votes pondérés par tantièmes totaux de tous ses lots. | Cumul automatique des tantièmes de tous les lots du propriétaire pour le calcul de ses voix. |
| Lot en indivision | 1 seul vote pour le lot (par le représentant désigné) | Représentant d'indivision = seul compte avec droit de vote pour ce lot. |
| Promoteur avec nombreux lots invendus | Vote pour chaque lot invendu. Peut avoir une majorité de fait sur certaines AG. | Alerte si un seul copropriétaire contrôle > 50% des tantièmes (monopole potentiel). Information visible. |
| Copropriétaire débiteur — peut-il voter ? | La Loi 18-00 ne prévoit pas explicitement de suspension du droit de vote pour impayés. Certains règlements le prévoient. | Configurable dans le règlement intérieur. Si règlement prévoit suspension vote = flag sur compte si impayé > X DH. |

### 6.4 — Déroulement de l'AG Physique — Tous les Scénarios

**Contexte légal Maroc**
La Loi 18-00 ne prévoit pas l'AG entièrement en ligne. L'AG doit se tenir physiquement. La plateforme supporte la gestion numérique du déroulement (quorum, votes, PV) mais l'AG reste un événement en présentiel. Le vote électronique à distance est admis uniquement s'il est prévu par le règlement de copropriété (procuration numérique assimilée à procuration papier).

| Étape | Acteur | Cas normaux | Cas problématiques | Gestion plateforme |
| --- | --- | --- | --- | --- |
| Ouverture | Syndic | Syndic déclare l'AG ouverte, annonce le quorum calculé | Quorum non atteint → report ou 2e convocation | Bouton "Ouvrir l'AG". Affichage quorum temps réel (présents + procurations). Blocage si 1re convocation + quorum insuffisant. |
| Élection du bureau | Copropriétaires présents | Président de séance + secrétaire élus parmi les présents | Personne ne veut présider → le syndic peut assurer la présidence par défaut | Champs président_seance et secretaire_seance saisis par syndic dans le PV. Obligatoires pour valider l'AG. |
| Vote par résolution | Tous copropriétaires présents ou représentés | Chaque résolution soumise séparément. Syndic saisit les résultats en temps réel. | Résolution retirée de l'OJ en cours d'AG ou amendement proposé en séance | Résolution modifiable avant ouverture du vote. Une fois le vote ouvert, la résolution est figée. Syndic peut reporter une résolution. |
| Amendement en séance | Copropriétaire propose modification en direct | Vote sur l'amendement avant vote de la résolution principale | Débat prolongé → Syndic peut mettre la clôture des débats aux voix | Sous-résolution "amendement" créable en cours d'AG. Vote en 2 temps tracé dans le PV. |
| Vote à bulletin secret | Si demandé par un copropriétaire ou prévu par règlement | Résolutions sensibles (révocation syndic, litiges personnels) | Comptage long, contestations | Mode BULLETIN_SECRET disponible : syndic saisit les totaux sans détail nominatif. PV mentionne "vote à bulletin secret — résultat : X pour, Y contre, Z abstentions". |
| Résolution rejetée | Majorité vote NON | Résolution archivée REJETÉE dans le PV | Rejet budget vital → AG doit voter un budget de reconduction minimal | Résolution avec statut REJETEE. PV mentionne résultat complet. Syndic peut soumettre résolution alternative immédiatement. |
| Clôture AG | Syndic | Syndic clôt après épuisement de l'OJ. PV généré automatiquement. | Résolutions en suspens → reporter à la prochaine AG avec mention explicite | Clôture bloquée si des résolutions sont en statut "en attente de vote", sauf forçage syndic (justification tracée). |
| Approbation et distribution du PV | Participants AG + tous copropriétaires | PV présenté, validé, envoyé à tous dans les 48h | Contestation d'un point du PV → annotation de contestation enregistrée comme note annexe | PV généré automatiquement horodaté. Envoi groupé (email + notification push). Délai de contestation 15 jours. Toute contestation enregistrée dans le dossier AG. |

### 6.5 — Vote Électronique par Procuration Numérique

**Seule modalité de vote à distance autorisée au Maroc**
La loi 18-00 prévoit la procuration comme unique mécanisme de vote à distance. La plateforme permet de dématérialiser la procuration tout en respectant le cadre légal. Le mandataire est présent physiquement à l'AG et vote au nom du mandant.

| Cas | Règle légale | Gestion plateforme |
| --- | --- | --- |
| Copropriétaire absent donne procuration à un voisin | Procuration écrite obligatoire (Art. 35 Loi 18-00). Limite : 3 procurations max par mandataire. | Module procuration : génération d'un document PDF de procuration pré-rempli (mandant, mandataire, AG concernée, tous les pouvoirs ou résolutions spécifiques). Signature manuscrite ou cachet suffisant. |
| Vérification des procurations à l'ouverture | Le syndic vérifie chaque procuration avant d'ouvrir l'AG. Procuration invalide = vote refusé. | Checklist procurations dans le tableau de bord AG. Chaque procuration cochée "validée" par le syndic. Tantièmes du mandant ajoutés au mandataire pour le calcul du quorum. |
| Mandataire dépasse la limite de 3 procurations | Interdit par la loi. La 4e procuration est nulle. | Alerte automatique si un compte mandataire atteint 3 procurations pour cette AG. Blocage de la 4e avec message explicite. |
| Procuration générale (tous les votes) | Légale — le mandant délègue tous ses votes à son mandataire | Procuration type GENERALE : le mandataire vote pour toutes les résolutions avec les tantièmes du mandant. |
| Procuration spéciale (résolution précise) | Légale — le mandant instruit son mandataire sur un vote précis | Procuration type SPECIFIQUE : chaque résolution concernée listée avec instruction (POUR / CONTRE / ABSTENTION). Le mandataire ne peut pas déroger à l'instruction pour les résolutions concernées. |
| Retrait de procuration avant l'AG | Le mandant peut retirer sa procuration jusqu'à l'ouverture de l'AG | Annulation de procuration avec notification au mandataire. Si le mandant arrive en personne = sa procuration est automatiquement annulée. |
