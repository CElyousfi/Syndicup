# Personnel — dossier RH, paie, congés, présences, évaluations

> Domaine dérivé de Doc A §9 (le gardien : présence, logement de service, fiche visible des
> résidents, remplacement) et §8 (obligations de l'employeur : le syndicat est l'employeur du
> personnel, déclarations sociales, coût des salaires dans les charges). Doc A ne détaille ni le
> calcul de paie ni la gestion des congés : ce fichier les fixe pour le module M20 — il ne
> réécrit pas Doc A. Tous les taux (CNSS, AMO, IR, SMIG, congés) sont PROVISOIRES (brief §11) et
> **ne sont jamais codés en dur** : ils vivent dans `copropriete.parametres_paie_json`, saisis par
> le syndic ; sans eux, la validation d'une fiche répond 422 `PAIE_PARAMETRES_NON_CONFIGURES`.

---

## 17.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Une fiche = un dossier | La fiche M9 (présence, loge) devient le dossier RH : poste, contrat de travail, dates, salaire brut, CNSS, contact d'urgence, horaires, notes, contrat signé. | Colonnes M20 sur `personnel` (pas de seconde table) ; `personnel_log` append-only pour chaque événement RH. |
| Confidentialité | Doc A §12.3 : la fiche (nom, poste, présence, loge) est visible des résidents ; le reste est syndic + l'employé lui-même. Le n° CNSS ne sort jamais en clair d'une liste. | `presenterPersonnel` masque salaire / contrat / CNSS pour les autres rôles ; `numero_cnss_masque` (`•••••6789`) ; lecture complète `GET /personnel/{id}/cnss` **auditée** (`CNSS_CONSULTE`). Exports sans CNSS. |
| La paie est une aide au calcul | Le syndic déclare et paie ; l'application prépare, fige et explique. | `fiche_paie` : brouillon calculé (`calculerPaie`, decimal.js), validation figeant `details_json` (paramètres appliqués + résultat), PDF FR/AR rendu à la demande avec mention « pas un bulletin certifié ». |
| La paie est une dépense | Doc A §8 : les salaires sont une charge de la copropriété. Miroir de M16. | Validation → dépense `PERSONNEL` (coût total employeur) créée **et soumise** dans la même transaction (`fiche_paie.depense_id` 1-1) ; paiement via `POST /depenses/{id}/payer` (méthode, référence, preuve) → fiche `PAYEE` (hook `payerDepense`). |
| Congés décomptés | Jours ouvrables (lundi → samedi), solde annuel = `jours_conge_annuels` (paramètre) − pris. | `conge` DEMANDE → APPROUVE / REFUSE (motif) / ANNULE ; l'approbation pose les présences `CONGE` / `MALADIE` et refuse au-delà du solde (`CONGE_SOLDE_INSUFFISANT`) ; remplaçant optionnel ; certificat = Document `CERTIFICAT_CONGE` (SYNDIC_ONLY). |
| Présence pointée | Le gardien pointe lui-même (mobile, hors-ligne), le syndic saisit / corrige en masse. | `presence_personnel` unique (employé, date) — upsert idempotent ; les `ABSENT` du mois sont retenus sur la paie si `retenue_absence_injustifiee`. |
| Évaluation réservée | Syndic + conseil notent ; l'employé ne voit pas. | `evaluation_personnel` unique (employé, période, évaluateur) ; RLS syndic / conseil. |

## 17.1 — Statuts et rôles

| Statut `personnel` | Sens | Effets |
| --- | --- | --- |
| `PRE_EMBAUCHE` | Dossier ouvert avant la prise de poste. | Pas de paie ; invisible du planning. |
| `PRESENT` / `ABSENT` / `REMPLACE` | M9 (présence quotidienne, alerte résidents). | inchangés |
| `PARTI` | Fin de contrat / départ. | Libère la loge (Doc A §9.2), plus de congé ni de pointage ; l'historique reste. |

| Rôle | Fiche | Dossier complet | Paie | Congés | Présences | Évaluations | Planning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Syndic | ✓ | ✓ (+ CNSS audité) | prépare / valide / paie | approuve / refuse, demande au nom | saisie en masse | note | ✓ |
| Employé (rôle GARDIEN) | ✓ | le sien | ses fiches + PDF | demande / annule | pointe (idempotent) | ✗ | sa ligne |
| Conseil | ✓ (publique) | ✗ | ✗ | ✗ | lecture | note | ✓ |
| Résidents, prestataire | ✓ (publique) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## 17.2 — Calcul de paie (`lib/personnel/paie.ts`)

`base = brut + primes` ; CNSS salarial = taux × min(base, plafond) ; AMO salarial = taux × base ;
frais professionnels = min(taux × base, plafond mensuel) ; net imposable = base − CNSS − AMO −
frais ; IR = barème annuel (`tranches_ir` : `jusqua` | null, `taux`, `deduction`) appliqué à
net imposable × 12 puis / 12 ; net = base − cotisations salariales − retenues − retenue d'absence
(base / `jours_ouvres_mois` × jours d'absence injustifiée) ; charges patronales = CNSS (plafonné),
allocations familiales, AMO, formation professionnelle ; coût total employeur = base + charges
patronales. `sous_smig` = brut < `smig_mensuel` (avertissement, jamais bloquant). Tout en
`decimal.js`, 2 décimales, jamais de float.

## 17.3 — Cycle de la fiche de paie

`BROUILLON` (recalculable, supprimable par recréation — unique employé / période) →
`VALIDEE` (`POST …/valider`, Idempotency-Key : paramètres requis, calcul figé, dépense PERSONNEL
créée + soumise, `PAIE_VALIDEE` à l'employé, PDF stocké SYNDIC_ONLY) → `PAYEE` (paiement de la
dépense liée, `PAIE_PAYEE` au journal). Le PDF FR/AR est rendu à la demande depuis `details_json`
(`GET …/pdf?langue=`) : l'employé télécharge le sien sans qu'aucune policy document soit élargie.

## 17.4 — Jobs

| Job | Cron | Effets | Idempotence |
| --- | --- | --- | --- |
| `personnel-mensuel` | 25 du mois 07:00 | brouillons de paie pour tout employé actif sans fiche du mois (`PAIE_A_VALIDER` au syndic) ; CDD dont la fin tombe sous 30 jours → `CONTRAT_TRAVAIL_FIN_PROCHE`. | unique employé / période ; `fin_contrat_notifie_le`. |
| `personnel-conges-rappel` | quotidien 07:15 | demande DEMANDE depuis > 3 jours → `CONGE_EN_ATTENTE_RAPPEL` au syndic. | `conge.rappel_envoye_le`. |

## 17.5 — Liens avec les autres modules

- **M16 Dépenses** : `depense.personnel_id` / `periode_paie`, catégorie `PERSONNEL`, cycle
  d'approbation inchangé ; `payerDepense` bascule la fiche.
- **M17 Justificatifs** : la preuve de paiement du salaire est celle de la dépense.
- **M18 Rapports** : export `PERSONNEL` / `CONGES` journalisés (`export_log`) ; masse salariale
  dans le budget vs réalisé via la catégorie.
- **M19 Contrats** : le contrat de gardiennage externalisé reste un contrat prestataire ; ce
  module couvre les salariés de la copropriété.
- **M22 Tâches** : rappels de fin de CDD et de renouvellement à convertir en tâches quand la
  table existe.
