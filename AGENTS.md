# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**Stacking Cards (叠牌)** — a Phaser 3 + TypeScript + Vite roguelike card game combining poker hand scoring with physics-based tower stacking.

### Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start Vite dev server (port 5173) |
| `pnpm lint` | TypeScript type checking (`tsc --noEmit`) |
| `pnpm build` | Production build (`tsc && vite build`) |
| `pnpm test` | Run Vitest unit tests |

### Architecture

- **Event-driven**: Card effects (enhance/challenge) register handlers on `GameEventSystem`, not hardcoded in scenes.
- **Phase state machine**: `PhaseManager` controls `LEVEL_START → PLAYER_PLACING → SCORING → LEVEL_END`.
- **Scene communication**: `BattleScene ↔ UIScene` via Phaser `registry` (data) + `EventBus` (actions).
- **Logic modules** (`src/logic/`) have zero Phaser dependency — safe to unit test with Vitest.

### Key Gotchas

- Card textures are generated procedurally in `BootScene` — no external image assets needed.
- `pnpm` is the package manager; `pnpm.onlyBuiltDependencies` in `package.json` allows esbuild postinstall.
- `GameEventSystem` is a singleton — must call `unregisterAll()` when leaving `BattleScene`.

### Skills

- **generate-game-art**: Generates game art via the Doubao Seedream API. See `.cursor/skills/generate-game-art/skill.md`.
- **generate-sound-effect**: Generates game SFX locally via waveform synthesis (no API key). See `.cursor/skills/generate-sound-effect/skill.md`.
