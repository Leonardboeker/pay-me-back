// scripts/gen-placeholder-character.mjs
// Generates placeholder PNGs so a fresh clone of the template builds + serves
// without 404s before the adopter has produced their own pixel art:
//
//   public/sprites/leo-character.png      hero character sprite (256x256, transparent bg)
//   public/sprites/leo-studio.png         studio background scene (1024x768)
//   public/sprites/avatars/placeholder.png   default leaderboard avatar (64x64)
//
// Replace each with your own pixel art when ready (same paths, same dimensions
// roughly). See the README for a nano-banana prompt template.
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve(process.cwd(), 'public/sprites');
mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(outDir, 'avatars'), { recursive: true });

// ── helper: write an RGBA PNG with a per-pixel callback ──
function writePixelPng(filename, width, height, fillFn) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b, a] = fillFn(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  writeFileSync(filename, PNG.sync.write(png));
  console.log(`  wrote ${filename} (${width}×${height})`);
}

// ── 1) Hero character: 256x256, friendly pixel blob on transparent background ──
{
  const W = 256, H = 256;
  // Simple character: head circle + body rectangle, warm palette
  const HEAD_CX = 128, HEAD_CY = 90, HEAD_R = 50;
  const BODY_X1 = 80, BODY_Y1 = 130, BODY_X2 = 176, BODY_Y2 = 230;

  writePixelPng(resolve(outDir, 'leo-character.png'), W, H, (x, y) => {
    // Head: warm beige
    const dx = x - HEAD_CX, dy = y - HEAD_CY;
    if (dx * dx + dy * dy <= HEAD_R * HEAD_R) {
      // Two simple eyes
      const eye1 = (x === HEAD_CX - 14 || x === HEAD_CX - 13) && y >= HEAD_CY - 6 && y <= HEAD_CY - 2;
      const eye2 = (x === HEAD_CX + 13 || x === HEAD_CX + 14) && y >= HEAD_CY - 6 && y <= HEAD_CY - 2;
      const mouth = y === HEAD_CY + 14 && x >= HEAD_CX - 10 && x <= HEAD_CX + 10;
      if (eye1 || eye2 || mouth) return [40, 30, 30, 255];
      return [232, 184, 110, 255];
    }
    // Body: rust orange
    if (x >= BODY_X1 && x <= BODY_X2 && y >= BODY_Y1 && y <= BODY_Y2) {
      return [200, 100, 70, 255];
    }
    // Transparent elsewhere
    return [0, 0, 0, 0];
  });
}

// ── 2) Studio scene background: 1024x768, simple gradient with horizon ──
{
  const W = 1024, H = 768;
  writePixelPng(resolve(outDir, 'leo-studio.png'), W, H, (x, y) => {
    // Sky: warm pink → sand gradient
    if (y < H * 0.6) {
      const t = y / (H * 0.6);
      const r = Math.floor(255 - t * 30);
      const g = Math.floor(200 - t * 40);
      const b = Math.floor(170 - t * 50);
      return [r, g, b, 255];
    }
    // Floor: muted brown
    const t = (y - H * 0.6) / (H * 0.4);
    const r = Math.floor(150 - t * 30);
    const g = Math.floor(110 - t * 30);
    const b = Math.floor(80 - t * 20);
    // Faint horizontal "floor lines"
    if (y % 64 === 0) return [r - 20, g - 20, b - 20, 255];
    return [r, g, b, 255];
  });
}

// ── 3) Default leaderboard avatar: 64x64, neutral monogram tile ──
{
  const W = 64, H = 64;
  writePixelPng(resolve(outDir, 'avatars', 'placeholder.png'), W, H, (x, y) => {
    // Border
    if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) return [40, 30, 30, 255];
    // Background: warm muted
    if (x < 4 || x >= W - 4 || y < 4 || y >= H - 4) return [232, 184, 110, 255];
    return [255, 240, 220, 255];
  });
}

console.log('\nPlaceholder character + scene + avatar generated.');
console.log('Replace with your own pixel art when ready. See README for prompts.');
