import { describe, expect, it } from "vitest";
import { lecturesAmbigues, montantAmbigu, montantOptionnel, montantSaisi, parseMontant } from "../centimes";
import { collectValues, formChecked, formKey, formValue, formValues } from "../form-values";
import { IDLE, success, type FormState } from "../forms";
import { formatPourcent } from "../format";

/**
 * Table PARTAGÉE avec le mobile (apps/mobile/test/parse_montant_test.dart, `_cas`) : mêmes
 * entrées, mêmes sorties. Toute modification se fait des deux côtés.
 * [saisie, attendu] — attendu = montant normalisé, "AMBIGU" ou null (refusé).
 */
const CAS_MONTANT: Array<[string, string | null]> = [
  ["1250", "1250.00"],
  ["12,5", "12.50"],
  ["12.5", "12.50"],
  ["1250.50", "1250.50"],
  ["1250,50", "1250.50"],
  ["0,99", "0.99"],
  ["  42 ", "42.00"],
  ["007", "7.00"],
  ["1 250,50", "1250.50"],
  ["1\u00a0250,50", "1250.50"],
  ["1\u202f250\u202f000,00", "1250000.00"],
  ["1.250,50", "1250.50"],
  ["1,250.50", "1250.50"],
  ["1 250 000", "1250000.00"],
  ["1.250.000,75", "1250000.75"],
  ["1,250,000", "1250000.00"],
  ["1 250", "1250.00"],
  ["1.250", "AMBIGU"],
  ["1,250", "AMBIGU"],
  ["12.500", "AMBIGU"],
  ["999,000", "AMBIGU"],
  ["12 50", null],
  ["1 250.000,5", null],
  ["1.250 000", null],
  ["1.250.50", null],
  ["1,25.50", null],
  ["1.2.3", null],
  ["1250,505", null],
  ["1 250,505", null],
  ["12,", null],
  [",50", null],
  ["-50", null],
  ["+50", null],
  ["abc", null],
  ["1e3", null],
  ["1234567890123", null],
  ["", null],
  ["   ", null],
];

describe("parseMontant — une seule spécification web + mobile", () => {
  it.each(CAS_MONTANT)("« %s » → %s", (saisie, attendu) => {
    if (attendu === "AMBIGU") {
      expect(parseMontant(saisie)).toBeNull();
      expect(montantAmbigu(saisie)).toBe(true);
    } else {
      expect(parseMontant(saisie)).toBe(attendu);
      expect(montantAmbigu(saisie)).toBe(false);
    }
  });

  it("lectures proposées pour une saisie ambiguë", () => {
    expect(lecturesAmbigues("1.250")).toEqual(["1 250", "1,25"]);
    expect(lecturesAmbigues("2,505")).toEqual(["2 505"]);
  });

  it("le serveur renormalise et ne devine jamais", () => {
    const fd = new FormData();
    fd.set("montant", "1 250,50");
    fd.set("vide", "  ");
    fd.set("faux", "12,505");
    fd.set("ambigu", "1.250");
    expect(montantSaisi(fd, "montant")).toBe("1250.50");
    expect(montantSaisi(fd, "vide")).toBe("");
    expect(montantOptionnel(fd, "vide")).toBeNull();
    expect(montantOptionnel(fd, "absent")).toBeNull();
    // Saisie invalide ou ambiguë : transmise telle quelle, l'API la refuse sous le champ.
    expect(montantSaisi(fd, "faux")).toBe("12,505");
    expect(montantSaisi(fd, "ambigu")).toBe("1.250");
  });
});

describe("saisie conservée après un échec", () => {
  const fd = new FormData();
  fd.set("titre", "Fuite au 3e");
  fd.set("categorie", "PLOMBERIE");
  fd.append("garanties", "INCENDIE");
  fd.append("garanties", "DEGAT_DES_EAUX");
  fd.set("urgent", "on");
  fd.set("mot_de_passe", "secret123");
  fd.set("rib", "007780000123456789012345");
  fd.set("numero_cnss", "123456789");
  fd.set("piece_identite_fin", "AB12");
  fd.set("taux_cnss_salarial", "4.48");
  fd.set("attribuable", "on");
  fd.set("$ACTION_ID_abc", "");
  fd.set("photo", new Blob(["x"], { type: "image/png" }), "photo.png");

  const values = collectValues(fd);
  const erreur: FormState = { status: "error", code: "VALIDATION_ERROR", message: "m", values };

  it("garde les chaînes, jamais les fichiers, secrets, RIB, CNSS, pièce d'identité ni champs internes de Next", () => {
    expect(values).toEqual({
      titre: "Fuite au 3e",
      categorie: "PLOMBERIE",
      garanties: ["INCENDIE", "DEGAT_DES_EAUX"],
      urgent: "on",
      // Noms exacts, pas de sous-chaîne : ces champs ordinaires sont gardés.
      taux_cnss_salarial: "4.48",
      attribuable: "on",
    });
  });

  it("relit la saisie, sinon la valeur initiale", () => {
    expect(formValue(erreur, "titre", "initial")).toBe("Fuite au 3e");
    expect(formValue(IDLE, "titre", "initial")).toBe("initial");
    expect(formValue(success(), "titre", "initial")).toBe("initial");
    expect(formValue(IDLE, "ordre", 3)).toBe("3");
    expect(formValue(IDLE, "x", null)).toBe("");
    expect(formValues(erreur, "garanties", ["AUTRE"])).toEqual(["INCENDIE", "DEGAT_DES_EAUX"]);
    expect(formValues(IDLE, "garanties", ["AUTRE"])).toEqual(["AUTRE"]);
  });

  it("une case absente du FormData était décochée", () => {
    expect(formChecked(erreur, "urgent", false)).toBe(true);
    expect(formChecked(erreur, "absent", true)).toBe(false);
    expect(formChecked(IDLE, "absent", true)).toBe(true);
    expect(formChecked(erreur, "garanties", false, "INCENDIE")).toBe(true);
    expect(formChecked(erreur, "garanties", true, "AUTRE")).toBe(false);
  });

  it("la clé d'un select change avec la saisie (remontage → nouveau defaultValue)", () => {
    expect(formKey(IDLE, "categorie")).toBe("initial");
    expect(formKey(erreur, "categorie")).toBe("v:PLOMBERIE");
  });
});

describe("formatPourcent", () => {
  it("virgule décimale, jamais un point", () => {
    expect(formatPourcent(0.125)).toBe("12,5\u202f%");
    expect(formatPourcent("0.5")).toBe("50\u202f%");
    expect(formatPourcent(null)).toBe("—");
  });
});
