/**
 * Genera los PNG de launcher en android/app/src/main/res/mipmap-* desde public/branding/icon.png.
 *
 * Iconos adaptativos: el lienzo es 108×108 dp; el sistema recorta con máscara circular/squircle.
 * Google recomienda que el arte importante quepa en ~72×72 dp centrados (72/108 del lienzo).
 * Antes usábamos cover a tamaño completo → el dibujo llegaba al borde y se cortaba por los lados.
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'public', 'branding', 'icon.png');

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Ratio zona segura Material / lienzo adaptive (72 dp de 108 dp). */
const SAFE_RATIO = 72 / 108;

const DENSITIES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const NAMES = ['ic_launcher_foreground.png', 'ic_launcher.png', 'ic_launcher_round.png'];

for (const [folder, size] of Object.entries(DENSITIES)) {
  const dir = path.join(root, 'android', 'app', 'src', 'main', 'res', folder);
  const inner = Math.round(size * SAFE_RATIO);
  const topPad = Math.floor((size - inner) / 2);
  const bottomPad = size - inner - topPad;
  const leftPad = Math.floor((size - inner) / 2);
  const rightPad = size - inner - leftPad;

  for (const name of NAMES) {
    const out = path.join(dir, name);
    await sharp(src)
      .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
      .extend({
        top: topPad,
        bottom: bottomPad,
        left: leftPad,
        right: rightPad,
        background: TRANSPARENT,
      })
      .png()
      .toFile(out);
  }
}

console.log('Launcher icons actualizados desde public/branding/icon.png');
