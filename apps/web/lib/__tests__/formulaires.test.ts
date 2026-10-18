import { describe, expect, it } from "vitest";
import { montantOptionnel, montantSaisi, parseMontant } from "../centimes";
import { collectValues, formChecked, formKey, formValue, formValues } from "../form-values";
import { IDLE, success, type FormState } from "../forms";
import { formatPourcent } from "../format";

describe("parseMontant — saisie naturelle → format API", () => {
  it.each([
    ["1 250,50", "1250.50"],
    ["1250.50", "1250.50"],
    ["1250", "1250.00"],
    ["1250,5", "1250.50"],
    ["0,99", "0.99"],
    ["  42 ", "42.00"],
    ["1\u00a0250,50", "1250.50"],
    ["1\u202f250\u202f000,00", "1250000.00"],
    ["007", "7.00"],
    ["1250,", "1250.00"],
  ])("« %s » → %s", (saisie, attendu) => {
    expect(parseMontant(saisie)).toBe(attendu);
  });

  it.each([
    ["1250,505", "plus de 2 décimales"],
    ["12,50,3", "deux séparateurs"],
    ["1.250,50", "point de milliers + virgule"],
    ["-50", "signe"],
    ["12 50", "groupement qui n'est pas par 3"],
    ["abc", "lettres"],
    ["1e3", "notation scientifique"],
    [",50", "sans partie entière"],
    ["1234567890123", "plus de 12 chiffres"],
    ["", "vide"],
  ])("refuse « %s » (%s)", (saisie) => {
    expect(parseMontant(saisie)).toBeNull();
  });

  it("le serveur renormalise et ne devine jamais", () => {
    const fd = new FormData();
    fd.set("montant", "1 250,50");
    fd.set("vide", "  ");
    fd.set("faux", "12,505");
    expect(montantSaisi(fd, "montant")).toBe("1250.50");
    expect(montantSaisi(fd, "vide")).toBe("");
    expect(montantOptionnel(fd, "vide")).toBeNull();
    expect(montantOptionnel(fd, "absent")).toBeNull();
    // Saisie invalide : transmise telle quelle, l'API la refuse avec un message sous le champ.
    expect(montantSaisi(fd, "faux")).toBe("12,505");
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
  fd.set("$ACTION_ID_abc", "");
  fd.set("photo", new Blob(["x"], { type: "image/png" }), "photo.png");

  const values = collectValues(fd);
  const erreur: FormState = { status: "error", code: "VALIDATION_ERROR", message: "m", values };

  it("garde les chaînes, jamais les fichiers, secrets, RIB ni champs internes de Next", () => {
    expect(values).toEqual({
      titre: "Fuite au 3e",
      categorie: "PLOMBERIE",
      garanties: ["INCENDIE", "DEGAT_DES_EAUX"],
      urgent: "on",
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
