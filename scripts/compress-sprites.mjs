// scripts/compress-sprites.mjs
// Compress PNG sprites with sharp — Phase 4 perf-budget follow-up.
// Reduces Stitch-generated assets from MB-range to KB-range without
// visible quality loss for pixel art (palette quantization preserves
// distinct chunky colors; lossless integer scaling preserves crisp edges).
//
// Usage:
//   node scripts/compress-sprites.mjs                # compress all in public/sprites/
//   node scripts/compress-sprites.mjs --dry-run      # show savings without writing
//   node scripts/compress-sprites.mjs path/to/img.png  # compress one file
//
// Strategy:
//   - Use sharp's palette: true (PNG8) → quantize to ≤256 colors
//   - Set compressionLevel: 9 (max zlib) — slower but smaller
//   - Set effort: 10 → use the best compression search
//   - Skip files already < 100 KB (likely already optimized)

import sharp from 'sharp';
import { readdir, stat, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const SPRITES_DIR = 'public/sprites';
const SIZE_THRESHOLD_KB = 100; // skip files already small
const BACKUP_SUFFIX = '.orig.bak';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const singleFile = args.find((a) => !a.startsWith('--'));

async function compressOne(inputPath) {
  const buf = await sharp(inputPath).toBuffer();
  const inputKb = Math.round(buf.length / 1024);

  if (inputKb < SIZE_THRESHOLD_KB) {
    return { path: inputPath, skipped: true, reason: `already ${inputKb} KB`, inputKb };
  }

  // Get image metadata to preserve dimensions
  const meta = await sharp(inputPath).metadata();

  // PNG palette quantization — best for pixel art
  const compressed = await sharp(inputPath)
    .png({
      palette: true,
      quality: 100, // max palette quality (effective only with palette: true)
      colors: 256,
      compressionLevel: 9,
      effort: 10,
    })
    .toBuffer();

  const outputKb = Math.round(compressed.length / 1024);
  const savings = Math.round(((inputKb - outputKb) / inputKb) * 100);

  if (dryRun) {
    return { path: inputPath, dryRun: true, inputKb, outputKb, savings };
  }

  // Backup original (one-time, won't overwrite existing backup)
  const backupPath = inputPath + BACKUP_SUFFIX;
  if (!existsSync(backupPath)) {
    await copyFile(inputPath, backupPath);
  }

  // Only write if smaller (don't bloat files where palette quantization makes them bigger)
  if (outputKb >= inputKb) {
    return { path: inputPath, skipped: true, reason: 'compressed bigger', inputKb, outputKb };
  }

  await sharp(compressed).toFile(inputPath);
  return { path: inputPath, inputKb, outputKb, savings, backed_up: backupPath };
}

async function main() {
  let files = [];
  if (singleFile) {
    files = [singleFile];
  } else {
    // Walk sprites dir recursively
    async function walk(dir) {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else if (e.isFile() && e.name.endsWith('.png') && !e.name.endsWith(BACKUP_SUFFIX)) {
          files.push(full);
        }
      }
    }
    await walk(SPRITES_DIR);
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Compressing ${files.length} PNG files...\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let compressed = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const result = await compressOne(file);
      if (result.skipped) {
        console.log(`SKIP   ${basename(file).padEnd(40)} (${result.reason})`);
        skipped++;
        totalBefore += result.inputKb;
        totalAfter += result.inputKb;
      } else {
        const arrow = result.dryRun ? '~' : '→';
        console.log(
          `${result.dryRun ? 'WOULD' : 'DONE '}  ${basename(file).padEnd(40)} ${String(result.inputKb).padStart(5)} KB ${arrow} ${String(result.outputKb).padStart(5)} KB (-${result.savings}%)`,
        );
        compressed++;
        totalBefore += result.inputKb;
        totalAfter += result.outputKb;
      }
    } catch (err) {
      console.error(`ERR   ${basename(file)}: ${err.message}`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  const totalSavings = totalBefore > 0 ? Math.round(((totalBefore - totalAfter) / totalBefore) * 100) : 0;
  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Total: ${totalBefore} KB ${dryRun ? '→ would be' : '→'} ${totalAfter} KB (-${totalSavings}%)`,
  );
  console.log(`Compressed: ${compressed}  Skipped: ${skipped}`);
  if (!dryRun && compressed > 0) {
    console.log(`Originals backed up with ${BACKUP_SUFFIX} suffix (to restore: mv <file>${BACKUP_SUFFIX} <file>)`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
