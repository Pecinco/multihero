import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.join(__dirname, 'public/img/monsters');
const STAGE_DIR = path.join(IMG_DIR, '.resize-stage');

function psPath(p) {
  return "'" + p.replace(/'/g, "''") + "'";
}

async function resizeAll() {
  try {
    fs.mkdirSync(STAGE_DIR, { recursive: true });
    const files = fs.readdirSync(IMG_DIR).filter(
      (f) => f.endsWith('.png') && !f.startsWith('temp_')
    );
    console.log(`Found ${files.length} monster images to resize.`);
    for (const file of files) {
      const inputPath = path.join(IMG_DIR, file);
      const tmp = path.join(STAGE_DIR, `tmp-${process.pid}-${file}`);

      try {
        const inBuf = fs.readFileSync(inputPath);
        const out = await sharp(inBuf)
          .resize(256, 256, { fit: 'inside' })
          .png({ compressionLevel: 9, effort: 1 })
          .toBuffer();
        fs.writeFileSync(tmp, out);
        const cmd = `Copy-Item -LiteralPath ${psPath(tmp)} -Destination ${psPath(
          inputPath
        )} -Force; Remove-Item -LiteralPath ${psPath(tmp)} -Force`;
        execFileSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' });
        process.stdout.write('.');
      } catch (e) {
        console.error(`Error resizing ${file}`, e);
      }
    }
    console.log('\nAll done.');
  } catch (e) {
    console.error('Critical error in resize logic', e);
  }
}

resizeAll();
