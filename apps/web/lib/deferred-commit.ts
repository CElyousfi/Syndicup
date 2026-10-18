/**
 * Envoi différé avec « Annuler » — l'action réversible côté CLIENT uniquement.
 *
 * Cas d'usage : « marquer comme lu ». La ligne `notification` est append-only (preuve d'envoi,
 * Master Spec 7.2) : aucun « non lu » serveur n'existe. On ne fait donc la requête qu'à
 * l'expiration du toast (ou quand l'utilisateur quitte la page) ; « Annuler » retire le lot
 * avant tout envoi — rien n'a été fait, il n'y a rien à défaire.
 *
 * Module PUR (aucun DOM) : l'horloge est injectable pour les tests.
 */
export interface Horloge {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const horlogeReelle: Horloge = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class EnvoiDiffere<K> {
  private seq = 0;
  private readonly lots = new Map<number, { cles: K[]; timer: unknown }>();

  constructor(
    /** Envoi effectif d'un lot de clés (une fois, jamais pour un lot annulé). */
    private readonly envoyer: (cles: K[]) => void,
    private readonly delaiMs = 6000,
    private readonly horloge: Horloge = horlogeReelle
  ) {}

  /** Programme un lot ; renvoie son identifiant (pour `annuler`). Un lot vide n'est pas programmé. */
  programmer(cles: K[]): number | null {
    const uniques = [...new Set(cles)].filter((k) => !this.enAttente(k));
    if (uniques.length === 0) return null;
    const id = ++this.seq;
    const timer = this.horloge.setTimeout(() => this.envoyerLot(id), this.delaiMs);
    this.lots.set(id, { cles: uniques, timer });
    return id;
  }

  /** « Annuler » : retire le lot s'il n'est pas encore parti ; renvoie ses clés (null si déjà envoyé). */
  annuler(id: number): K[] | null {
    const lot = this.lots.get(id);
    if (!lot) return null;
    this.horloge.clearTimeout(lot.timer);
    this.lots.delete(id);
    return lot.cles;
  }

  /**
   * Retire une clé de tout lot en attente (ex. la notification est ouverte : marquée lue
   * immédiatement par ailleurs — jamais deux envois pour la même).
   */
  retirer(cle: K): void {
    for (const [id, lot] of this.lots) {
      const reste = lot.cles.filter((k) => k !== cle);
      if (reste.length === lot.cles.length) continue;
      if (reste.length === 0) {
        this.horloge.clearTimeout(lot.timer);
        this.lots.delete(id);
      } else {
        lot.cles = reste;
      }
    }
  }

  /** Envoie TOUT ce qui attend, maintenant (démontage, pagehide, mise en arrière-plan). */
  vider(): void {
    for (const id of [...this.lots.keys()]) this.envoyerLot(id);
  }

  enAttente(cle: K): boolean {
    for (const lot of this.lots.values()) if (lot.cles.includes(cle)) return true;
    return false;
  }

  get nbLots(): number {
    return this.lots.size;
  }

  private envoyerLot(id: number) {
    const lot = this.lots.get(id);
    if (!lot) return;
    this.horloge.clearTimeout(lot.timer);
    this.lots.delete(id);
    this.envoyer(lot.cles);
  }
}
