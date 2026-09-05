/// Mapping enum métier → variante de badge (brief §6) — la même couleur raconte toujours la
/// même chose, sur web comme sur mobile (apps/web/lib/status.ts).
enum BadgeVariant { neutral, ok, warn, danger, info, outline, ink }

const Map<String, BadgeVariant> ligneAppelVariant = {'PAYE': BadgeVariant.ok, 'PARTIEL': BadgeVariant.warn, 'IMPAYE': BadgeVariant.danger};
BadgeVariant escaladeVariant(String niveau) => niveau == 'N0' ? BadgeVariant.neutral : BadgeVariant.ink;
const Map<String, BadgeVariant> budgetVariant = {'PROPOSE': BadgeVariant.neutral, 'VOTE': BadgeVariant.info, 'ACTIF': BadgeVariant.ok, 'REMPLACE': BadgeVariant.outline};
const Map<String, BadgeVariant> appelVariant = {'BROUILLON': BadgeVariant.neutral, 'EMIS': BadgeVariant.info, 'CLOTURE': BadgeVariant.outline};
const Map<String, BadgeVariant> agVariant = {'PLANIFIEE': BadgeVariant.neutral, 'CONVOQUEE': BadgeVariant.info, 'EN_COURS': BadgeVariant.warn, 'CLOTUREE': BadgeVariant.ok, 'ANNULEE': BadgeVariant.outline};
const Map<String, BadgeVariant> resolutionVariant = {'EN_ATTENTE': BadgeVariant.neutral, 'ADOPTEE': BadgeVariant.ok, 'REJETEE': BadgeVariant.danger};
const Map<String, BadgeVariant> incidentVariant = {'OUVERT': BadgeVariant.danger, 'EN_COURS': BadgeVariant.warn, 'RESOLU': BadgeVariant.ok, 'FERME': BadgeVariant.outline};
const Map<String, BadgeVariant> urgenceVariant = {'NORMALE': BadgeVariant.neutral, 'URGENTE': BadgeVariant.warn, 'URGENCE_MAXIMALE': BadgeVariant.danger};
const Map<String, BadgeVariant> reservationVariant = {'EN_ATTENTE': BadgeVariant.neutral, 'CONFIRMEE': BadgeVariant.ok, 'REJETEE': BadgeVariant.danger, 'ANNULEE': BadgeVariant.outline};
const Map<String, BadgeVariant> visiteVariant = {'EN_ATTENTE': BadgeVariant.warn, 'AUTORISE': BadgeVariant.ok, 'REFUSE': BadgeVariant.danger};
const Map<String, BadgeVariant> personnelVariant = {'PRESENT': BadgeVariant.ok, 'ABSENT': BadgeVariant.danger, 'REMPLACE': BadgeVariant.warn};
const Map<String, BadgeVariant> litigeVariant = {'OUVERT': BadgeVariant.danger, 'RESOLU': BadgeVariant.ok, 'CLOS': BadgeVariant.outline};
const Map<String, BadgeVariant> invitationVariant = {'EN_ATTENTE': BadgeVariant.info, 'ACCEPTEE': BadgeVariant.ok, 'EXPIREE': BadgeVariant.outline, 'REGENEREE': BadgeVariant.neutral};
const Map<String, BadgeVariant> compteVariant = {'INVITE': BadgeVariant.neutral, 'EN_VALIDATION': BadgeVariant.warn, 'ACTIF': BadgeVariant.ok, 'SUSPENDU': BadgeVariant.danger, 'DESACTIVE': BadgeVariant.outline, 'ANONYMISE': BadgeVariant.ink};
const Map<String, BadgeVariant> contestationVariant = {'OUVERTE': BadgeVariant.warn, 'REPONDUE': BadgeVariant.ok, 'MEDIEE': BadgeVariant.info, 'TRIBUNAL': BadgeVariant.ink};
const Map<String, BadgeVariant> lotVariant = {'OCCUPE': BadgeVariant.ok, 'VACANT': BadgeVariant.neutral, 'ORPHELIN': BadgeVariant.warn, 'EN_SUCCESSION': BadgeVariant.outline, 'SINISTRE': BadgeVariant.danger, 'TANTIEME_A_REGULARISER': BadgeVariant.warn};
const Map<String, BadgeVariant> envoiVariant = {'EN_ATTENTE': BadgeVariant.neutral, 'ENVOYE': BadgeVariant.ok, 'ECHOUE': BadgeVariant.danger};
const Map<String, BadgeVariant> coproVariant = {'ACTIVE': BadgeVariant.ok, 'ARCHIVEE': BadgeVariant.outline};
