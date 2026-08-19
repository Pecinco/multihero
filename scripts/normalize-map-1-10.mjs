/**
 * Alinea 1-10map.jpg con el resto de segmentos (1792×2304, JPEG) y reduce peso.
 * Uso: node scripts/normalize-map-1-10.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP = path.join(__dirname, '../public/img/background/map/1-10map.jpg');
const W = 1792;
const H = 2304;

const inBuf = fs.readFileSync(MAP);
const out = await sharp(inBuf)
  .resize(W, H, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 86, chromaSubsampling: '4:2:0' })
  .toBuffer();
const tmp = `${MAP}.~tmp.jpg`;
fs.writeFileSync(tmp, out);
fs.copyFileSync(tmp, MAP);
fs.unlinkSync(tmp);
const m = await sharp(MAP).metadata();
console.log('1-10map.jpg →', m.width, 'x', m.height, `(${(out.length / 1024 / 1024).toFixed(2)} MB)`);
