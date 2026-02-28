#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const prompt = process.argv[2];
const outputName = process.argv[3];
const durationArg = process.argv[4];

if (!prompt) {
  console.error("Usage: node .cursor/skills/generate-sound-effect/scripts/generate.js '<prompt>' [output_filename] [duration_seconds]");
  console.error("  prompt           - English description of the desired sound effect");
  console.error("  output_filename  - Optional filename (default: sfx_<timestamp>.mp3)");
  console.error("  duration_seconds - Optional duration 0.5-22 (default: auto)");
  process.exit(1);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Error: ELEVENLABS_API_KEY environment variable is not set.");
  console.error("Get a free API key at https://elevenlabs.io and set it:");
  console.error('  export ELEVENLABS_API_KEY="your_key_here"');
  process.exit(1);
}

const url = "https://api.elevenlabs.io/v1/sound-generation";
const headers = {
  "Content-Type": "application/json",
  "xi-api-key": apiKey
};

const body = {
  text: prompt,
  prompt_influence: 0.3
};

if (durationArg) {
  const dur = parseFloat(durationArg);
  if (dur >= 0.5 && dur <= 22) {
    body.duration_seconds = dur;
  } else {
    console.error("Warning: duration_seconds must be between 0.5 and 22. Using auto duration.");
  }
}

async function generate() {
  try {
    console.log(`Generating sound effect for: "${prompt}"...`);
    if (body.duration_seconds) {
      console.log(`Duration: ${body.duration_seconds}s`);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error: ${res.status} ${res.statusText}\n${errorText}`);
    }

    const outDir = 'public/assets';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const filename = outputName || `sfx_${Date.now()}.mp3`;
    const dest = path.join(outDir, filename);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(dest, buffer);

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`Success! Sound effect saved to: ${dest} (${sizeMB} MB)`);

  } catch (error) {
    console.error("Failed to generate sound effect:", error);
    process.exit(1);
  }
}

generate();
