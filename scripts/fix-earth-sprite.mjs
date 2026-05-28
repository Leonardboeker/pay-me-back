// scripts/fix-earth-sprite.mjs
// v4 — hardcoded per-row crop based on measured globe positions.
//
// Source: Leo's hand-curated 10-frame Earth grid (2752×1536, 2 rows × 5 cols, white bg, labels below globes).
// Measured globe positions (cell-relative, from per-frame bbox detection):
//   Row 1 globes: y-offset 35, height ~464 → vertical center at y=267
//   Row 2 globes: y-offset 150, height ~480 → vertical center at y=390
//   All globes: x-offset 35, width ~480 → horizontal center at cell-x 275
// → fixed crop of 500×500 centered on each globe captures full globe + small padding,
//   without ever including label-text pixels (labels start at y~520 in row 1 cell, y~650 in row 2).

import sharp from 'sharp';

const SOURCE = 'nanobanana-output/earth-10-frames.png';
const OUT = 'public/sprites/stitch/earth-rotation.png';
const FRAME = 288;
const N = 10;
const INNER = 500; // crop size per globe (includes small padding around 480px globes)

const meta = await sharp(SOURCE).metadata();
console.log('Source:', meta.width, 'x', meta.height);

const cellW = Math.floor(meta.width / 5);   // 550
const cellH = Math.floor(meta.height / 2);  // 768

// Per-row globe vertical center (in cell-relative pixels)
const ROW_GLOBE_CY = [267, 390];
// Globes are centered horizontally in cell (cell-x 275)
const GLOBE_CX = Math.floor(cellW / 2);
const HALF = Math.floor(INNER / 2);

function cropCoords(row, col) {
  const cellLeft = col * cellW;
  const cellTop = row * cellH;
  const cy = cellTop + ROW_GLOBE_CY[row];
  const cx = cellLeft + GLOBE_CX;
  return { left: cx - HALF, top: cy - HALF, width: INNER, height: INNER };
}

function isBackgroundPixel(r, g, b, a) {
  if (a < 128) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  // White/grey paper background — set transparent
  if (sat < 0.15 && max > 170) return true;
  return false;
}

async function makeFrameBuf(k) {
  const row = Math.floor(k / 5);
  const col = k % 5;
  const c = cropCoords(row, col);
  console.log(`  frame ${k+1}: crop (${c.left},${c.top}) ${c.width}×${c.height}`);

  const cropBuf = await sharp(SOURCE).extract(c).toBuffer();

  // Chroma-key white-ish background → transparent (preserve oceans/continents/coastlines)
  const rgba = await sharp(cropBuf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { data, info } = rgba;
  const px = data;
  for (let i = 0; i < px.length; i += 4) {
    if (isBackgroundPixel(px[i], px[i+1], px[i+2], px[i+3])) {
      px[i+3] = 0;
    }
  }

  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(FRAME, FRAME, { fit: 'fill', kernel: 'nearest' })
    .png()
    .toBuffer();
}

const frames = [];
for (let k = 0; k < N; k++) frames.push(await makeFrameBuf(k));

const composites = frames.map((buf, i) => ({ input: buf, left: i * FRAME, top: 0 }));
await sharp({
  create: { width: FRAME * N, height: FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .png({ compressionLevel: 9, palette: true, colors: 64, effort: 10 })
  .toFile(OUT);

const outBytes = (await sharp(OUT).toBuffer()).length;
console.log('Output:', OUT, '→', FRAME * N, 'x', FRAME, '(' + Math.round(outBytes / 1024) + ' KB)');
