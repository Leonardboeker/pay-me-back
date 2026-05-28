// scripts/fix-earth-static.mjs
// Process the nano-banana single-frame Earth image (pure black bg) into a
// transparent-bg PNG sized for the Act 2 orbit container.

import sharp from 'sharp';

const SOURCE = 'nanobanana-output/single_highquality_pixelart_imag.png';
const OUT = 'public/sprites/stitch/earth-static.png';
const SIZE = 512; // square; CSS scales to fit 176/288 container

const meta = await sharp(SOURCE).metadata();
console.log('Source:', meta.width, 'x', meta.height);

// Square-crop to the largest centered square
const crop = Math.min(meta.width, meta.height);
const cropLeft = Math.floor((meta.width - crop) / 2);
const cropTop = Math.floor((meta.height - crop) / 2);

const cropped = await sharp(SOURCE)
  .extract({ left: cropLeft, top: cropTop, width: crop, height: crop })
  .toBuffer();

// Chroma-key: pure black + near-black → transparent
const rgba = await sharp(cropped).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { data, info } = rgba;
const px = data;
let removed = 0;
for (let i = 0; i < px.length; i += 4) {
  const r = px[i], g = px[i + 1], b = px[i + 2];
  // Black or very dark space-background → transparent
  const brightness = (r + g + b) / 3;
  if (brightness < 25) {
    px[i + 3] = 0;
    removed++;
  }
}
console.log('Chroma-keyed', removed, 'pixels (' + Math.round((removed / (info.width * info.height)) * 100) + '%)');

await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
  .resize(SIZE, SIZE, { fit: 'fill', kernel: 'nearest' })
  .png({ compressionLevel: 9, palette: true, colors: 128, effort: 10 })
  .toFile(OUT);

const outBytes = (await sharp(OUT).toBuffer()).length;
console.log('Output:', OUT, '→', SIZE, 'x', SIZE, '(' + Math.round(outBytes / 1024) + ' KB)');
