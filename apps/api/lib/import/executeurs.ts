/**
 * Exécuteurs par type d'import (M24) — une ligne normalisée → écritures dans la transaction du chunk.
 * Chaque exécuteur est idempotent au niveau métier (clé naturelle : n° de lot, nom de prestataire,
 * plaque, identifiant de badge, téléphone) en plus de l'idempotence par empreinte de ligne.
 * Aucun compte fantôme : un propriétaire / employé inconnu devient une invitation pré-remplie
 * (matérialisée à l'acceptation, voir migration m24 `invitation_accepter`).
 */
import { Prisma } from "@prisma/client";
import type { TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { money } from "../money";
import { genererCode, expiration } from "../auth/invitations";
import { TYPES_LOT, TYPES_PROPRIETE } from "../lots/schemas";
import { TYPES_CONTRAT, PERIODICITES } from "../contrats/schemas";
import { normaliserImmatriculation } from "../parkings/schemas";
import { normaliserBooleen, normaliserDate, normaliserDecimal, normaliserEntier, normaliserEnum, normaliserTelephone } from "./parse";
import type { TypeImport } from "./schemas";

export class LigneError extends Error {}
export type Champs = Record<string, string | null>;
export type OptionsImport = { date_reference?: string; inviter?: boolean; canal?: "SMS" | "EMAIL" | "WHATSAPP" };
export type ResultatLigne = { resultat: "CREE" | "MIS_A_JOUR" | "IGNOREE"; details?: Record<string, unknown> };
/** Cache par exécution (chunk) : lots par numéro, invitations par téléphone / email, appel d'ouverture… */
export type CacheImport = Map<string, unknown>;

const ALIAS_TYPE_LOT: Record<string, string> = { appartement: "APPARTEMENT", appt: "APPARTEMENT", apt: "APPARTEMENT", flat: "APPARTEMENT", "شقة": "APPARTEMENT", parking: "PARKING", place: "PARKING", garage: "PARKING", "موقف": "PARKING", cave: "CAVE", "قبو": "CAVE", local: "LOCAL", commerce: "COMMERCIAL", magasin: "COMMERCIAL", "محل": "COMMERCIAL", terrasse: "TOIT_TERRASSE", loge: "LOGE_GARDIEN", villa: "VILLA", bureau: "BUREAU" };
const ALIAS_PROPRIETE: Record<string, string> = { plein: "PLEIN", pleine: "PLEIN", indivision: "INDIVISION", indivis: "INDIVISION", sci: "SCI", societe: "SCI", "société": "SCI" };
const ALIAS_CONTRAT: Record<string, string> = { assurance: "ASSURANCE_IMMEUBLE", "assurance immeuble": "ASSURANCE_IMMEUBLE", "multirisque": "ASSURANCE_IMMEUBLE", "rc": "ASSURANCE_RC", ascenseur: "ASCENSEUR", "المصعد": "ASCENSEUR", nettoyage: "NETTOYAGE", "menage": "NETTOYAGE", "ménage": "NETTOYAGE", "التنظيف": "NETTOYAGE", gardiennage: "GARDIENNAGE", securite: "GARDIENNAGE", "sécurité": "GARDIENNAGE", jardinage: "JARDINAGE", "espaces verts": "JARDINAGE", deratisation: "DERATISATION", "dératisation": "DERATISATION", eau: "EAU", electricite: "ELECTRICITE", "électricité": "ELECTRICITE", internet: "INTERNET", syndic: "SYNDIC_PROFESSIONNEL", travaux: "TRAVAUX" };
const ALIAS_PERIODICITE: Record<string, string> = { mensuel: "MENSUELLE", mensuelle: "MENSUELLE", mois: "MENSUELLE", "شهري": "MENSUELLE", trimestriel: "TRIMESTRIELLE", trimestrielle: "TRIMESTRIELLE", trimestre: "TRIMESTRIELLE", semestriel: "SEMESTRIELLE", semestrielle: "SEMESTRIELLE", annuel: "ANNUELLE", annuelle: "ANNUELLE", an: "ANNUELLE", "سنوي": "ANNUELLE", ponctuel: "PONCTUELLE", ponctuelle: "PONCTUELLE", unique: "PONCTUELLE" };
const ALIAS_POSTE: Record<string, string> = { gardien: "GARDIEN", concierge: "GARDIEN", "حارس": "GARDIEN", entretien: "AGENT_ENTRETIEN", menage: "AGENT_ENTRETIEN", "ménage": "AGENT_ENTRETIEN", "nettoyage": "AGENT_ENTRETIEN", jardinier: "JARDINIER", "بستاني": "JARDINIER", securite: "AGENT_SECURITE", "sécurité": "AGENT_SECURITE", vigile: "AGENT_SECURITE" };
const ALIAS_VEHICULE: Record<string, string> = { voiture: "VOITURE", auto: "VOITURE", car: "VOITURE", "سيارة": "VOITURE", moto: "MOTO", scooter: "MOTO", "دراجة": "MOTO", utilitaire: "UTILITAIRE", camionnette: "UTILITAIRE", van: "UTILITAIRE" };
const ALIAS_BADGE: Record<string, string> = { badge: "BADGE_PIETON", pieton: "BADGE_PIETON", "piéton": "BADGE_PIETON", telecommande: "TELECOMMANDE_PARKING", "télécommande": "TELECOMMANDE_PARKING", bip: "TELECOMMANDE_PARKING", parking: "TELECOMMANDE_PARKING", cle: "CLE_CAVE", "clé": "CLE_CAVE", cave: "CLE_CAVE", carte: "CARTE_ASCENSEUR", ascenseur: "CARTE_ASCENSEUR" };

async function lotParNumero(db: TenantDb, ctx: TenantContext, cache: CacheImport, numero: string) {
  const cle = `lot:${numero.toUpperCase()}`;
  if (!cache.has(cle)) cache.set(cle, await db.lot.findFirst({ where: { coproprieteId: ctx.coproprieteId, numero: { equals: numero, mode: "insensitive" } } }));
  return cache.get(cle) as Prisma.LotGetPayload<Record<string, never>> | null;
}
function exiger(c: Champs, cle: string, libelle: string): string {
  const v = c[cle]?.trim();
  if (!v) throw new LigneError(`${libelle} manquant.`);
  return v;
}

/** Invitation pré-remplie, une par personne (téléphone ou e-mail) : les lots s'accumulent dans `pre_rempli.lots`. */
async function invitationPreRemplie(db: TenantDb, ctx: TenantContext, cache: CacheImport, jobId: string, options: OptionsImport, p: { role: "PROPRIETAIRE" | "INDIVISAIRE" | "GARDIEN" | "LOCATAIRE"; nom: string; prenom: string | null; telephone: string | null; email: string | null; langue: "FR" | "AR"; lot?: { lot_id: string; quote_part: string; type_propriete: string; date_debut?: string }; extra?: Record<string, unknown> }): Promise<{ id: string; creee: boolean }> {
  const cle = `inv:${p.telephone ?? p.email ?? `${p.nom}|${p.prenom ?? ""}`.toLowerCase()}`;
  let inv = cache.get(cle) as { id: string; preRempliJson: Prisma.JsonValue } | null | undefined;
  if (inv === undefined) {
    // Même personne déjà invitée (par cet import ou un précédent, encore en attente) ?
    const candidats = await db.invitation.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: "EN_ATTENTE", preRempliJson: { not: Prisma.DbNull } }, select: { id: true, preRempliJson: true, roleCible: true } });
    inv = candidats.find((c) => { const j = (c.preRempliJson ?? {}) as Record<string, unknown>; return c.roleCible === p.role && ((p.telephone && j.telephone === p.telephone) || (p.email && j.email === p.email) || (!p.telephone && !p.email && `${j.nom}`.toLowerCase() === p.nom.toLowerCase() && `${j.prenom ?? ""}`.toLowerCase() === (p.prenom ?? "").toLowerCase())); }) ?? null;
    cache.set(cle, inv);
  }
  const canal = options.canal ?? (p.email && !p.telephone ? "EMAIL" : "SMS");
  if (inv) {
    const j = (inv.preRempliJson ?? {}) as Record<string, unknown>;
    const lots = Array.isArray(j.lots) ? [...(j.lots as Record<string, unknown>[])] : [];
    if (p.lot && !lots.some((l) => l.lot_id === p.lot!.lot_id)) lots.push(p.lot);
    const preRempli = { ...j, ...(p.extra ?? {}), nom: j.nom ?? p.nom, prenom: j.prenom ?? p.prenom, telephone: j.telephone ?? p.telephone, email: j.email ?? p.email, lots } as Prisma.InputJsonValue;
    await db.invitation.update({ where: { id: inv.id }, data: { preRempliJson: preRempli } });
    cache.set(cle, { id: inv.id, preRempliJson: preRempli as Prisma.JsonValue });
    return { id: inv.id, creee: false };
  }
  const creee = await db.invitation.create({ data: { coproprieteId: ctx.coproprieteId, lotId: p.lot?.lot_id ?? null, roleCible: p.role, emetteurId: ctx.utilisateurId, canal, code: genererCode(), expireLe: expiration(canal === "EMAIL" ? "EMAIL" : canal === "WHATSAPP" ? "WHATSAPP" : "SMS"), importJobId: jobId, preRempliJson: { nom: p.nom, prenom: p.prenom, telephone: p.telephone, email: p.email, langue: p.langue, lots: p.lot ? [p.lot] : [], ...(p.extra ?? {}) } as Prisma.InputJsonValue } });
  cache.set(cle, { id: creee.id, preRempliJson: creee.preRempliJson });
  return { id: creee.id, creee: true };
}

