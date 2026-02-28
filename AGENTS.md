# AGENTS.md

## Cursor Cloud specific instructions

### Repository State

This repository (`tan-poker`) is in early development. No application framework or build tooling has been set up yet. The main asset so far is a Cursor skill for art generation.

### Development Environment

- **Node.js 18+** is required (for native `fetch` support). The VM has v22.
- No package manager lockfile or `package.json` exists yet — no `npm install` needed.
- No build, lint, or test commands available until application code is added.

### Skills

- **generate-game-art**: Generates game art via the Doubao Seedream API. Run from the workspace root:
  ```
  node .cursor/skills/generate-game-art/scripts/generate.js "<Chinese prompt>" [output_filename]
  ```
  Images are saved to `public/assets/`. See `.cursor/skills/generate-game-art/skill.md` for prompt guidelines.

- **generate-sound-effect**: Generates game sound effects locally via waveform synthesis (no API key needed). Run from the workspace root:
  ```
  node .cursor/skills/generate-sound-effect/scripts/generate.js <preset> [filename] [duration]
  node .cursor/skills/generate-sound-effect/scripts/generate.js --list
  ```
  15 presets available including poker-specific ones (`card_flip`, `chip_stack`, `win`, `lose`). WAV files are saved to `public/assets/`. See `.cursor/skills/generate-sound-effect/skill.md` for the full preset table.
