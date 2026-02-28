#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const prompt = process.argv[2];
const outputName = process.argv[3];

if (!prompt) {
  console.error("Usage: node .cursor/skills/generate-game-art/scripts/generate.js '<prompt>' [output_filename]");
  process.exit(1);
}

const url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer b7d655b6-8171-40a8-bdbb-6441ce1b6758"
};
const data = {
  "model": "doubao-seedream-5-0-260128",
  "prompt": prompt,
  "sequential_image_generation": "disabled",
  "response_format": "url",
  "size": "2K",
  "stream": false,
  "watermark": false
};

async function generate() {
  try {
    console.log(`Generating image for prompt: "${prompt}"...`);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error: ${res.status} ${res.statusText}\n${errorText}`);
    }
    
    const result = await res.json();
    const imageUrl = result.data[0].url;
    
    console.log(`Success! Image URL: ${imageUrl}`);
    console.log(`Downloading image...`);
    
    // Download image
    const outDir = 'public/assets';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    const filename = outputName || `art_${Date.now()}.jpeg`;
    const dest = path.join(outDir, filename);
    
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.statusText}`);
    
    const fileStream = fs.createWriteStream(dest);
    
    if (imgRes.body) {
      const readable = Readable.fromWeb(imgRes.body);
      readable.pipe(fileStream);
      
      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });
      
      console.log(`Image saved to: ${dest}`);
    } else {
      throw new Error("Empty response body when fetching image.");
    }

  } catch (error) {
    console.error("Failed to generate or download image:", error);
    process.exit(1);
  }
}

generate();