// ── LOTS_PROPRIETAIRES ────────────────────────────────────────────────────────
async function lotsProprietaires(db: TenantDb, ctx: TenantContext, c: Champs, options: OptionsImport, cache: CacheImport, jobId: string): Promise<ResultatLigne> {
  const numero = exiger(c, "numero", "N° lot");
  const tantiemes = normaliserDecimal(c.tantiemes);
  let lot = await lotParNumero(db, ctx, cache, numero);
  let resultat: ResultatLigne["resultat"] = "IGNOREE";
  const typeLot = (normaliserEnum(c.type_lot, TYPES_LOT, ALIAS_TYPE_LOT) ?? (/^(p|pk|park)/i.test(numero) ? "PARKING" : /^(c|cave)/i.test(numero) ? "CAVE" : "APPARTEMENT")) as (typeof TYPES_LOT)[number];
  if (!lot) {
    if (!tantiemes) throw new LigneError("Tantièmes manquants ou invalides.");
    lot = await db.lot.create({ data: { coproprieteId: ctx.coproprieteId, numero, typeLot, tantiemes, etage: normaliserEntier(c.etage), batiment: c.batiment?.trim() || null, superficie: normaliserDecimal(c.superficie) ?? undefined, statut: "VACANT" } });
    cache.set(`lot:${numero.toUpperCase()}`, lot);
    resultat = "CREE";
  } else {
    const data: Prisma.LotUncheckedUpdateInput = {};
    if (tantiemes && money(lot.tantiemes.toString()).toString() !== money(tantiemes).toString()) data.tantiemes = tantiemes;
    const etage = normaliserEntier(c.etage); if (etage !== null && etage !== lot.etage) data.etage = etage;
    const bat = c.batiment?.trim(); if (bat && bat !== lot.batiment) data.batiment = bat;
    if (Object.keys(data).length) { lot = await db.lot.update({ where: { id: lot.id }, data }); cache.set(`lot:${numero.toUpperCase()}`, lot); resultat = "MIS_A_JOUR"; }
  }
  const nom = c.nom?.trim();
  let invitation: { id: string; creee: boolean } | null = null;
  let rattache = false;
  if (nom) {
    const telephone = normaliserTelephone(c.telephone);
    const email = c.email?.trim().toLowerCase() || null;
    const quote = normaliserDecimal(c.quote_part) ?? "100.00";
    const typePropriete = normaliserEnum(c.type_propriete, TYPES_PROPRIETE, ALIAS_PROPRIETE) ?? (money(quote).lessThan(100) ? "INDIVISION" : "PLEIN");
    // Membre déjà connu (même téléphone / e-mail) → rattachement direct, sans invitation.
    const existant = telephone || email ? await db.utilisateur.findFirst({ where: { OR: [...(telephone ? [{ telephone }] : []), ...(email ? [{ email }] : [])], roles: { some: { coproprieteId: ctx.coproprieteId, actif: true } } }, select: { id: true } }).catch(() => null) : null;
    if (existant) {
      const deja = await db.lotProprietaire.findFirst({ where: { lotId: lot.id, utilisateurId: existant.id, dateFin: null }, select: { id: true } });
      if (!deja) { await db.lotProprietaire.create({ data: { lotId: lot.id, utilisateurId: existant.id, quotePart: quote, typePropriete: typePropriete as "PLEIN" | "INDIVISION" | "SCI", dateDebut: new Date() } }); rattache = true; if (resultat === "IGNOREE") resultat = "MIS_A_JOUR"; }
    } else if (options.inviter !== false) {
      invitation = await invitationPreRemplie(db, ctx, cache, jobId, options, { role: typePropriete === "INDIVISION" ? "INDIVISAIRE" : "PROPRIETAIRE", nom, prenom: c.prenom?.trim() || null, telephone, email, langue: /^ar/i.test(c.langue ?? "") ? "AR" : "FR", lot: { lot_id: lot.id, quote_part: quote, type_propriete: typePropriete } });
      if (invitation.creee && resultat === "IGNOREE") resultat = "MIS_A_JOUR";
    }
  }
  return { resultat, details: { lot_id: lot.id, numero: lot.numero, invitation_id: invitation?.id ?? null, invitation_creee: invitation?.creee ?? false, rattache } };
}

