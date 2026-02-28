---
name: generate-sound-effect
description: Generate game sound effects using the ElevenLabs Sound Effects API. Use when the user asks to generate, create, or produce sound effects, SFX, audio effects, or game audio.
---

# Generate Sound Effects

## Quick Start

When the user asks to generate game sound effects, use the ElevenLabs Sound Effects API via the `Shell` tool to run the provided Node.js script.

1.  **Formulate the prompt:** Construct a descriptive prompt in **English** based on the user's request. Include keywords for sound type, environment, intensity, and texture.
2.  **Execute the Generation Script:** Use the `Shell` tool to run the script. You can optionally provide a filename and duration.

```bash
# Basic usage (auto-generates filename like sfx_17390000000.mp3)
node .cursor/skills/generate-sound-effect/scripts/generate.js "Laser gun firing three quick shots"

# Specify an output filename
node .cursor/skills/generate-sound-effect/scripts/generate.js "Coins clinking and falling on a wooden table" "coin_drop.mp3"

# Specify filename and duration (0.5-22 seconds)
node .cursor/skills/generate-sound-effect/scripts/generate.js "Deep explosion with rumbling echo" "explosion.mp3" 5
```

3.  **Process Response:** The script automatically calls the API and saves the MP3 file to the `public/assets/` directory.
4.  **Notify User:** Show the downloaded asset path to the user.

## Prerequisites

The `ELEVENLABS_API_KEY` environment variable must be set. Get a free API key at [elevenlabs.io](https://elevenlabs.io).

```bash
export ELEVENLABS_API_KEY="your_key_here"
```

## Prompt Guidelines

For the best results, prompts should be descriptive and specific in **English**:

**Structure:** `[Sound source], [Action/behavior], [Environment/acoustics], [Texture/quality]`

**Example Prompts:**

| Category | Prompt |
|----------|--------|
| Combat | `Sword slashing through air with a metallic ring` |
| UI | `Soft chime notification sound, clean and digital` |
| Environment | `Forest ambience with birds chirping and wind through leaves` |
| Action | `Heavy footsteps on stone floor in a large echoing hall` |
| Impact | `Wooden crate breaking apart on impact` |
| Magic | `Mystical spell casting with rising energy and sparkle` |

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| prompt | Yes | — | English description of the sound effect |
| output_filename | No | `sfx_<timestamp>.mp3` | Output filename |
| duration_seconds | No | Auto | Duration in seconds (0.5–22) |
