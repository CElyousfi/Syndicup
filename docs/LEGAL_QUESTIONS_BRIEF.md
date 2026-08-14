# Brief juridique — paramètres à confirmer avant mise en production

**Statut : brouillon de travail, à faire valider par un avocat marocain spécialisé en droit de la
copropriété (Loi 18-00/106-12/30-24) et en protection des données (Loi 09-08 / CNDP) avant tout
codage en dur de ces valeurs.**

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

## Comment utiliser ce document

1. Envoyer ce fichier tel quel à l'avocat, section par section.
2. Chaque réponse confirmée est reportée dans `packages/database/seed/legal-params.md` (ou
   directement en valeur de configuration `copropriete` / `ag_resolution` selon le Master Spec)
   **avec la référence de l'article de loi et la date de confirmation**, jamais comme un nombre nu.
3. Tant qu'une valeur n'est pas confirmée ici, le module correspondant (AG en particulier) ne doit
   pas être considéré comme prêt pour la production — le dev peut avancer sur la structure, pas sur
   la valeur figée en dur.
