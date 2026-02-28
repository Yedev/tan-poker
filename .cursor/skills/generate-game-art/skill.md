---
name: generate-game-art
description: Generate game art assets using the Doubao Seedream image generation API. Use when the user asks to generate, create, or draw game art, assets, characters, or backgrounds.
---

# Generate Game Art

## Quick Start

When the user asks to generate game art assets, use the Doubao Seedream API via the `Shell` tool to run the provided Node.js script.

1.  **Formulate the prompt:** Construct a highly descriptive prompt in **Chinese** based on the user's request. Include keywords for art style, lighting, atmosphere, and composition.
2.  **Execute the Generation Script:** Use the `Shell` tool to run the custom generation script. Replace `[YOUR_PROMPT]` with the generated Chinese prompt. You can optionally provide a filename as the second argument.

```bash
# Basic usage (auto-generates filename like art_17390000000.jpeg)
node .cursor/skills/generate-game-art/scripts/generate.js "[YOUR_PROMPT]"

# Or specify an output filename directly
node .cursor/skills/generate-game-art/scripts/generate.js "[YOUR_PROMPT]" "pixel_card.jpeg"
```

3.  **Process Response:** The script will automatically call the API, wait for the image to be generated, and download it directly to the `public/assets/` directory.
4.  **Notify User:** Show the downloaded asset path to the user.

## Prompt Guidelines

For the best results with `doubao-seedream-5-0-260128`, prompts should be structured with rich details:

**Structure:** `[Subject description], [Art style], [Lighting/Rendering], [Atmosphere/Color palette], [Composition/Perspective]`

**Example Prompt:**
`星际穿越，黑洞，黑洞里冲出一辆快支离破碎的复古列车，抢视觉冲击力，电影大片，末日既视感，动感，对比色，oc渲染，光线追踪，动态模糊，景深，超现实主义，深蓝，画面通过细腻的丰富的色彩层次塑造主体与场景，质感真实，暗黑风背景的光影效果营造出氛围，整体兼具艺术幻想感，夸张的广角透视效果，耀光，反射，极致的光影，强引力，吞噬`
