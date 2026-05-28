// scripts/verify-sprite-dimensions.mjs
// Verifies sprite-sheet PNG widths match frame counts from sprite-meta.mjs (Pitfall #5).
// Per RESEARCH §Code Examples verbatim.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { SCENES, FRAME_WIDTH, FRAME_HEIGHT } from './sprite-meta.mjs';

let failed = 0;
for (const scene of SCENES) {
  const path = resolve(process.cwd(), 'public/sprites', `${scene.name}.png`);
  try {
    const png = PNG.sync.read(readFileSync(path));
    const expectedWidth = FRAME_WIDTH * scene.frames;
    if (png.width !== expectedWidth || png.height !== FRAME_HEIGHT) {
      console.error(`FAIL: ${scene.name}.png is ${png.width}x${png.height}, expected ${expectedWidth}x${FRAME_HEIGHT}`);
      failed++;
    } else {
      console.log(`OK: ${scene.name}.png (${png.width}x${png.height}, ${scene.frames} frames)`);
    }
  } catch (e) {
    console.error(`FAIL: ${scene.name}.png missing or unreadable: ${e.message}`);
    failed++;
  }
}
process.exit(failed > 0 ? 1 : 0);
