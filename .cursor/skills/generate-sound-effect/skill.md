---
name: generate-sound-effect
description: Generate game sound effects locally using waveform synthesis. No external API needed. Use when the user asks to generate, create, or produce sound effects, SFX, audio effects, or game audio.
---

# Generate Sound Effects

Pure Node.js waveform synthesizer — generates WAV files locally with zero dependencies and no API keys.

## Quick Start

```bash
# Generate a preset sound effect
node .cursor/skills/generate-sound-effect/scripts/generate.js <preset> [filename] [duration]

# List all available presets with descriptions
node .cursor/skills/generate-sound-effect/scripts/generate.js --list
```

## Examples

```bash
# Laser shot
node .cursor/skills/generate-sound-effect/scripts/generate.js laser "laser_shot.wav"

# 2-second explosion
node .cursor/skills/generate-sound-effect/scripts/generate.js explosion "boom.wav" 2

# Card dealing sound
node .cursor/skills/generate-sound-effect/scripts/generate.js card_flip "deal.wav"

# Poker chips
node .cursor/skills/generate-sound-effect/scripts/generate.js chip_stack "chips.wav"
```

Output is saved to `public/assets/`.

## Available Presets

| Preset | Duration | Description |
|--------|----------|-------------|
| `laser` | 0.4s | Sci-fi laser shot — descending sawtooth sweep |
| `explosion` | 1.5s | Heavy explosion with low rumble |
| `coin` | 0.25s | Coin pickup — quick two-note arpeggio |
| `jump` | 0.25s | Character jump — ascending sine sweep |
| `hit` | 0.2s | Impact hit — noise burst with low thud |
| `powerup` | 0.8s | Power-up — ascending sweep with vibrato shimmer |
| `click` | 0.05s | UI menu click |
| `beep` | 0.3s | Simple beep tone |
| `whoosh` | 0.45s | Fast whoosh — filtered noise sweep |
| `alert` | 0.6s | Two-tone alternating alert |
| `card_flip` | 0.15s | Card flip / deal — short snappy tick |
| `chip_stack` | 0.35s | Poker chips stacking — cascading clicks |
| `win` | 1.0s | Victory fanfare — ascending bright arpeggio |
| `lose` | 0.8s | Defeat — descending low tone |
| `timer` | 0.15s | Timer tick — short clock tick |

## How It Works

The script synthesizes audio using layered oscillators (sine, square, sawtooth, triangle, noise) with ADSR envelopes and frequency sweeps. Each preset defines one or more layers that are mixed together and encoded as a 44.1 kHz 16-bit mono WAV file.

## Adding New Presets

Edit the `PRESETS` object in `generate.js`. Each preset has:

- `duration` — length in seconds
- `layers[]` — array of oscillator layers, each with:
  - `wave` — `sine` | `square` | `sawtooth` | `triangle` | `noise`
  - `freq` — fixed Hz, `[start, end]` sweep, or `freqFn(t, progress)` function
  - `volume` — 0–1
  - `attack`, `decay`, `sustain`, `release` — ADSR envelope
  - `vibrato` — optional `{ rate, depth }` for LFO modulation