// ── SOLDES_OUVERTURE ─────────────────────────────────────────────────────────
async function soldesOuverture(db: TenantDb, ctx: TenantContext, c: Champs, options: OptionsImport, cache: CacheImport, jobId: string): Promise<ResultatLigne> {
  const numero = exiger(c, "numero", "N° lot");
  const lot = await lotParNumero(db, ctx, cache, numero);
  if (!lot) throw new LigneError(`Lot « ${numero} » inconnu — importez d'abord les lots.`);
  const montant = normaliserDecimal(c.montant);
  if (!montant || money(montant).isZero()) throw new LigneError("Solde manquant, invalide ou nul.");
  const dateRef = normaliserDate(c.date_reference) ?? options.date_reference ?? new Date().toISOString().slice(0, 10);
  const existant = await db.soldeOuverture.findUnique({ where: { coproprieteId_lotId: { coproprieteId: ctx.coproprieteId, lotId: lot.id } } });
  if (existant && money(existant.montant.toString()).equals(money(montant))) return { resultat: "IGNOREE", details: { lot_id: lot.id, montant } };
  const m = money(montant);
  let ligneId: string | null = existant?.appelDeFondsLotId ?? null;
  if (m.greaterThan(0)) {
    const periode = dateRef.slice(0, 7);
    const cle = `appel:${periode}`;
    let appel = cache.get(cle) as { id: string } | undefined;
    if (!appel) {
      appel = (await db.appelDeFonds.findUnique({ where: { coproprieteId_periode_type: { coproprieteId: ctx.coproprieteId, periode, type: "SOLDE_OUVERTURE" } }, select: { id: true } })) ?? (await db.appelDeFonds.create({ data: { coproprieteId: ctx.coproprieteId, periode, type: "SOLDE_OUVERTURE", montantTotal: "0.00", dateEcheance: new Date(`${dateRef}T00:00:00.000Z`), statut: "EMIS" }, select: { id: true } }));
      cache.set(cle, appel);
    }
    if (ligneId) {
      const ligne = await db.appelDeFondsLot.findUnique({ where: { id: ligneId } });
      if (ligne && money(ligne.montantPaye.toString()).greaterThan(0)) throw new LigneError("Solde d'ouverture déjà partiellement réglé : il ne se modifie plus.");
      await db.appelDeFondsLot.update({ where: { id: ligneId }, data: { montantDu: m.toString() } });
    } else {
      const deja = await db.appelDeFondsLot.findUnique({ where: { appelDeFondsId_lotId: { appelDeFondsId: appel.id, lotId: lot.id } } });
      ligneId = deja ? (await db.appelDeFondsLot.update({ where: { id: deja.id }, data: { montantDu: m.toString() } })).id : (await db.appelDeFondsLot.create({ data: { appelDeFondsId: appel.id, lotId: lot.id, montantDu: m.toString() } })).id;
    }
    const total = await db.appelDeFondsLot.aggregate({ where: { appelDeFondsId: appel.id }, _sum: { montantDu: true } });
    await db.appelDeFonds.update({ where: { id: appel.id }, data: { montantTotal: (total._sum.montantDu ?? 0).toString() } });
  } else if (ligneId) {
    // Passage d'un dû à un avoir : la ligne d'appel (non réglée) est ramenée à 0.
    await db.appelDeFondsLot.update({ where: { id: ligneId }, data: { montantDu: "0.00" } });
  }
  const data = { montant: m.toString(), dateReference: new Date(`${dateRef}T00:00:00.000Z`), commentaire: c.commentaire?.trim() || null, importJobId: jobId, appelDeFondsLotId: m.greaterThan(0) ? ligneId : existant?.appelDeFondsLotId ?? null };
  if (existant) await db.soldeOuverture.update({ where: { id: existant.id }, data });
  else await db.soldeOuverture.create({ data: { coproprieteId: ctx.coproprieteId, lotId: lot.id, ...data } });
  return { resultat: existant ? "MIS_A_JOUR" : "CREE", details: { lot_id: lot.id, montant: m.toString(), avoir: m.lessThan(0), appel_de_fonds_lot_id: ligneId } };
}

