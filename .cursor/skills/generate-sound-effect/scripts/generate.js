#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 44100;

// ── Waveform Oscillators ──

function osc(type, phase) {
  switch (type) {
    case 'sine':     return Math.sin(2 * Math.PI * phase);
    case 'square':   return Math.sin(2 * Math.PI * phase) >= 0 ? 1 : -1;
    case 'sawtooth': return 2 * (phase % 1) - 1;
    case 'triangle': { const p = phase % 1; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; }
    case 'noise':    return Math.random() * 2 - 1;
    default:         return Math.sin(2 * Math.PI * phase);
  }
}

// ── ADSR Envelope ──

function adsr(t, a, d, s, r, dur) {
  if (t < a) return t / a;
  t -= a;
  if (t < d) return 1 - (1 - s) * (t / d);
  t -= d;
  const hold = Math.max(0, dur - a - d - r);
  if (t < hold) return s;
  t -= hold;
  return t < r ? s * (1 - t / r) : 0;
}

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

// ── Synthesizer ──

function synthesize(config) {
  const dur = config.duration;
  const n = Math.floor(SAMPLE_RATE * dur);
  const out = new Float32Array(n);

  for (const L of config.layers) {
    let phase = 0;
    const vol     = L.volume   ?? 0.8;
    const attack  = L.attack   ?? 0.01;
    const decay   = L.decay    ?? 0.1;
    const sustain = L.sustain  ?? 0.5;
    const release = L.release  ?? 0.1;

    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const p = t / dur;

      let freq = Array.isArray(L.freq)
        ? lerp(L.freq[0], L.freq[1], p)
        : typeof L.freqFn === 'function' ? L.freqFn(t, p) : (L.freq || 440);

      if (L.vibrato) freq += Math.sin(2 * Math.PI * L.vibrato.rate * t) * L.vibrato.depth;

      phase += freq / SAMPLE_RATE;
      out[i] += osc(L.wave || 'sine', phase) * adsr(t, attack, decay, sustain, release, dur) * vol;
    }
  }

  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}

// ── Sound Effect Presets ──

