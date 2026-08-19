/**
 * One-off: resize specific monster PNGs to match resize-monsters.mjs (256×256, fit inside).
 * Usage: node scripts/resize-monster-batch.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

function psPath(p) {
  return "'" + p.replace(/'/g, "''") + "'";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'public/img/monsters');
const STAGE_DIR = path.join(IMG_DIR, '.resize-stage');

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      '3-Lumi.png',
      '21-Milki.png',
      '41-Stari.png',
      '48-Finny.png',
      '50-Sharko.png',
      '52-Zeno.png',
      '78-Bouncy.png',
    ];

async function main() {
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  for (const file of files) {
    const inputPath = path.join(IMG_DIR, file);
    if (!fs.existsSync(inputPath)) {
      console.error('Missing:', inputPath);
      process.exitCode = 1;
      continue;
    }
    const inBuf = fs.readFileSync(inputPath);
    const out = await sharp(inBuf)
      .resize(256, 256, { fit: 'inside' })
      .png({ compressionLevel: 9, effort: 1 })
      .toBuffer();
    const base = `tmp-${/^\d+/.exec(file)?.[0] ?? 'm'}-${process.pid}.png`;
    const tmp = path.join(STAGE_DIR, base);
    fs.writeFileSync(tmp, out);
    // Node fs on this env often fails in-place; PowerShell copy -Force to same volume works.
    const src = psPath(tmp);
    const dst = psPath(inputPath);
    const cmd = `Copy-Item -LiteralPath ${src} -Destination ${dst} -Force; Remove-Item -LiteralPath ${src} -Force`;
    execFileSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' });
    const meta = await sharp(inputPath).metadata();
    console.log(file, '→', meta.width, 'x', meta.height);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