// ── PRESTATAIRES ─────────────────────────────────────────────────────────────
async function prestataires(db: TenantDb, ctx: TenantContext, c: Champs): Promise<ResultatLigne> {
  const nom = exiger(c, "nom", "Nom");
  const specialite = c.specialite?.trim() || "Autre";
  const telephone = normaliserTelephone(c.telephone);
  const email = c.email?.trim().toLowerCase() || null;
  const existant = await db.prestataire.findFirst({ where: { coproprieteId: ctx.coproprieteId, nom: { equals: nom, mode: "insensitive" } } });
  if (existant) {
    const data: Prisma.PrestataireUncheckedUpdateInput = {};
    if (telephone && !existant.telephone) data.telephone = telephone;
    if (email && !existant.email) data.email = email;
    if (c.ice && /^\d{15}$/.test(c.ice) && !existant.ice) data.ice = c.ice;
    if (c.rc && !existant.rc) data.rc = c.rc.trim();
    if (c.adresse && !existant.adresse) data.adresse = c.adresse.trim();
    if (!Object.keys(data).length) return { resultat: "IGNOREE", details: { prestataire_id: existant.id } };
    await db.prestataire.update({ where: { id: existant.id }, data });
    return { resultat: "MIS_A_JOUR", details: { prestataire_id: existant.id } };
  }
  if (!telephone && !email) throw new LigneError("Téléphone ou e-mail requis.");
  const p = await db.prestataire.create({ data: { coproprieteId: ctx.coproprieteId, nom, specialite, contact: telephone ?? email ?? "", telephone, email, ice: c.ice && /^\d{15}$/.test(c.ice) ? c.ice : null, rc: c.rc?.trim() || null, adresse: c.adresse?.trim() || null, notes: c.notes?.trim() || null } });
  return { resultat: "CREE", details: { prestataire_id: p.id } };
}

