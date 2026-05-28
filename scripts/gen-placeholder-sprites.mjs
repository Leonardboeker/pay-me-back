// scripts/gen-placeholder-sprites.mjs
// Emits placeholder sprite-sheets so layout/animation can be built BEFORE Leo opens Aseprite.
// Runs locally (NOT in CI). Per RESEARCH §Q4 — decouples layout work from artwork.
// Outputs colored rectangles labeled with a per-frame tint shift so motion is visible.
// Replace by real Aseprite exports (same paths, same dimensions) when artwork ready.
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCENES, FRAME_WIDTH, FRAME_HEIGHT } from './sprite-meta.mjs';

// Per-scene base color (warm-pixel-postkarte palette approximation)
const COLORS = {
  'scene1-leo-bcn': [232, 184, 110],   // warm sand (Barcelona)
  'scene2-takeoff': [180, 200, 220],   // sky blue (takeoff)
  'scene3-route':   [140, 180, 200],   // sea blue (world map)
  'scene4-reveal':  [200, 140, 100],   // sunset (reveal)
};

const outDir = resolve(process.cwd(), 'public/sprites');
mkdirSync(outDir, { recursive: true });

for (const s of SCENES) {
  const color = COLORS[s.name];
  const width = FRAME_WIDTH * s.frames;
  const height = FRAME_HEIGHT;
  const png = new PNG({ width, height });

  for (let f = 0; f < s.frames; f++) {
    // Per-frame tint shift so the animation is visibly cycling
    const tint = 0.80 + (f / s.frames) * 0.20;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < FRAME_WIDTH; x++) {
        const idx = (width * y + (f * FRAME_WIDTH + x)) << 2;
        png.data[idx]     = Math.floor(color[0] * tint);
        png.data[idx + 1] = Math.floor(color[1] * tint);
        png.data[idx + 2] = Math.floor(color[2] * tint);
        png.data[idx + 3] = 255;
      }
    }
    // Draw a frame-number indicator (8×8 dark square at top-left of each frame)
    for (let y = 8; y < 16; y++) {
      for (let x = 8 + f * 12; x < 8 + f * 12 + 8 && x < (f + 1) * FRAME_WIDTH; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx]     = 40;
        png.data[idx + 1] = 30;
        png.data[idx + 2] = 30;
        png.data[idx + 3] = 255;
      }
    }
  }
  const outPath = resolve(outDir, `${s.name}.png`);
  writeFileSync(outPath, PNG.sync.write(png));
  console.log(`Wrote ${outPath} (${width}×${height}, ${s.frames} frames)`);
}

// Backstory icon placeholder (32×32, single frame) — Aseprite-replaced later (UI-SPEC §8)
{
  const png = new PNG({ width: 32, height: 32 });
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const idx = (32 * y + x) << 2;
      png.data[idx]     = 220;   // light warm grey
      png.data[idx + 1] = 200;
      png.data[idx + 2] = 170;
      png.data[idx + 3] = 255;
    }
  }
  const outPath = resolve(outDir, 'icon-backstory.png');
  writeFileSync(outPath, PNG.sync.write(png));
  console.log(`Wrote ${outPath} (32×32, single frame)`);
}

console.log('\nPlaceholder sprites generated. Replace with Aseprite exports when ready.');
console.log('Each PNG follows: 320 × {frames} pixels horizontal strip, 180 px tall.');
