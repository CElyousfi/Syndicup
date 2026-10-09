#!/usr/bin/env node
/**
 * Sons PROVISOIRES de la couche Alive, synthétisés (aucune licence requise) — famille unique
 * « marimba / verre » : partiels inharmoniques à décroissance rapide, attaque douce, < 400 ms,
 * WAV mono 16 bits 22,05 kHz (< 30 Ko). À remplacer par les fichiers définitifs décrits dans
 * docs/SOUNDS.md — mêmes noms, mêmes formats.
 *
 *   node apps/mobile/tool/gen_sounds.mjs
 *
 * Écrit apps/mobile/assets/sounds/*.wav et apps/web/public/sounds/*.wav (identiques).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SR = 22050;

/** Note de marimba : fondamentale + partiels 3,9× et 9,2× (lames de bois), décroissance exp. */
function marimba(buf, startS, freq, { gain = 0.5, decay = 9, len = 0.32 } = {}) {
  const s0 = Math.floor(startS * SR);
  const n = Math.floor(len * SR);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / SR;
    const attack = Math.min(1, t / 0.004);
    const env = attack * Math.exp(-decay * t);
    const v =
      Math.sin(2 * Math.PI * freq * t) +
      0.28 * Math.sin(2 * Math.PI * freq * 3.9 * t) * Math.exp(-decay * 2.5 * t) +
      0.08 * Math.sin(2 * Math.PI * freq * 9.2 * t) * Math.exp(-decay * 5 * t);
    buf[s0 + i] += gain * env * v;
  }
}

/** Verre : partiels de cloche (1, 2,76, 5,4), plus longue résonance. */
function glass(buf, startS, freq, { gain = 0.35, decay = 7, len = 0.36 } = {}) {
  const s0 = Math.floor(startS * SR);
  const n = Math.floor(len * SR);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.003) * Math.exp(-decay * t);
    const v = Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(2 * Math.PI * freq * 2.76 * t) + 0.12 * Math.sin(2 * Math.PI * freq * 5.4 * t);
    buf[s0 + i] += gain * env * v;
  }
}

/** Coup sourd (porte de coffre qui se ferme) : sinus grave à glissando descendant. */
function thump(buf, startS, { gain = 0.6, len = 0.16 } = {}) {
  const s0 = Math.floor(startS * SR);
  const n = Math.floor(len * SR);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / SR;
    const f = 140 - 70 * (t / len);
    phase += (2 * Math.PI * f) / SR;
    buf[s0 + i] += gain * Math.min(1, t / 0.002) * Math.exp(-22 * t) * Math.sin(phase);
  }
}

const SONS = {
  // Confirmation discrète (case validée, choix enregistré).
  confirm: { dur: 0.16, draw: (b) => marimba(b, 0, 880, { len: 0.16, decay: 16 }) },
  // Succès : tierce montante.
  success: { dur: 0.32, draw: (b) => { marimba(b, 0, 659.25, { len: 0.2 }); marimba(b, 0.09, 987.77, { len: 0.23 }); } },
  // Envoyé : deux notes vives montantes (le message part).
  sent: { dur: 0.26, draw: (b) => { marimba(b, 0, 1046.5, { len: 0.12, decay: 18, gain: 0.4 }); marimba(b, 0.06, 1567.98, { len: 0.2, decay: 12, gain: 0.42 }); } },
  // Notification : tintement de verre.
  notify: { dur: 0.34, draw: (b) => glass(b, 0, 1318.5, { len: 0.34 }) },
  // Erreur : deux notes graves descendantes, douces (jamais une alarme).
  error: { dur: 0.28, draw: (b) => { marimba(b, 0, 440, { len: 0.14, decay: 14, gain: 0.45 }); marimba(b, 0.1, 349.23, { len: 0.18, decay: 12, gain: 0.45 }); } },
  // Signature (annexes conformes) : coup de coffre + accord majeur arpégé + verre.
  signature: {
    dur: 0.39,
    draw: (b) => {
      thump(b, 0);
      marimba(b, 0.04, 523.25, { len: 0.34, gain: 0.32 });
      marimba(b, 0.08, 659.25, { len: 0.3, gain: 0.3 });
      marimba(b, 0.12, 783.99, { len: 0.27, gain: 0.3 });
      glass(b, 0.16, 1046.5, { len: 0.23, gain: 0.22 });
    },
  },
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.7 / peak : 1; // −3 dB environ : marge et douceur
  // Fondu de sortie (12 ms) : jamais de clic en fin de fichier.
  const fade = Math.floor(0.012 * SR);
  samples.forEach((s, i) => {
    const f = i > samples.length - fade ? (samples.length - i) / fade : 1;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * norm * f * 32767))), i * 2);
  });
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const cibles = ["apps/mobile/assets/sounds", "apps/web/public/sounds"].map((d) => path.join(racine, d));
for (const d of cibles) mkdirSync(d, { recursive: true });
for (const [nom, { dur, draw }] of Object.entries(SONS)) {
  const buf = new Float64Array(Math.floor(dur * SR));
  draw(buf);
  const out = wav(buf);
  if (out.length > 30 * 1024 || dur > 0.4) throw new Error(`${nom} dépasse le budget (≤ 400 ms, ≤ 30 Ko)`);
  for (const d of cibles) writeFileSync(path.join(d, `${nom}.wav`), out);
  console.log(`✔ ${nom}.wav  ${Math.round(dur * 1000)} ms  ${(out.length / 1024).toFixed(1)} Ko`);
}
