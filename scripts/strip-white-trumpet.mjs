/**
 * Elimina fondo blanco/gris / patrón tipo “transparencia falsa” del PNG de la trompeta.
 * Conserva tonos dorados/amarillos (canal B suele ser más bajo que R y G).
 */
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = join(root, 'public', 'img', 'victory-trumpet-flat.png');

/** Píxeles que claramente son oro/amarillo del instrumento — no tocar. */
function isInstrumentGold(r, g, b) {
  if (r < 170) return false;
  if (g < 130) return false;
  if (b > 210) return false;
  if (r - b < 25) return false;
  return true;
}

function shouldBeTransparent(r, g, b) {
  if (isInstrumentGold(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  const avg = (r + g + b) / 3;
  if (r >= 250 && g >= 250 && b >= 250) return true;
  if (spread < 32 && avg > 155) return true;
  if (spread < 45 && avg > 228) return true;
  return false;
}

async function main() {
  const input = await readFile(inputPath);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`Expected RGBA, got ${channels} channels`);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (shouldBeTransparent(r, g, b)) {
      data[i + 3] = 0;
    }
  }

  const fs = await import('fs/promises');
  const out = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await fs.writeFile(inputPath, out);
  console.log('OK:', inputPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
