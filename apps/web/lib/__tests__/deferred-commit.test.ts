import { describe, expect, it } from "vitest";
import { EnvoiDiffere, type Horloge } from "../deferred-commit";

/** Horloge manuelle : `avancer(ms)` déclenche les minuteurs échus. */
function horlogeFactice() {
  let maintenant = 0;
  let seq = 0;
  const minuteurs = new Map<number, { a: number; fn: () => void }>();
  const horloge: Horloge = {
    setTimeout: (fn, ms) => {
      const id = ++seq;
      minuteurs.set(id, { a: maintenant + ms, fn });
      return id;
    },
    clearTimeout: (h) => {
      minuteurs.delete(h as number);
    },
  };
  const avancer = (ms: number) => {
    maintenant += ms;
    for (const [id, m] of [...minuteurs]) {
      if (m.a <= maintenant) {
        minuteurs.delete(id);
        m.fn();
      }
    }
  };
  return { horloge, avancer, actifs: () => minuteurs.size };
}

function monter() {
  const h = horlogeFactice();
  const envois: string[][] = [];
  const d = new EnvoiDiffere<string>((cles) => envois.push(cles), 6000, h.horloge);
  return { d, envois, ...h };
}

describe("EnvoiDiffere — « Annuler » sans requête", () => {
  it("rien ne part avant l'expiration ; le lot part une seule fois à 6 s", () => {
    const { d, envois, avancer } = monter();
    d.programmer(["a"]);
    avancer(5999);
    expect(envois).toEqual([]);
    expect(d.enAttente("a")).toBe(true);
    avancer(1);
    expect(envois).toEqual([["a"]]);
    avancer(10_000);
    expect(envois).toEqual([["a"]]);
    expect(d.enAttente("a")).toBe(false);
  });

  it("annuler avant l'expiration : aucune requête, clés rendues pour restaurer l'UI", () => {
    const { d, envois, avancer, actifs } = monter();
    const id = d.programmer(["a", "b"])!;
    expect(d.annuler(id)).toEqual(["a", "b"]);
    expect(actifs()).toBe(0);
    avancer(10_000);
    expect(envois).toEqual([]);
  });

  it("annuler après l'envoi ne fait rien (null) — le toast a déjà expiré", () => {
    const { d, avancer } = monter();
    const id = d.programmer(["a"])!;
    avancer(6000);
    expect(d.annuler(id)).toBeNull();
  });

  it("vider (démontage / pagehide / pause) envoie tout ce qui attend, immédiatement, sans doublon ensuite", () => {
    const { d, envois, avancer, actifs } = monter();
    d.programmer(["a"]);
    d.programmer(["b", "c"]);
    d.vider();
    expect(envois).toEqual([["a"], ["b", "c"]]);
    expect(actifs()).toBe(0);
    avancer(10_000);
    expect(envois).toHaveLength(2);
    expect(d.nbLots).toBe(0);
  });

  it("lots indépendants : annuler l'un n'annule pas l'autre", () => {
    const { d, envois, avancer } = monter();
    const un = d.programmer(["a"])!;
    d.programmer(["b"]);
    d.annuler(un);
    avancer(6000);
    expect(envois).toEqual([["b"]]);
  });

  it("retirer une clé (notification ouverte) : elle ne repart pas ; un lot vidé n'est pas envoyé", () => {
    const { d, envois, avancer } = monter();
    d.programmer(["a"]);
    d.programmer(["b", "c"]);
    d.retirer("a");
    d.retirer("b");
    avancer(6000);
    expect(envois).toEqual([["c"]]);
  });

  it("dédoublonne : une clé déjà en attente n'est pas reprogrammée ; un lot vide renvoie null", () => {
    const { d, envois, avancer } = monter();
    d.programmer(["a", "a"]);
    expect(d.programmer(["a"])).toBeNull();
    expect(d.programmer([])).toBeNull();
    const id = d.programmer(["a", "b"]);
    expect(id).not.toBeNull();
    avancer(6000);
    expect(envois).toEqual([["a"], ["b"]]);
  });
});