// ── CONTRATS ─────────────────────────────────────────────────────────────────
async function contrats(db: TenantDb, ctx: TenantContext, c: Champs): Promise<ResultatLigne> {
  const libelle = exiger(c, "libelle", "Libellé");
  const type = normaliserEnum(c.type, TYPES_CONTRAT, ALIAS_CONTRAT);
  if (!type) throw new LigneError(`Type de contrat inconnu : « ${c.type ?? ""} ».`);
  const dateDebut = normaliserDate(c.date_debut);
  if (!dateDebut) throw new LigneError("Date de début manquante ou invalide.");
  const dateFin = normaliserDate(c.date_fin);
  if (dateFin && dateFin < dateDebut) throw new LigneError("La date de fin précède la date de début.");
  const periodicite = normaliserEnum(c.periodicite, PERIODICITES, ALIAS_PERIODICITE) ?? "ANNUELLE";
  const doublon = await db.contrat.findFirst({ where: { coproprieteId: ctx.coproprieteId, libelle: { equals: libelle, mode: "insensitive" }, dateDebut: new Date(`${dateDebut}T00:00:00.000Z`) }, select: { id: true } });
  if (doublon) return { resultat: "IGNOREE", details: { contrat_id: doublon.id } };
  let prestataireId: string | null = null;
  const nomPresta = c.prestataire?.trim();
  if (nomPresta) {
    const p = await db.prestataire.findFirst({ where: { coproprieteId: ctx.coproprieteId, nom: { equals: nomPresta, mode: "insensitive" } }, select: { id: true } });
    prestataireId = p?.id ?? (await db.prestataire.create({ data: { coproprieteId: ctx.coproprieteId, nom: nomPresta, specialite: type.replace(/_/g, " ").toLowerCase(), contact: "" }, select: { id: true } })).id;
  }
  const montant = normaliserDecimal(c.montant_periode);
  const contrat = await db.contrat.create({ data: { coproprieteId: ctx.coproprieteId, prestataireId, type: type as (typeof TYPES_CONTRAT)[number], libelle, reference: c.reference?.trim() || null, dateDebut: new Date(`${dateDebut}T00:00:00.000Z`), dateFin: dateFin ? new Date(`${dateFin}T00:00:00.000Z`) : null, tacite: normaliserBooleen(c.tacite) ?? false, periodicite: periodicite as (typeof PERIODICITES)[number], montantPeriode: montant && money(montant).greaterThanOrEqualTo(0) ? montant : null, notes: c.notes?.trim() || null, creeParId: ctx.utilisateurId, statut: dateFin && dateFin < new Date().toISOString().slice(0, 10) ? "EXPIRE" : "ACTIF" } });
  await db.contratLog.create({ data: { coproprieteId: ctx.coproprieteId, contratId: contrat.id, type: "CREE", acteurId: ctx.utilisateurId, detailsJson: { import: true, type, libelle } } });
  return { resultat: "CREE", details: { contrat_id: contrat.id, prestataire_id: prestataireId } };
}