const PRESETS = {
  laser: {
    duration: 0.4,
    desc: 'Sci-fi laser shot — descending sawtooth sweep',
    layers: [
      { wave: 'sawtooth', freq: [1500, 80], volume: 0.6, attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 },
    ],
  },

  explosion: {
    duration: 1.5,
    desc: 'Heavy explosion with low rumble',
    layers: [
      { wave: 'noise', freq: 100, volume: 0.8, attack: 0.002, decay: 1.2, sustain: 0, release: 0.3 },
      { wave: 'sine', freq: [80, 15], volume: 0.7, attack: 0.01, decay: 1.0, sustain: 0, release: 0.5 },
    ],
  },

  coin: {
    duration: 0.25,
    desc: 'Coin pickup — quick two-note arpeggio',
    layers: [
      { wave: 'square', freqFn: (_t, p) => p < 0.4 ? 988 : 1319, volume: 0.35, attack: 0.001, decay: 0.12, sustain: 0.3, release: 0.08 },
    ],
  },

  jump: {
    duration: 0.25,
    desc: 'Character jump — ascending sine sweep',
    layers: [
      { wave: 'sine', freq: [180, 700], volume: 0.6, attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
    ],
  },

  hit: {
    duration: 0.2,
    desc: 'Impact hit — noise burst with low thud',
    layers: [
      { wave: 'noise', freq: 200, volume: 0.7, attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      { wave: 'sine', freq: [300, 80], volume: 0.5, attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    ],
  },

  powerup: {
    duration: 0.8,
    desc: 'Power-up — ascending sweep with vibrato shimmer',
    layers: [
      { wave: 'sine', freq: [300, 1200], volume: 0.5, vibrato: { rate: 8, depth: 30 }, attack: 0.01, decay: 0.5, sustain: 0.3, release: 0.2 },
      { wave: 'triangle', freq: [600, 2400], volume: 0.25, attack: 0.05, decay: 0.5, sustain: 0.2, release: 0.2 },
    ],
  },

  click: {
    duration: 0.05,
    desc: 'UI menu click',
    layers: [
      { wave: 'sine', freq: 1200, volume: 0.5, attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    ],
  },

  beep: {
    duration: 0.3,
    desc: 'Simple beep tone',
    layers: [
      { wave: 'sine', freq: 880, volume: 0.5, attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.05 },
    ],
  },

  whoosh: {
    duration: 0.45,
    desc: 'Fast whoosh — filtered noise sweep',
    layers: [
      { wave: 'noise', freq: [3000, 100], volume: 0.5, attack: 0.05, decay: 0.3, sustain: 0, release: 0.1 },
      { wave: 'sine', freq: [600, 100], volume: 0.2, attack: 0.02, decay: 0.3, sustain: 0, release: 0.1 },
    ],
  },

  alert: {
    duration: 0.6,
    desc: 'Two-tone alternating alert',
    layers: [
      { wave: 'sine', freqFn: (t) => Math.floor(t / 0.1) % 2 === 0 ? 880 : 660, volume: 0.5, attack: 0.005, decay: 0.02, sustain: 0.8, release: 0.05 },
    ],
  },

  card_flip: {
    duration: 0.15,
    desc: 'Card flip / deal — short snappy tick',
    layers: [
      { wave: 'noise', freq: 800, volume: 0.4, attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      { wave: 'triangle', freq: [2000, 800], volume: 0.3, attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
    ],
  },

  chip_stack: {
    duration: 0.35,
    desc: 'Poker chips stacking — cascading clicks',
    layers: [
      { wave: 'noise', freq: 600, volume: 0.3, attack: 0.001, decay: 0.03, sustain: 0.1, release: 0.02 },
      { wave: 'sine', freqFn: (t) => [2200, 2600, 3000, 3400][Math.min(3, Math.floor(t / 0.07))], volume: 0.25, attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    ],
  },

  win: {
    duration: 1.0,
    desc: 'Victory fanfare — ascending bright arpeggio',
    layers: [
      { wave: 'triangle', freqFn: (_t, p) => [523, 659, 784, 1047][Math.min(3, Math.floor(p * 4))], volume: 0.45, attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.15 },
      { wave: 'sine', freqFn: (_t, p) => [523, 659, 784, 1047][Math.min(3, Math.floor(p * 4))] * 2, volume: 0.15, attack: 0.02, decay: 0.15, sustain: 0.3, release: 0.15 },
    ],
  },

  lose: {
    duration: 0.8,
    desc: 'Defeat — descending low tone',
    layers: [
      { wave: 'sine', freq: [400, 100], volume: 0.5, attack: 0.01, decay: 0.6, sustain: 0, release: 0.2 },
      { wave: 'sawtooth', freq: [300, 80], volume: 0.15, attack: 0.01, decay: 0.5, sustain: 0, release: 0.2 },
    ],
  },

  timer: {
    duration: 0.15,
    desc: 'Timer tick — short clock tick',
    layers: [
      { wave: 'sine', freq: 1000, volume: 0.4, attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    ],
  },
};

// ── WAV Encoder ──

function toWav(samples) {
  const bps = 2;
  const dataSize = samples.length * bps;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * bps, 28);
  buf.writeUInt16LE(bps, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * bps);
  }
  return buf;
}

// ── CLI ──

const presetName     = process.argv[2];
const outputName     = process.argv[3];
const durationArg    = process.argv[4] ? parseFloat(process.argv[4]) : null;

if (!presetName || presetName === '--list') {
  if (presetName === '--list') {
    console.log('Available presets:\n');
    for (const [name, cfg] of Object.entries(PRESETS)) {
      console.log(`  ${name.padEnd(14)} ${cfg.duration.toFixed(2)}s  ${cfg.desc}`);
    }
  } else {
    console.error("Usage: node .cursor/skills/generate-sound-effect/scripts/generate.js <preset> [filename] [duration]");
    console.error(`       node .cursor/skills/generate-sound-effect/scripts/generate.js --list`);
    console.error(`\nPresets: ${Object.keys(PRESETS).join(', ')}`);
  }
  process.exit(presetName === '--list' ? 0 : 1);
}

if (!PRESETS[presetName]) {
  console.error(`Unknown preset: "${presetName}"`);
  console.error(`Available: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}

const preset = PRESETS[presetName];
const config = { ...preset, layers: preset.layers };
if (durationArg && durationArg > 0) config.duration = durationArg;

console.log(`Generating "${presetName}" (${config.duration}s) ...`);

const samples = synthesize(config);
const wav = toWav(samples);

const outDir = 'public/assets';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const filename = outputName || `sfx_${presetName}_${Date.now()}.wav`;
const dest = path.join(outDir, filename);
fs.writeFileSync(dest, wav);

console.log(`Done → ${dest} (${(wav.length / 1024).toFixed(1)} KB)`);
