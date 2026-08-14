# Doc A — Propriété, Occupation & Statuts des Résidents

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s2`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2 (utilisateur, lot_proprietaire, lot_occupant, succession), Partie 5.

---

## Propriété, Occupation & Statuts des Résidents

### 2.1 — Propriétaire Occupant

| Sous-cas | Règles | Droits plateforme | Obligations |
| --- | --- | --- | --- |
| Propriétaire occupant seul | Cas standard. Titre foncier à son nom. Il réside dans le lot. | Accès complet résident + droits copropriétaire. Vote AG avec ses tantièmes. | Paiement charges. Respect règlement intérieur. |
| Propriétaire occupant avec famille | Seul le propriétaire est "copropriétaire". Les membres de famille = occupants sans droits propres. | 1 compte propriétaire. Les autres membres de famille peuvent être ajoutés comme "occupants" avec accès limité (incidents, notifications). | Propriétaire responsable de tous les membres de son foyer. |
| Propriétaire résidant partiellement (résidence secondaire) | Propriétaire présent périodiquement. Lot souvent vide. | Notifications importantes envoyées même en son absence. Peut déléguer un contact de confiance. | Même charges qu'occupant permanent. Doit désigner un représentant local si possible. |
| Propriétaire MRE (Marocain Résidant à l'Étranger) | Très fréquent au Maroc. Propriétaire à Casablanca/Rabat mais réside en Europe. | Notifications multicanal (email prioritaire). Procuration AG à un représentant local. Interface obligatoirement en français (parfois arabe). | Doit désigner mandataire pour AG si absent. Charges domiciliées sur compte bancaire marocain. |
| Propriétaire âgé / peu digital | Difficulté d'utilisation de l'app | Syndic peut agir en son nom pour certaines actions (avec accord). Notifications SMS prioritaires. Interface simplifiée. | Droit à l'accès à l'information même sans smartphone. |

### 2.2 — Propriétaire Bailleur (Lot Loué)

**Cas très fréquent au Maroc**
Un propriétaire peut posséder l'appartement mais ne pas y résider — il le loue. La plateforme doit gérer simultanément le propriétaire (droits copropriété) et le locataire (droits résidence). Leurs droits sont distincts et leurs obligations de paiement aussi.

| Situation | Propriétaire reçoit | Locataire reçoit | Règle charges | Gestion plateforme |
| --- | --- | --- | --- | --- |
| Appartement loué, propriétaire non-résident | Convocations AG, PV, appels de fonds, documents importants | Incidents parties communes, notifications maintenance, réservations espaces communs | Charges copropriété = dues par propriétaire. Il peut les répercuter dans le loyer (légal). | Lot avec propriétaire_id ET locataire_id. 2 comptes actifs. Droits différents. |
| Locataire signale un incident | Propriétaire notifié si incident concerne parties communes (sa responsabilité financière) | Locataire suit l'avancement de son ticket | Réparation parties communes = charge copropriété. Intérieur appartement = propriétaire ou locataire selon contrat bail. | À la création du ticket, choix : PARTIE_COMMUNE ou PARTIE_PRIVATIVE. Workflow différent selon choix. |
| Locataire veut voter en AG | Vote = droit exclusif du propriétaire | Locataire peut assister à l'AG sans vote (sauf si propriétaire lui donne procuration = rare et encadré) | Loi 18-00 : seul le copropriétaire vote | Locataire n'a pas accès au module AG / vote. Il reçoit les PV uniquement si le propriétaire active l'option. |
| Propriétaire veut que locataire paie les charges directement | Propriétaire reste juridiquement redevable des charges copropriété | Locataire peut payer "pour le compte du propriétaire" mais le syndic doit reconnaître qui paie légalement | Dans la plateforme, paiement enregistré sur le lot (propriétaire reste débiteur légal). Note interne possible. | Champ paye_par = PROPRIETAIRE / LOCATAIRE_POUR_COMPTE. Quittance toujours au nom du propriétaire. |
| Changement de locataire | Propriétaire notifié. Doit mettre à jour la plateforme. | Ancien locataire désinscrit. Nouveau locataire invité. | Charges courantes soldées avant changement. Nouveau locataire repart de zéro. | Workflow "changement occupant" : désactivation ancien compte, génération invitation nouveau locataire, historique conservé. |
| Locataire part sans payer les dernières charges | Propriétaire reste redevable envers la copropriété | Locataire désinscrit de la plateforme | Le syndic se retourne contre le propriétaire, pas le locataire (qui n'est pas copropriétaire) | Impayé reste sur le lot (propriétaire). Alerte propriétaire à la désinscription locataire si solde ouvert. |

### 2.3 — Locataire — Droits et Limites sur la Plateforme

| Action | Locataire peut | Locataire ne peut PAS | Note |
| --- | --- | --- | --- |
| Signaler un incident | ✓ Oui — parties communes et privatif | — | Pour privatif : ticket interne au syndic qui arbitre propriétaire vs locataire |
| Réserver un espace commun | ✓ Oui — si règlement l'autorise | ✗ Certaines résidences limitent aux propriétaires | Configurable par copropriété dans paramètres |
| Télécharger le règlement intérieur | ✓ Oui — document public de la copropriété | — | Obligation légale de le mettre à disposition |
| Voter en AG | ✗ Non | ✗ Non — sauf procuration explicite du propriétaire | Loi 18-00 stricte sur ce point |
| Consulter les finances de la copropriété | ✗ Non — par défaut | ✗ Accès aux bilans financiers limité aux copropriétaires | Option : propriétaire peut accorder accès lecture à son locataire |
| Recevoir convocation AG | ✗ Non — pas par défaut | — | Option activable par propriétaire pour informer son locataire des décisions |
| Signaler une nuisance d'un autre résident | ✓ Oui via module incidents | — | Ticket type NUISANCE. Syndic médiateur. |
| Demander des travaux dans son appartement | ✗ Non directement — doit passer par propriétaire | — | Travaux privatifs = accord propriétaire requis. Locataire peut signaler besoin via messagerie interne. |
| Recevoir notifications urgences immeuble | ✓ Oui — panne eau, ascenseur, urgences | — | Notifications urgences = tous les résidents (propriétaires + locataires) |

### 2.4 — Indivision & Co-propriétaires Multiples d'un Même Lot

**Cas Fréquent au Maroc**
L'indivision (succession non partagée, achat en couple, SCI familiale) est très répandue. Un lot peut avoir 2, 3, 5 propriétaires en indivision. La plateforme doit gérer qui paie, qui vote, et comment.

| Cas | Règle légale (Loi 18-00) | Gestion votes | Gestion charges | Gestion plateforme |
| --- | --- | --- | --- | --- |
| 2 époux co-propriétaires d'un lot | Indivision légale. Les 2 sont copropriétaires. | Les 2 ont un droit de vote mais le lot ne dispose que d'1 voix (tantièmes du lot). Ils doivent se mettre d'accord ou désigner un représentant. | Charges dues par le lot. Solidairement responsables. | Lot avec 2 propriétaires. Représentant désigné pour le vote AG. Les 2 ont accès à l'app (comptes séparés). Les 2 reçoivent notifications. |
| Héritage en indivision (3+ héritiers) | Fréquent au Maroc. Lot pas encore partagé après décès. | 1 représentant désigné par les indivisaires pour voter. Sans désignation, le syndic peut solliciter le tribunal. | Charges dues solidairement par tous les indivisaires. | Lot avec statut INDIVISION. Liste des indivisaires. Représentant désigné dans la plateforme. Tous reçoivent les docs importants. |
| SCI (Société Civile Immobilière) propriétaire | La SCI est personne morale = elle est "le propriétaire" | Représentant légal de la SCI vote (gérant) | Charges au nom de la SCI | Propriétaire type PERSONNE_MORALE. Champ raison_sociale, RC, représentant légal. |
| Indivisaire veut sortir de l'indivision | Procédure judiciaire ou accord amiable. Hors périmètre plateforme. | Jusqu'à la sortie, règles indivision s'appliquent. | Charges continuent selon règles indivision. | Alerte syndic si demande de modification lot en cours de procédure judiciaire. |
| Désaccord entre indivisaires sur paiement charges | Solidarité : le syndic peut réclamer à n'importe quel indivisaire la totalité. | Bloquer vote possible si impayé, même si 1 seul des 2 refuse de payer. | Impayé sur le lot (pas sur une personne). Tous les indivisaires relancés. | Impayé sur lot, notifications à TOUS les indivisaires enregistrés. |

### 2.5 — Succession & Décès du Propriétaire

| Étape | Situation | Action requise | Gestion plateforme |
| --- | --- | --- | --- |
| Décès constaté | Propriétaire décédé. Lot appartient à la succession. | Famille prévient le syndic. Syndic bloque les modifications. | Statut lot : EN_SUCCESSION. Compte propriétaire désactivé (pas supprimé — historique conservé). Notification figée. |
| Période de succession ouverte | Héritiers non encore désignés officiellement. Succession ouverte. | Syndic désigne un contact temporaire dans la famille. Charges continuent d'être dues. | Contact temporaire peut recevoir notifications urgences. Pas de droits de vote. Impayés tracés sur le lot. |
| Héritiers désignés (acte notarié) | Héritier(s) identifié(s) avec document officiel | Syndic met à jour la plateforme avec nouveaux propriétaires (indivision ou lot partagé si possible). | Nouveau(x) propriétaire(s) invités. Ancien compte archivé. Historique transféré au lot (pas au compte). |
| Lot vendu pendant succession | Vente nécessite accord de tous les héritiers | Syndic reçoit notification du notaire. Met à jour nouveau propriétaire. | Workflow "transfert de propriété" : désactivation anciens comptes, invitation nouveau propriétaire, solde charges vérifié avant transfert. |
| Héritier refuse la succession | Lot retombe en déshérence ou autres héritiers | Complexe juridiquement. Syndic doit suivre avec notaire. | Lot en statut SITUATION_COMPLEXE. Alerte syndic. Pas de modification automatique. |

### 2.6 — Lot Vacant & Propriétaire Absent

| Cas | Règle | Charges | Gestion plateforme |
| --- | --- | --- | --- |
| Lot vacant (non loué, non occupé) | Propriétaire toujours redevable de 100% des charges copropriété | Charges pleines dues. Pas de réduction pour vacance. | Statut lot : VACANT. Charges calculées normalement. Propriétaire notifié par email (pas de push si app non utilisée). |
| Propriétaire MRE injoignable | Syndic doit tenter par tous moyens (courrier recommandé, email, contact famille) | Impayés s'accumulent. Intérêts légaux possibles. | Statut impayé avec tentatives de contact tracées. Escalade après X tentatives. |
| Lot en travaux (renovation longue durée) | Propriétaire présent ponctuellement. Lot inutilisable. | Charges pleines dues. Mais peut demander exonération charges eau si compteur coupé — à voter en AG. | Statut lot : EN_TRAVAUX. Incidents travaux tracés. Nuisances voisins = incidents liés. |
| Lot saisi judiciairement | Propriétaire perd temporairement la libre disposition du lot suite à une décision judiciaire | Charges restent dues pendant toute la durée de la saisie. La prise en charge (propriétaire ou administrateur judiciaire) est tranchée par résolution AG extraordinaire convoquée dès notification de la saisie. L'AG peut voter la suspension des services non vitaux et délibère sur la stratégie de recouvrement des charges courantes. | Statut lot : SAISI. Alerte syndic immédiate. Convocation AG extraordinaire déclenchée automatiquement. Résolution AG obligatoire pour toute décision de gestion du lot saisi. Correspondance formelle avec administrateur judiciaire tracée dans la plateforme. |

### 2.7 — Propriétaire Personne Morale

| Type entité | Représentation | Droits AG | Gestion plateforme |
| --- | --- | --- | --- |
| SCI (Société Civile Immobilière) | Gérant de la SCI | Gérant vote au nom de la SCI avec les tantièmes du lot | Compte type PERSONNE_MORALE. Champ représentant_legaux (plusieurs possibles). Procuration interne à la SCI. |
| Promoteur immobilier (lots invendus) | Directeur commercial ou gérant | Vote pour tous ses lots invendus. Peut avoir majorité sur certains sujets si beaucoup de lots invendus. | Propriétaire multi-lots. Lots marqués INVENDU. Promoteur = compte type PROMOTEUR avec droits spéciaux initial. |
| Société d'investissement (fonds immobilier) | Représentant désigné | Idem SCI | Idem SCI |
