/**
 * Dibujo decorativo del mundo horizontal tipo Sonic/Mario:
 *  - Parallax lateral multicapa con transiciones bioma → atardecer → noche según la X (progreso).
 *  - Tuberías Mario, muelles bouncy, colinas, bloques "?".
 *  - Castillo meta + poste con bandera que sube al completar.
 *  - Banderas de checkpoint cada sección solved.
 *
 * Casi todas las funciones reciben coordenadas de mundo, salvo `drawParallaxDecor` (pantalla).
 */

import type { GamePlatform } from './platformClimbGame';

function hash2(a: number, b: number): number {
  let x = (Math.imul(a, 374761393) ^ Math.imul(b, 668265263)) | 0;
  x = (x ^ (x >>> 13)) * 1274126177;
  return (x ^ (x >>> 16)) >>> 0;
}

function rnd01(seed: number): number {
  const x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  return (x >>> 0) / 4294967296;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Keyframes del cielo (progress01 ∈ [0..1]). */
const SKY_KEYFRAMES: Array<{ at: number; top: string; mid: string; bot: string }> = [
  { at: 0.0, top: '#7dd3fc', mid: '#38bdf8', bot: '#bae6fd' },
  { at: 0.35, top: '#fde68a', mid: '#fb923c', bot: '#f472b6' },
  { at: 0.7, top: '#6d28d9', mid: '#312e81', bot: '#1e1b4b' },
  { at: 1.0, top: '#020617', mid: '#0f172a', bot: '#1e1b4b' },
];

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const n = parseInt(s, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgb(c: [number, number, number], a = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function skyColors(progress01: number): {
  top: [number, number, number];
  mid: [number, number, number];
  bot: [number, number, number];
} {
  const k = SKY_KEYFRAMES;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i]!;
    const b = k[i + 1]!;
    if (progress01 >= a.at && progress01 <= b.at) {
      const t = (progress01 - a.at) / Math.max(0.0001, b.at - a.at);
      return {
        top: lerpRgb(hexToRgb(a.top), hexToRgb(b.top), t),
        mid: lerpRgb(hexToRgb(a.mid), hexToRgb(b.mid), t),
        bot: lerpRgb(hexToRgb(a.bot), hexToRgb(b.bot), t),
      };
    }
  }
  const last = k[k.length - 1]!;
  return { top: hexToRgb(last.top), mid: hexToRgb(last.mid), bot: hexToRgb(last.bot) };
}

function drawStars(ctx: CanvasRenderingContext2D, cw: number, ch: number, intensity: number, time: number, camX: number) {
  if (intensity <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = intensity;
  for (let i = 0; i < 80; i++) {
    const baseX = (i * 137) % (cw + 120);
    const sx = ((baseX - camX * 0.08) % (cw + 120) + cw + 120) % (cw + 120) - 60;
    const sy = (i * 91) % (ch * 0.68);
    const tw = 0.5 + Math.abs(Math.sin(time * 2 + i * 0.7)) * 0.7;
    ctx.fillStyle = i % 11 === 0 ? '#fde68a' : '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, (0.8 + (i % 3) * 0.6) * tw, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCloudShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, alpha: number, tint: string) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const r = w * 0.35;
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x - w * 0.28, y + r * 0.15, r * 0.85, 0, Math.PI * 2);
  ctx.arc(x + w * 0.28, y + r * 0.15, r * 0.85, 0, Math.PI * 2);
  ctx.arc(x - w * 0.1, y - r * 0.3, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x + w * 0.12, y - r * 0.25, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMountainRangeH(
  ctx: CanvasRenderingContext2D,
  cw: number,
  baseY: number,
  color: string,
  peakAmp: number,
  peakCount: number,
  camX: number,
  parallax: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  const shiftX = -(camX * parallax) % (cw / peakCount);
  ctx.moveTo(-120, baseY + 120);
  const step = (cw + 240) / peakCount;
  for (let i = 0; i <= peakCount + 1; i++) {
    const px = -120 + i * step + shiftX;
    const jitter = Math.sin(i * 2.13) * 0.45 + Math.cos(i * 1.31) * 0.55;
    const py = baseY - peakAmp * (0.55 + 0.45 * jitter);
    ctx.lineTo(px + step * 0.5, py);
    ctx.lineTo(px + step, baseY + Math.sin(i * 0.7) * 6);
  }
  ctx.lineTo(cw + 200, baseY + 120);
  ctx.closePath();
  ctx.fill();

  if (peakAmp > 80) {
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i <= peakCount + 1; i++) {
      const px = -120 + i * step + shiftX + step * 0.5;
      const jitter = Math.sin(i * 2.13) * 0.45 + Math.cos(i * 1.31) * 0.55;
      const py = baseY - peakAmp * (0.55 + 0.45 * jitter);
      ctx.beginPath();
      ctx.moveTo(px - 14, py + 10);
      ctx.lineTo(px, py + 2);
      ctx.lineTo(px + 14, py + 10);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Cielo + parallax horizontal. `progress01` ∈ [0..1] típicamente `camX / worldMaxX`.
 * Capas:
 *  - cielo con transición de color → luna/sol → estrellas si noche.
 *  - 2 cordilleras de montañas a distinta velocidad parallax.
 *  - colinas/duna cercana al primer plano.
 *  - nubes/nubarrones en varias capas.
 *  - castillo distante al fondo.
 */
export function drawParallaxDecor(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  progress01: number,
  time: number,
  camX: number,
  _mapLevel: number,
  _goalCastleProgress = 0
): void {
  const sk = skyColors(progress01);
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, rgb(sk.top));
  g.addColorStop(0.55, rgb(sk.mid));
  g.addColorStop(1, rgb(sk.bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, Math.ceil(cw), Math.ceil(ch));

  const nightFactor = clamp01((progress01 - 0.6) / 0.4);
  drawStars(ctx, cw, ch, nightFactor, time, camX);

  if (progress01 < 0.55) {
    const sunX = cw * 0.78 - (camX * 0.03) % (cw * 2);
    const sunY = ch * (0.18 + progress01 * 0.1);
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    sunGlow.addColorStop(0, 'rgba(255, 250, 210, 0.95)');
    sunGlow.addColorStop(0.3, 'rgba(253, 224, 71, 0.6)');
    sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 28 * (1 - progress01 * 0.3), 0, Math.PI * 2);
    ctx.fill();
  } else if (progress01 > 0.6) {
    const moonX = cw * 0.8 - (camX * 0.02) % (cw * 2);
    const moonY = ch * 0.22;
    ctx.fillStyle = 'rgba(248,250,252,0.95)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    ctx.beginPath();
    ctx.arc(moonX - 8, moonY - 4, 7, 0, Math.PI * 2);
    ctx.arc(moonX + 6, moonY + 8, 4, 0, Math.PI * 2);
    ctx.arc(moonX + 2, moonY - 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Se retiró el castillo distante flotante: el nuevo monumento final se dibuja en el plano de juego, no en parallax. */

  const mountainBaseY = ch * 0.62;
  const farColor = progress01 < 0.35 ? '#93c5fd' : progress01 < 0.7 ? '#a78bfa' : '#1e293b';
  const midColor = progress01 < 0.35 ? '#60a5fa' : progress01 < 0.7 ? '#7c3aed' : '#0f172a';
  drawMountainRangeH(ctx, cw, mountainBaseY - 12, farColor, 120, 5, camX, 0.12, 0.55);
  drawMountainRangeH(ctx, cw, mountainBaseY + 22, midColor, 90, 7, camX, 0.22, 0.75);

  const hillBaseY = ch * 0.78;
  const hillColor = progress01 < 0.35 ? '#16a34a' : progress01 < 0.7 ? '#6d28d9' : '#1e1b4b';
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = hillColor;
  ctx.beginPath();
  const hillShift = -(camX * 0.35) % 360;
  ctx.moveTo(-40, hillBaseY + 80);
  for (let x = -40 + hillShift; x < cw + 40; x += 180) {
    ctx.quadraticCurveTo(x + 60, hillBaseY - 36, x + 120, hillBaseY);
    ctx.quadraticCurveTo(x + 140, hillBaseY + 22, x + 180, hillBaseY - 4);
  }
  ctx.lineTo(cw + 40, ch + 20);
  ctx.lineTo(-40, ch + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const cloudAlpha = Math.max(0.18, 0.55 - progress01 * 0.45);
  const cloudTint = progress01 < 0.35
    ? 'rgba(255,255,255,0.92)'
    : progress01 < 0.7
      ? 'rgba(253, 186, 116, 0.88)'
      : 'rgba(203, 213, 225, 0.55)';
  for (let i = 0; i < 7; i++) {
    const baseX = (i * 211 + time * (6 + i * 2)) % (cw + 240);
    const sx = (baseX - (camX * 0.18) % (cw + 240) + cw + 240) % (cw + 240) - 120;
    const y = ch * 0.1 + ((i * 73) % (ch * 0.35));
    drawCloudShape(ctx, sx, y, 80 + (i % 3) * 22, cloudAlpha, cloudTint);
  }

  if (progress01 > 0.75) {
    for (let i = 0; i < 10; i++) {
      const baseX = (i * 211 + time * 50) % (cw + 200);
      const sx = ((baseX - (camX * 0.05) % (cw + 200)) + cw + 200) % (cw + 200) - 100;
      const sy = ch * 0.12 + ((i * 113) % (ch * 0.35));
      ctx.save();
      ctx.globalAlpha = 0.42;
      const grad = ctx.createLinearGradient(sx, sy, sx + 28, sy + 3);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, 28, 1.4);
      ctx.restore();
    }
  }
}

function drawBrickTexture(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  r: number,
  mortar: string,
  brickTop: string,
  brickBot: string,
  rows: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, w, h, r);
  ctx.clip();
  const rowH = h / rows;
  for (let row = 0; row < rows; row++) {
    const y0 = py + row * rowH;
    const offset = row % 2 === 0 ? 0 : rowH * 0.35;
    const bw = rowH * 1.15;
    for (let x = px - offset; x < px + w + bw; x += bw) {
      const g = ctx.createLinearGradient(x, y0, x + bw * 0.6, y0 + rowH);
      g.addColorStop(0, brickTop);
      g.addColorStop(1, brickBot);
      ctx.fillStyle = g;
      ctx.fillRect(x, y0 + 1, bw - 2, rowH - 2);
    }
  }
  ctx.strokeStyle = mortar;
  ctx.lineWidth = 1.2;
  for (let row = 0; row <= rows; row++) {
    const y = py + row * rowH;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + w, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Peldaño decorativo (stepping stone). */
export function drawStairStep(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  variant: number
): void {
  const v = ((variant % 6) + 6) % 6;
  const r = Math.min(7, h * 0.4);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(px + 3, py + 5, w, h, r);
  ctx.fill();

  const palettes: Array<{ top: string; bot: string; edgeTop: string; edgeBot: string; accent: string }> = [
    { top: '#fde68a', bot: '#b45309', edgeTop: '#fcd34d', edgeBot: '#92400e', accent: '#fef3c7' },
    { top: '#cbd5e1', bot: '#334155', edgeTop: '#e2e8f0', edgeBot: '#1e293b', accent: '#f8fafc' },
    { top: '#fdba74', bot: '#9a3412', edgeTop: '#fb923c', edgeBot: '#7c2d12', accent: '#fef3c7' },
    { top: '#7dd3fc', bot: '#0369a1', edgeTop: '#bae6fd', edgeBot: '#0c4a6e', accent: '#e0f2fe' },
    { top: '#d4a574', bot: '#78350f', edgeTop: '#fde68a', edgeBot: '#78350f', accent: '#fde68a' },
    { top: '#86efac', bot: '#14532d', edgeTop: '#bbf7d0', edgeBot: '#065f46', accent: '#ecfdf5' },
  ];
  const pal = palettes[v]!;
  const g = ctx.createLinearGradient(px, py, px, py + h);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.5, pal.edgeBot);
  g.addColorStop(1, pal.bot);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(px, py, w, h, r);
  ctx.fill();

  const topBand = Math.min(8, h * 0.42);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, w, topBand, [r, r, 2, 2] as unknown as number);
  ctx.clip();
  const cellW = 12;
  const cellsX = Math.ceil(w / cellW);
  for (let i = 0; i < cellsX; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(px + i * cellW, py, cellW, topBand);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(15,23,42,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, py, w, h, r);
  ctx.stroke();
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(px + 5, py + 2.5);
  ctx.lineTo(px + w - 5, py + 2.5);
  ctx.stroke();
}

/** Suelo largo (bioma según mapLevel). */
export function drawGroundTerrain(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  mapLevel: number
): void {
  const m = mapLevel % 4;
  const grassHue = 128 + m * 14;
  const soilTop = py + Math.min(22, h * 0.38);
  const gSoil = ctx.createLinearGradient(0, soilTop, 0, py + h);
  gSoil.addColorStop(0, '#78350f');
  gSoil.addColorStop(0.35, '#44403c');
  gSoil.addColorStop(1, '#1c1917');
  ctx.fillStyle = gSoil;
  ctx.fillRect(px, soilTop, w, py + h - soilTop);

  for (let x = px; x < px + w; x += 14) {
    const h2 = hash2(x, Math.round(py + mapLevel));
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(x + (h2 % 9), soilTop + 10 + (h2 % 14), 1.6 + (h2 % 2), 0, Math.PI * 2);
    ctx.fill();
  }

  const gGrass = ctx.createLinearGradient(0, py - 10, 0, soilTop + 6);
  gGrass.addColorStop(0, `hsl(${grassHue}, 66%, 56%)`);
  gGrass.addColorStop(0.55, `hsl(${grassHue + 8}, 60%, 40%)`);
  gGrass.addColorStop(1, `hsl(${grassHue + 4}, 48%, 30%)`);
  ctx.fillStyle = gGrass;
  ctx.fillRect(px, py, w, soilTop - py + 4);

  const checkerBand = 6;
  for (let x = px; x < px + w; x += 14) {
    const on = ((x / 14) | 0) % 2 === 0;
    ctx.fillStyle = on ? `hsl(${grassHue + 6}, 72%, 62%)` : `hsl(${grassHue - 4}, 52%, 34%)`;
    ctx.fillRect(x, py, 14, checkerBand);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let gx = px; gx < px + w; gx += 16) {
    const s = hash2(gx, py + mapLevel * 31);
    ctx.beginPath();
    ctx.moveTo(gx + 4, py + checkerBand + 2);
    ctx.quadraticCurveTo(gx + 2 + (s % 3), py + 2, gx + 6, py);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
}

/** Plataforma flotante tipo Sonic/Mario (ledge). `sectionIndex` controla paleta. */
export function drawLedgeTerrain(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  sectionIndex: number
): void {
  const palettes: Array<{ top: string; mid: string; bot: string; checker: string }> = [
    { top: '#bae6fd', mid: '#38bdf8', bot: '#075985', checker: '#0c4a6e' },
    { top: '#fde68a', mid: '#fb923c', bot: '#9a3412', checker: '#7c2d12' },
    { top: '#ddd6fe', mid: '#a78bfa', bot: '#4c1d95', checker: '#312e81' },
    { top: '#bbf7d0', mid: '#4ade80', bot: '#166534', checker: '#14532d' },
  ];
  const pal = palettes[sectionIndex % palettes.length]!;
  const r = 6;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(px + 3, py + 5, w, h, r);
  ctx.fill();

  const g = ctx.createLinearGradient(px, py, px, py + h);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.45, pal.mid);
  g.addColorStop(1, pal.bot);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(px, py, w, h, r);
  ctx.fill();

  const cellW = 14;
  const bandH = Math.min(7, h * 0.45);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, w, bandH, [r, r, 2, 2] as unknown as number);
  ctx.clip();
  for (let x = px; x < px + w; x += cellW) {
    const on = ((x / cellW) | 0) % 2 === 0;
    ctx.fillStyle = on ? 'rgba(255,255,255,0.45)' : pal.checker;
    ctx.fillRect(x, py, cellW, bandH);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py + bandH, w, h - bandH, 2);
  ctx.clip();
  const stripeW = 16;
  for (let x = px; x < px + w; x += stripeW) {
    ctx.fillStyle = ((x / stripeW) | 0) % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, py + bandH, stripeW, h - bandH);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(15,23,42,0.35)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(px, py, w, h, r);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 2);
  ctx.lineTo(px + w - 6, py + 2);
  ctx.stroke();
}

/**
 * Roca / pilar natural tallado: una pila orgánica de piedra gris-arena rematada con
 * una plataforma plana cubierta de musgo verde. Totalmente diferente a una tubería:
 * silueta irregular, textura de grietas, hongos en la base y hierba en el borde superior.
 * `py` es la Y del borde superior (por donde apoyará el jugador).
 * `timeSec` permite ligeras variaciones/animación (insectos, brillo del musgo).
 */
export function drawPipe(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  timeSec: number = 0
): void {
  const seed = Math.floor(px * 0.37 + py * 0.11);
  const rand = (i: number): number => {
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  /** Sombra proyectada ovalada bajo el pilar. */
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(px + w / 2 + 6, py + h + 2, w * 0.62, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /** Silueta orgánica: mezcla de varias rocas apiladas con bordes ondulados. */
  const capH = 16;
  ctx.save();
  ctx.beginPath();
  /** Perfil izquierdo: bulbos irregulares descendentes. */
  ctx.moveTo(px - 4, py + capH * 0.3);
  const steps = Math.max(3, Math.floor(h / 34));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = py + capH * 0.3 + t * (h - capH * 0.3);
    const bulge = 6 + (rand(i) - 0.5) * 10;
    ctx.quadraticCurveTo(px - 4 - bulge, y + 8, px - 2 + (rand(i + 11) - 0.5) * 4, y + 20);
  }
  ctx.lineTo(px - 2, py + h);
  ctx.lineTo(px + w + 2, py + h);
  /** Perfil derecho (subiendo). */
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const y = py + capH * 0.3 + t * (h - capH * 0.3);
    const bulge = 6 + (rand(i + 31) - 0.5) * 10;
    ctx.quadraticCurveTo(px + w + 4 + bulge, y + 12, px + w + 2 + (rand(i + 47) - 0.5) * 4, y - 4);
  }
  ctx.closePath();

  const bodyG = ctx.createLinearGradient(px, py, px + w, py + h);
  bodyG.addColorStop(0, '#9ca3af');
  bodyG.addColorStop(0.4, '#6b7280');
  bodyG.addColorStop(1, '#3f3f46');
  ctx.fillStyle = bodyG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,30,40,0.7)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();

  /** Grietas y manchas de roca. */
  ctx.strokeStyle = 'rgba(30,30,45,0.55)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 4; i++) {
    const cy = py + capH + 8 + i * ((h - capH - 8) / 4) + (rand(i + 5) - 0.5) * 4;
    ctx.beginPath();
    ctx.moveTo(px + 4 + rand(i + 2) * (w - 8), cy);
    ctx.lineTo(px + 6 + rand(i + 9) * (w - 10), cy + 4 + rand(i + 3) * 6);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.ellipse(px + w * 0.3, py + capH + h * 0.3, w * 0.18, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(px + w * 0.72, py + capH + h * 0.55, w * 0.12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  /** Tapa superior: roca plana con musgo verde. */
  ctx.save();
  ctx.beginPath();
  const capOver = 5;
  ctx.moveTo(px - capOver, py + capH * 0.9);
  ctx.quadraticCurveTo(px - capOver - 2, py + 4, px + 3, py + 2);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const xx = px + 3 + t * (w - 6);
    const yy = py + 2 + Math.sin(t * Math.PI) * -3 + (rand(i + 60) - 0.5) * 1.6;
    ctx.lineTo(xx, yy);
  }
  ctx.quadraticCurveTo(px + w + capOver + 2, py + 4, px + w + capOver, py + capH * 0.9);
  ctx.lineTo(px + w + capOver - 2, py + capH + 1);
  ctx.lineTo(px - capOver + 2, py + capH + 1);
  ctx.closePath();
  const capG = ctx.createLinearGradient(px, py, px, py + capH);
  capG.addColorStop(0, '#86a46c');
  capG.addColorStop(0.45, '#4d7c0f');
  capG.addColorStop(1, '#1a2e05');
  ctx.fillStyle = capG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,10,0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  /** Briznas de hierba asomando por el borde superior. */
  ctx.strokeStyle = 'rgba(190, 240, 140, 0.85)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    const xx = px + 4 + (i / 6) * (w - 8) + (rand(i + 80) - 0.5) * 3;
    const sway = Math.sin(timeSec * 1.8 + i) * 1.2;
    ctx.beginPath();
    ctx.moveTo(xx, py + 3);
    ctx.quadraticCurveTo(xx + sway, py - 3, xx + sway * 1.6 - 0.5, py - 8 - rand(i + 20) * 3);
    ctx.stroke();
  }

  /** Pequeño hongo decorativo en la base (sólo si el pilar es alto). */
  if (h > 70) {
    const mX = px + w * (0.18 + rand(7) * 0.6);
    const mY = py + h - 6;
    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.ellipse(mX, mY - 3, 4.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(mX - 1.5, mY - 2.5, 3, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(mX - 1.2, mY - 3.4, 0.6, 0, Math.PI * 2);
    ctx.arc(mX + 1.3, mY - 2.8, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Muelle bouncy. Se deforma cuando ha sido pisado recientemente. */
export function drawSpring(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  firedAt: number | undefined,
  time: number
): void {
  const dtFire = firedAt != null ? Math.max(0, time - firedAt) : 999;
  const compress = Math.max(0, 1 - dtFire * 5);
  const scaleY = 1 - compress * 0.55;
  const visH = h * scaleY;
  const topY = py + (h - visH);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(px + w / 2 + 2, py + h + 1, w * 0.55, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.roundRect(px - 4, py + h - 6, w + 8, 8, 2);
  ctx.fill();

  const coils = 4;
  const coilH = visH / coils;
  for (let i = 0; i < coils; i++) {
    const y0 = topY + i * coilH;
    const g = ctx.createLinearGradient(px, y0, px + w, y0 + coilH);
    g.addColorStop(0, '#cbd5e1');
    g.addColorStop(0.5, '#94a3b8');
    g.addColorStop(1, '#475569');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(px + 2, y0 + 1, w - 4, coilH - 2, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const plate = ctx.createLinearGradient(px, topY - 8, px + w, topY);
  plate.addColorStop(0, '#fecaca');
  plate.addColorStop(0.5, '#ef4444');
  plate.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.roundRect(px - 3, topY - 6, w + 6, 8, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,29,29,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (dtFire < 0.45) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - dtFire * 2.2);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px + w / 2, topY - 14, 10 + dtFire * 40, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7);
    ctx.stroke();
    ctx.restore();
  }
}

/** Colina decorativa (solo dibujo, sin colisión). */
export function drawHill(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  biome: number
): void {
  const hueBase = 128 + (biome % 4) * 14;
  const g = ctx.createLinearGradient(px, py, px, py + h);
  g.addColorStop(0, `hsl(${hueBase + 6}, 70%, 54%)`);
  g.addColorStop(0.55, `hsl(${hueBase}, 58%, 38%)`);
  g.addColorStop(1, `hsl(${hueBase - 6}, 48%, 26%)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(px, py + h);
  ctx.quadraticCurveTo(px, py + h * 0.1, px + w * 0.25, py + h * 0.15);
  ctx.quadraticCurveTo(px + w / 2, py - 10, px + w * 0.75, py + h * 0.15);
  ctx.quadraticCurveTo(px + w, py + h * 0.1, px + w, py + h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(px + 12, py + h * 0.3);
  ctx.quadraticCurveTo(px + w * 0.42, py + h * 0.05, px + w * 0.55, py + h * 0.2);
  ctx.stroke();

  ctx.fillStyle = `hsl(${hueBase + 14}, 80%, 64%)`;
  for (let i = 0; i < 4; i++) {
    const fx = px + (w / 5) * (i + 1) + ((hash2(Math.round(px), i) % 11) - 5);
    const fy = py + h - 10 - ((hash2(Math.round(px), i + 1) % 14));
    ctx.beginPath();
    ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Arco de meta: un gran arco ceremonial de piedra con pendón en la cima.
 * El jugador debe cruzarlo físicamente para terminar el nivel.
 * `armed` = true cuando la última operación ya está resuelta (pinta runas encendidas).
 * `beamPulse` = intensidad animada del haz luminoso (0..1).
 */
export function drawGoalArch(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  armed: boolean,
  time: number
): void {
  const archW = 170;
  const archH = 230;
  const archBaseY = groundY - 4;
  const archTopY = archBaseY - archH;
  const innerW = archW * 0.58;
  const innerTopY = archTopY + 46;
  const pillarW = (archW - innerW) / 2;
  const leftX = centerX - archW / 2;
  const rightX = centerX + archW / 2 - pillarW;

  /** Base del montículo. */
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(centerX, archBaseY + 4, archW * 0.7, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /** Pilares izquierdo y derecho. */
  const drawPillar = (x: number) => {
    const g = ctx.createLinearGradient(x, archTopY, x + pillarW, archBaseY);
    g.addColorStop(0, '#cbd5e1');
    g.addColorStop(0.45, '#94a3b8');
    g.addColorStop(1, '#475569');
    ctx.fillStyle = g;
    ctx.fillRect(x, archTopY + 28, pillarW, archH - 28);

    /** Zócalo ensanchado. */
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 6, archBaseY - 16, pillarW + 12, 18);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 10, archBaseY - 4, pillarW + 20, 4);

    /** Sillería horizontal. */
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 1.2;
    for (let y = archTopY + 58; y < archBaseY - 20; y += 30) {
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + pillarW - 1, y);
      ctx.stroke();
    }

    /** Runa luminosa sobre el pilar. */
    const runeY = archBaseY - archH * 0.55;
    ctx.save();
    const runeGlow = armed ? 0.85 + Math.sin(time * 3) * 0.15 : 0.2;
    ctx.fillStyle = `rgba(253, 224, 71, ${runeGlow})`;
    ctx.beginPath();
    ctx.moveTo(x + pillarW / 2, runeY - 7);
    ctx.lineTo(x + pillarW / 2 + 6, runeY);
    ctx.lineTo(x + pillarW / 2, runeY + 7);
    ctx.lineTo(x + pillarW / 2 - 6, runeY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };
  drawPillar(leftX);
  drawPillar(rightX);

  /** Arquitrabe superior curvado (arco de medio punto). */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(leftX, archTopY + 28);
  ctx.lineTo(leftX, innerTopY);
  ctx.arc(centerX, innerTopY, innerW / 2, Math.PI, 0, false);
  ctx.lineTo(leftX + archW, archTopY + 28);
  ctx.lineTo(leftX + archW - pillarW, archTopY + 28);
  ctx.arc(centerX, innerTopY, innerW / 2 - pillarW, 0, Math.PI, true);
  ctx.lineTo(leftX + pillarW, archTopY + 28);
  ctx.closePath();
  const topG = ctx.createLinearGradient(leftX, archTopY, leftX, archTopY + 70);
  topG.addColorStop(0, '#e2e8f0');
  topG.addColorStop(1, '#64748b');
  ctx.fillStyle = topG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,41,59,0.7)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();

  /** Clave de arco decorada (piedra central con gema). */
  const keyW = 18;
  const keyH = 24;
  ctx.fillStyle = '#334155';
  ctx.fillRect(centerX - keyW / 2, archTopY + 10, keyW, keyH);
  ctx.fillStyle = armed ? '#f59e0b' : '#a16207';
  ctx.beginPath();
  ctx.arc(centerX, archTopY + 22, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  /** Pendón/banderín ondeando en la cumbre. */
  const poleX = centerX;
  const poleTop = archTopY - 48;
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(poleX, archTopY + 4);
  ctx.lineTo(poleX, poleTop);
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(poleX, poleTop - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  const wave = Math.sin(time * 4) * 4;
  ctx.fillStyle = armed ? '#f97316' : '#92400e';
  ctx.beginPath();
  ctx.moveTo(poleX + 2, poleTop);
  ctx.quadraticCurveTo(poleX + 22 + wave, poleTop + 6, poleX + 40, poleTop + 12);
  ctx.quadraticCurveTo(poleX + 25 - wave, poleTop + 18, poleX + 2, poleTop + 26);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  /** Estrella en el banderín. */
  ctx.fillStyle = '#fef3c7';
  const starCx = poleX + 22;
  const starCy = poleTop + 14;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2) / 5;
    const rx = i % 2 === 0 ? 4 : 1.6;
    ctx.lineTo(starCx + Math.cos(a) * rx, starCy + Math.sin(a) * rx);
  }
  ctx.closePath();
  ctx.fill();

  /** Haz/portal luminoso dentro del arco cuando ya está "armado". */
  if (armed) {
    const beam = 0.55 + Math.sin(time * 2.8) * 0.2;
    ctx.save();
    const g = ctx.createLinearGradient(
      centerX - innerW / 2,
      archBaseY,
      centerX - innerW / 2,
      innerTopY
    );
    g.addColorStop(0, `rgba(253, 224, 71, ${beam * 0.6})`);
    g.addColorStop(0.5, `rgba(253, 186, 116, ${beam * 0.4})`);
    g.addColorStop(1, 'rgba(253, 224, 71, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(centerX - innerW / 2 + pillarW / 2, archBaseY - 10);
    ctx.lineTo(centerX - innerW / 2 + pillarW / 2, innerTopY);
    ctx.arc(centerX, innerTopY, innerW / 2 - pillarW / 2, Math.PI, 0, false);
    ctx.lineTo(centerX + innerW / 2 - pillarW / 2, archBaseY - 10);
    ctx.closePath();
    ctx.fill();

    /** Chispas ascendentes. */
    for (let i = 0; i < 6; i++) {
      const t = ((time * 0.6 + i / 6) % 1);
      const fx = centerX + Math.sin(i * 1.3 + time * 0.8) * (innerW / 2 - 20);
      const fy = archBaseY - t * (archH - 50);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(fx, fy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Hierba/plantas en la base. */
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 10; i++) {
    const gx = centerX - archW / 2 - 16 + i * ((archW + 32) / 9);
    ctx.beginPath();
    ctx.moveTo(gx, archBaseY - 1);
    ctx.quadraticCurveTo(gx + 2, archBaseY - 8, gx + 1, archBaseY - 14);
    ctx.stroke();
  }
}

/**
 * Monumento de meta al final del mundo. Sustituye al clásico castillo + banderita.
 * Diseño: zigurat de piedra azul-violeta con escalones, un orbe/cristal flotante
 * en la cúspide, runas brillando y pilares laterales. Sin banderas.
 * `openProgress` = 0..1 (0 sellado; 1 despertado al resolver la última multiplicación).
 */
export function drawGoalCastle(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  groundY: number,
  openProgress: number,
  time: number
): void {
  const cx = baseX;
  const groundTop = groundY;
  const awoken = Math.max(0, Math.min(1, openProgress));
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.8);

  ctx.save();

  /** Montículo mágico en la base. */
  ctx.fillStyle = '#0b1e3c';
  ctx.beginPath();
  ctx.moveTo(cx - 210, groundTop);
  ctx.quadraticCurveTo(cx, groundTop - 46, cx + 210, groundTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(79,70,229,0.18)';
  ctx.fill();

  /** Plataforma circular inferior con runas. */
  const plateY = groundTop - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, plateY + 10, 150, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  const plateG = ctx.createLinearGradient(cx - 120, plateY - 20, cx + 120, plateY + 4);
  plateG.addColorStop(0, '#1e293b');
  plateG.addColorStop(0.5, '#334155');
  plateG.addColorStop(1, '#1e293b');
  ctx.fillStyle = plateG;
  ctx.beginPath();
  ctx.ellipse(cx, plateY, 140, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const runeCount = 8;
  for (let i = 0; i < runeCount; i++) {
    const a = (i / runeCount) * Math.PI * 2 + time * 0.25;
    const rx = cx + Math.cos(a) * 118;
    const ry = plateY + Math.sin(a) * 14;
    const alpha = 0.3 + 0.55 * ((Math.sin(time * 2 + i) + 1) / 2) * (0.35 + 0.65 * awoken);
    ctx.fillStyle = `rgba(96,165,250,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(rx, ry, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Zigurat: cuatro escalones trapezoidales apilados. */
  const steps = [
    { w: 220, h: 40 },
    { w: 178, h: 38 },
    { w: 138, h: 36 },
    { w: 98, h: 34 },
  ];
  let stepBaseY = plateY - 4;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const topW = s.w - 18;
    const leftB = cx - s.w / 2;
    const rightB = cx + s.w / 2;
    const leftT = cx - topW / 2;
    const rightT = cx + topW / 2;
    const topY = stepBaseY - s.h;

    const sg = ctx.createLinearGradient(cx, topY, cx, stepBaseY);
    sg.addColorStop(0, i % 2 === 0 ? '#475569' : '#3f3f6a');
    sg.addColorStop(0.5, i % 2 === 0 ? '#334155' : '#2c2c52');
    sg.addColorStop(1, '#0f172a');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(leftB, stepBaseY);
    ctx.lineTo(leftT, topY);
    ctx.lineTo(rightT, topY);
    ctx.lineTo(rightB, stepBaseY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(226,232,240,0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(226,232,240,0.14)';
    ctx.lineWidth = 1;
    for (let bx = leftT + 14; bx < rightT - 6; bx += 18) {
      ctx.beginPath();
      ctx.moveTo(bx, topY + 4);
      ctx.lineTo(bx, stepBaseY - 4);
      ctx.stroke();
    }

    const glyphY = stepBaseY - s.h / 2;
    const glow = 0.25 + 0.55 * awoken * (0.6 + 0.4 * pulse);
    ctx.fillStyle = `rgba(125,211,252,${glow.toFixed(3)})`;
    ctx.font = 'bold 11px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(['\u2217', '\u00D7', '\u221A', '\u03A3'][i] ?? '\u2217', cx, glyphY);

    stepBaseY = topY;
  }

  /** Pilares laterales con remate. */
  const pillarY0 = plateY - 6;
  const pillarH = 96;
  const pillarW = 14;
  const drawPillar = (px: number) => {
    const pg = ctx.createLinearGradient(px - pillarW / 2, 0, px + pillarW / 2, 0);
    pg.addColorStop(0, '#1e293b');
    pg.addColorStop(0.5, '#475569');
    pg.addColorStop(1, '#1e293b');
    ctx.fillStyle = pg;
    ctx.fillRect(px - pillarW / 2, pillarY0 - pillarH, pillarW, pillarH);
    ctx.fillStyle = '#334155';
    ctx.fillRect(px - pillarW / 2 - 3, pillarY0 - pillarH - 6, pillarW + 6, 6);
    ctx.fillRect(px - pillarW / 2 - 4, pillarY0 - 4, pillarW + 8, 6);
    const sphereY = pillarY0 - pillarH - 14;
    const sphereG = ctx.createRadialGradient(px, sphereY, 1, px, sphereY, 8);
    sphereG.addColorStop(0, `rgba(186,230,253,${0.65 + 0.35 * awoken})`);
    sphereG.addColorStop(1, 'rgba(56,189,248,0.0)');
    ctx.fillStyle = sphereG;
    ctx.beginPath();
    ctx.arc(px, sphereY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(224,242,254,${0.8 * (0.55 + 0.45 * pulse)})`;
    ctx.beginPath();
    ctx.arc(px, sphereY, 2.6, 0, Math.PI * 2);
    ctx.fill();
  };
  drawPillar(cx - 96);
  drawPillar(cx + 96);

  /** Cristal/orbe flotante sobre la cúspide. */
  const apexY = stepBaseY;
  const float = Math.sin(time * 1.3) * 4;
  const crystalCX = cx;
  const crystalCY = apexY - 34 + float;
  const crystalR = 22;

  const beamA = 0.12 + 0.35 * awoken;
  if (beamA > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beamG = ctx.createLinearGradient(crystalCX, crystalCY, crystalCX, groundTop);
    beamG.addColorStop(0, `rgba(147,197,253,${beamA})`);
    beamG.addColorStop(1, 'rgba(147,197,253,0)');
    ctx.fillStyle = beamG;
    ctx.beginPath();
    ctx.moveTo(crystalCX - 18, crystalCY + 4);
    ctx.lineTo(crystalCX - 60, groundTop);
    ctx.lineTo(crystalCX + 60, groundTop);
    ctx.lineTo(crystalCX + 18, crystalCY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const haloG = ctx.createRadialGradient(
    crystalCX,
    crystalCY,
    2,
    crystalCX,
    crystalCY,
    crystalR + 28 + 6 * pulse
  );
  haloG.addColorStop(0, `rgba(191,219,254,${0.55 + 0.3 * awoken})`);
  haloG.addColorStop(1, 'rgba(59,130,246,0)');
  ctx.fillStyle = haloG;
  ctx.beginPath();
  ctx.arc(crystalCX, crystalCY, crystalR + 28 + 6 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(crystalCX, crystalCY);
  const facetG = ctx.createLinearGradient(-crystalR, -crystalR, crystalR, crystalR);
  facetG.addColorStop(0, '#e0f2fe');
  facetG.addColorStop(0.45, '#60a5fa');
  facetG.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = facetG;
  ctx.beginPath();
  ctx.moveTo(0, -crystalR - 6);
  ctx.lineTo(crystalR - 2, -crystalR * 0.2);
  ctx.lineTo(crystalR * 0.55, crystalR + 4);
  ctx.lineTo(-crystalR * 0.55, crystalR + 4);
  ctx.lineTo(-crystalR + 2, -crystalR * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -crystalR - 6);
  ctx.lineTo(0, crystalR + 4);
  ctx.moveTo(-crystalR + 2, -crystalR * 0.2);
  ctx.lineTo(crystalR - 2, -crystalR * 0.2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * pulse})`;
  ctx.beginPath();
  ctx.ellipse(-6, -crystalR * 0.5, 4, 9, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /** Orbes que orbitan el cristal cuando está "despierto". */
  const orbCount = 3;
  for (let i = 0; i < orbCount; i++) {
    const a = time * 1.2 + (i * Math.PI * 2) / orbCount;
    const ox = crystalCX + Math.cos(a) * (crystalR + 18);
    const oy = crystalCY + Math.sin(a) * (crystalR * 0.55) - 4;
    const alpha = 0.35 + 0.55 * awoken;
    const og = ctx.createRadialGradient(ox, oy, 0.5, ox, oy, 7);
    og.addColorStop(0, `rgba(253,224,71,${alpha})`);
    og.addColorStop(1, 'rgba(253,224,71,0)');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(ox, oy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.75 * alpha})`;
    ctx.beginPath();
    ctx.arc(ox, oy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, yBase: number, scale: number, hue: number): void {
  ctx.save();
  ctx.translate(x, yBase);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-5, -42, 10, 44);
  ctx.fillStyle = `hsl(${hue}, 55%, 32%)`;
  ctx.beginPath();
  ctx.arc(0, -52, 22, 0, Math.PI * 2);
  ctx.arc(-14, -44, 16, 0, Math.PI * 2);
  ctx.arc(14, -44, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue + 12}, 50%, 42%)`;
  ctx.beginPath();
  ctx.arc(0, -58, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(-4, -62, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, yBase: number, w: number, hue: number): void {
  ctx.fillStyle = `hsl(${hue}, 48%, 36%)`;
  ctx.beginPath();
  ctx.ellipse(x, yBase - 6, w * 0.45, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.25, yBase - 4, w * 0.28, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.28, yBase - 4, w * 0.3, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue + 20}, 55%, 50%)`;
  ctx.beginPath();
  ctx.ellipse(x - w * 0.15, yBase - 11, w * 0.15, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlowers(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  const cols = ['#f472b6', '#fbbf24', '#a78bfa', '#fb7185', '#34d399'];
  for (let i = 0; i < 5; i++) {
    const a = rnd01(seed + i * 17);
    const b = rnd01(seed + i * 23);
    if (a > 0.65) continue;
    ctx.fillStyle = cols[i % cols.length]!;
    ctx.beginPath();
    ctx.arc(x + b * 24 - 12, y + a * 8, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x + b * 24 - 12, y + a * 8, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Moneda giratoria decorativa. */
export function drawSpinningCoin(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  const s = Math.abs(Math.cos(phase));
  const bob = Math.sin(phase * 0.9) * 2.5;
  ctx.save();
  ctx.translate(x, y + bob);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 8 * s + 3, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  const w = 10 * Math.max(0.25, s);
  const g = ctx.createLinearGradient(-w, -10, w, 10);
  g.addColorStop(0, '#b45309');
  g.addColorStop(0.45, '#facc15');
  g.addColorStop(0.55, '#fef3c7');
  g.addColorStop(1, '#b45309');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (s > 0.5) {
    ctx.fillStyle = 'rgba(120, 53, 15, 0.9)';
    ctx.font = `bold ${Math.round(10 * s)}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.35, -4, w * 0.18, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bandera de checkpoint sobre el suelo. */
export function drawCheckpointFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  solved: boolean,
  time: number,
  zoneNumber: number
): void {
  ctx.save();
  ctx.translate(x, groundY);

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -82);
  ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, -84, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1;
  ctx.stroke();

  const flutter = Math.sin(time * (solved ? 6 : 2.2)) * (solved ? 6 : 3);
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.quadraticCurveTo(24 + flutter, -72, 34, -62);
  ctx.quadraticCurveTo(22, -58, 0, -56);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, -78, 34, -56);
  if (solved) {
    fg.addColorStop(0, '#f87171');
    fg.addColorStop(0.5, '#dc2626');
    fg.addColorStop(1, '#7f1d1d');
  } else {
    fg.addColorStop(0, '#93c5fd');
    fg.addColorStop(1, '#1e3a8a');
  }
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = solved ? '#fef3c7' : '#e0e7ff';
  ctx.font = 'bold 13px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(zoneNumber), 18, -66);

  ctx.fillStyle = 'rgba(15,23,42,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Bloque de pregunta (quiz) tipo Mario. */
export function drawQuizBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  state: 'idle' | 'solved' | 'stone',
  label: number,
  time: number,
  column: 0 | 1 | 2
): void {
  const rr = 10;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(px + 3, py + 6, w, h, rr);
  ctx.fill();
  ctx.restore();

  if (state === 'stone') {
    const g = ctx.createLinearGradient(px, py, px + w, py + h);
    g.addColorStop(0, '#a8a29e');
    g.addColorStop(0.5, '#57534e');
    g.addColorStop(1, '#292524');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(px, py, w, h, rr);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const yy = py + (h * (i + 1)) / 4;
      ctx.beginPath();
      ctx.moveTo(px + 8, yy);
      ctx.lineTo(px + w - 8, yy + (i % 2 === 0 ? 0 : -2));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
    ctx.font = 'bold 24px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), Math.round(px + w / 2), Math.round(py + h / 2));
    return;
  }

  if (state === 'solved') {
    const bob = Math.sin(time * 3.5) * 2;
    const g = ctx.createLinearGradient(px, py + bob, px + w, py + h + bob);
    g.addColorStop(0, '#bbf7d0');
    g.addColorStop(0.45, '#4ade80');
    g.addColorStop(1, '#15803d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(px, py + bob, w, h, rr);
    ctx.fill();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px + 3, py + 3 + bob, w - 6, h - 6, rr - 3);
    ctx.stroke();
    ctx.fillStyle = '#052e16';
    ctx.font = 'bold 24px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), Math.round(px + w / 2), Math.round(py + h / 2 + bob));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const cx = px + w * 0.82;
    const cy = py + h * 0.32 + bob;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx - 3, cy + 7);
    ctx.lineTo(cx + 9, cy - 8);
    ctx.stroke();
    const pulse = 0.4 + 0.3 * (Math.sin(time * 3) * 0.5 + 0.5);
    ctx.strokeStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px - 3, py + bob - 3, w + 6, h + 6, rr + 3);
    ctx.stroke();
    return;
  }

  const bob = Math.sin(time * 2.2 + column * 1.3) * 1.6;
  const colGrads = [
    ['#fb923c', '#f97316', '#9a3412'],
    ['#fde68a', '#f59e0b', '#92400e'],
    ['#f472b6', '#db2777', '#831843'],
  ];
  const pg = colGrads[column]!;
  const gy = py + bob;
  const g = ctx.createLinearGradient(px, gy, px + w, gy + h);
  g.addColorStop(0, pg[0]!);
  g.addColorStop(0.5, pg[1]!);
  g.addColorStop(1, pg[2]!);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(px, gy, w, h, rr);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(124, 45, 18, 0.9)';
  const corners: Array<[number, number]> = [
    [px + 5, gy + 5],
    [px + w - 5, gy + 5],
    [px + 5, gy + h - 5],
    [px + w - 5, gy + h - 5],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px + 2, gy + 2, w - 4, h * 0.36, rr - 3);
  ctx.clip();
  const shine = ctx.createLinearGradient(px, gy, px, gy + h * 0.4);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = shine;
  ctx.fillRect(px, gy, w, h * 0.4);
  ctx.restore();

  const tx = Math.round(px + w / 2);
  const ty = Math.round(gy + h / 2);
  ctx.font = 'bold 24px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.lineWidth = 4;
  ctx.strokeText(String(label), tx, ty);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(label), tx, ty);

  const starPhase = time * 3 + column;
  const sa = 0.55 + 0.45 * Math.sin(starPhase);
  ctx.save();
  ctx.globalAlpha = sa;
  ctx.fillStyle = '#fef9c3';
  const sx = px + w - 10;
  const sy = gy + 8;
  ctx.translate(sx, sy);
  ctx.rotate(starPhase * 0.5);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI * 2 * i) / 8;
    const rad = i % 2 === 0 ? 4 : 1.6;
    ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Árboles / arbustos / flores sobre suelos y voladizos (borde superior de la plataforma). */
export function drawNatureOnFloors(
  ctx: CanvasRenderingContext2D,
  platforms: readonly GamePlatform[],
  camX: number,
  viewW: number,
  camY: number,
  viewH: number,
  mapLevel: number,
  extraY?: (p: GamePlatform) => number
): void {
  const marginX = 220;
  const marginY = 120;
  const vLeft = camX - marginX;
  const vRight = camX + viewW + marginX;
  const vTop = camY - marginY;
  const vBot = camY + viewH + marginY;
  const biome = mapLevel % 5;
  const treeHue = 118 + biome * 14;
  const bushHue = 95 + biome * 10;

  for (const p of platforms) {
    if (p.kind !== 'ground' && p.kind !== 'ledge') continue;
    const dy = extraY?.(p) ?? 0;
    const topY = p.baseY + dy;
    if (topY < vTop || topY > vBot) continue;
    const pxR = p.baseX + p.w;
    if (pxR < vLeft || p.baseX > vRight) continue;

    const pw = p.w;
    const nSlots = p.kind === 'ground' ? Math.max(2, Math.floor(pw / 120)) : Math.max(1, Math.min(4, Math.floor(pw / 140)));
    for (let j = 0; j < nSlots; j++) {
      const h = hash2(Math.round(topY), j * 19 + mapLevel * 11 + Math.round(p.baseX));
      const t = pw / (nSlots + 1);
      const x = p.baseX + t * (j + 1) + ((h % 17) - 8);
      if (x < p.baseX + 28 || x > p.baseX + pw - 28) continue;
      if (x < vLeft - 40 || x > vRight + 40) continue;
      const kind = h % 5;
      if (kind <= 1) {
        drawTree(ctx, x, topY - 2, 0.72 + rnd01(h) * 0.22, treeHue + (h % 18));
      } else if (kind === 2 || kind === 3) {
        drawBush(ctx, x, topY - 6, 26 + (h % 18), bushHue);
      } else {
        drawFlowers(ctx, x - 10, topY - 6, h);
      }
    }
  }
}
