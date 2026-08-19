/**
 * Convierte los PNG de héroes (2048×2048, ~5 MB) a JPG optimizados de 512×512
 * (~60-100 KB), aptos para compilar la app Capacitor sin inflar el bundle.
 *
 * Uso:  node scripts/resize-heros.mjs [--keep-png]
 *       --keep-png  No borra los PNG originales tras la conversión.
 */
import sharp from 'sharp';
import { readdir, unlink } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const heroDir = join(root, 'public', 'img', 'heros');

const TARGET_SIZE = 512;
const JPEG_QUALITY = 85;
const keepPng = process.argv.includes('--keep-png');

const files = (await readdir(heroDir)).filter(f => extname(f).toLowerCase() === '.png');

if (files.length === 0) {
  console.log('No se encontraron PNG en', heroDir);
  process.exit(0);
}

console.log(`Procesando ${files.length} imágenes PNG → JPG ${TARGET_SIZE}×${TARGET_SIZE} (quality ${JPEG_QUALITY})…\n`);

for (const file of files.sort()) {
  const pngPath = join(heroDir, file);
  const jpgName = basename(file, extname(file)) + '.jpg';
  const jpgPath = join(heroDir, jpgName);

  await sharp(pngPath)
    .flatten({ background: { r: 24, g: 24, b: 48 } })
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(jpgPath);

  const { size } = await import('fs').then(fs => fs.statSync(jpgPath));
  const kb = (size / 1024).toFixed(0);
  console.log(`  ✔ ${jpgName}  (${kb} KB)`);

  if (!keepPng) {
    await unlink(pngPath);
  }
}

console.log(`\nListo. ${files.length} héroes convertidos.${keepPng ? '' : ' PNG originales eliminados.'}`);