// ── VEHICULES_BADGES ─────────────────────────────────────────────────────────
async function vehiculesBadges(db: TenantDb, ctx: TenantContext, c: Champs, _o: OptionsImport, cache: CacheImport): Promise<ResultatLigne> {
  const numero = exiger(c, "numero", "N° lot");
  const lot = await lotParNumero(db, ctx, cache, numero);
  if (!lot) throw new LigneError(`Lot « ${numero} » inconnu — importez d'abord les lots.`);
  const details: Record<string, unknown> = { lot_id: lot.id };
  let cree = 0, ignore = 0;
  const plaque = c.immatriculation ? normaliserImmatriculation(c.immatriculation) : "";
  if (plaque) {
    if (!/^[A-Z0-9-]{2,20}$/.test(plaque)) throw new LigneError(`Immatriculation invalide : « ${c.immatriculation} ».`);
    const deja = await db.vehicule.findUnique({ where: { coproprieteId_immatriculation: { coproprieteId: ctx.coproprieteId, immatriculation: plaque } }, select: { id: true } });
    if (deja) { ignore++; details.vehicule_id = deja.id; }
    else { const v = await db.vehicule.create({ data: { coproprieteId: ctx.coproprieteId, lotId: lot.id, immatriculation: plaque, marque: c.marque?.trim() || null, couleur: c.couleur?.trim() || null, type: (normaliserEnum(c.type_vehicule, ["VOITURE", "MOTO", "UTILITAIRE"], ALIAS_VEHICULE) ?? "VOITURE") as "VOITURE" | "MOTO" | "UTILITAIRE" } }); cree++; details.vehicule_id = v.id; }
  }
  const identifiant = c.badge_identifiant?.trim();
  if (identifiant) {
    const type = (normaliserEnum(c.badge_type, ["BADGE_PIETON", "TELECOMMANDE_PARKING", "CLE_CAVE", "CARTE_ASCENSEUR"], ALIAS_BADGE) ?? "TELECOMMANDE_PARKING") as "BADGE_PIETON" | "TELECOMMANDE_PARKING" | "CLE_CAVE" | "CARTE_ASCENSEUR";
    const deja = await db.badge.findUnique({ where: { coproprieteId_type_identifiant: { coproprieteId: ctx.coproprieteId, type, identifiant } }, select: { id: true } });
    if (deja) { ignore++; details.badge_id = deja.id; }
    else { const caution = normaliserDecimal(c.caution); const b = await db.badge.create({ data: { coproprieteId: ctx.coproprieteId, lotId: lot.id, type, identifiant, remisLe: new Date(), remisParId: ctx.utilisateurId, cautionMontant: caution && money(caution).greaterThan(0) ? caution : null } }); cree++; details.badge_id = b.id; }
  }
  if (!plaque && !identifiant) throw new LigneError("Ni immatriculation ni badge sur la ligne.");
  return { resultat: cree > 0 ? "CREE" : ignore > 0 ? "IGNOREE" : "IGNOREE", details };
}

// ── PERSONNEL ────────────────────────────────────────────────────────────────
async function personnel(db: TenantDb, ctx: TenantContext, c: Champs, options: OptionsImport, cache: CacheImport, jobId: string): Promise<ResultatLigne> {
  const nom = exiger(c, "nom", "Nom");
  const telephone = normaliserTelephone(c.telephone);
  if (!telephone) throw new LigneError("Téléphone manquant ou invalide (format marocain 06/07 ou +212).");
  const poste = normaliserEnum(c.poste, ["GARDIEN", "AGENT_ENTRETIEN", "JARDINIER", "AGENT_SECURITE", "AUTRE"], ALIAS_POSTE) ?? "GARDIEN";
  const extra = { poste, date_embauche: normaliserDate(c.date_embauche), salaire_brut_mensuel: normaliserDecimal(c.salaire_brut_mensuel), numero_cnss: c.numero_cnss?.trim() || null };
  const existant = await db.utilisateur.findFirst({ where: { telephone, roles: { some: { coproprieteId: ctx.coproprieteId, actif: true, role: "GARDIEN" } } }, select: { id: true } }).catch(() => null);
  if (existant) {
    const fiche = await db.personnel.findFirst({ where: { coproprieteId: ctx.coproprieteId, utilisateurId: existant.id }, select: { id: true } });
    if (fiche) return { resultat: "IGNOREE", details: { personnel_id: fiche.id } };
    const p = await db.personnel.create({ data: { coproprieteId: ctx.coproprieteId, utilisateurId: existant.id, poste: poste as "GARDIEN" | "AGENT_ENTRETIEN" | "JARDINIER" | "AGENT_SECURITE" | "AUTRE", dateEmbauche: extra.date_embauche ? new Date(`${extra.date_embauche}T00:00:00.000Z`) : null, salaireBrutMensuel: extra.salaire_brut_mensuel, numeroCnss: extra.numero_cnss } });
    return { resultat: "CREE", details: { personnel_id: p.id } };
  }
  const inv = await invitationPreRemplie(db, ctx, cache, jobId, options, { role: "GARDIEN", nom, prenom: c.prenom?.trim() || null, telephone, email: c.email?.trim().toLowerCase() || null, langue: "FR", extra });
  return { resultat: inv.creee ? "CREE" : "IGNOREE", details: { invitation_id: inv.id } };
}

export const EXECUTEURS: Record<TypeImport, (db: TenantDb, ctx: TenantContext, c: Champs, o: OptionsImport, cache: CacheImport, jobId: string) => Promise<ResultatLigne>> = {
  LOTS_PROPRIETAIRES: lotsProprietaires,
  SOLDES_OUVERTURE: soldesOuverture,
  PRESTATAIRES: (db, ctx, c) => prestataires(db, ctx, c),
  CONTRATS: (db, ctx, c) => contrats(db, ctx, c),
  VEHICULES_BADGES: vehiculesBadges,
  PERSONNEL: personnel,
};
