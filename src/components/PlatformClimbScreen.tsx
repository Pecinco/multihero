import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PLATFORM_CLIMB_MAX_LIVES, PLATFORM_CLIMB_ROUNDS } from '../constants';
import { audio } from '../lib/audio';
import { cn } from '../lib/utils';
import type { UserState } from '../types';
import {
  drawCheckpointFlag,
  drawGoalArch,
  drawGoalCastle,
  drawGroundTerrain,
  drawHill,
  drawLedgeTerrain,
  drawNatureOnFloors,
  drawParallaxDecor,
  drawPipe,
  drawQuizBlock,
  drawSpinningCoin,
  drawSpring,
  drawStairStep,
} from '../lib/platformClimbDeco';
import {
  PLATFORM_PHYSICS,
  buildContinuousLevel,
  collectCoinsInRange,
  createPlayer,
  isQuizRowSolved,
  markQuizRowComplete,
  platformWorldX,
  platformWorldY,
  problemHasGates,
  resetQuizRow,
  stepSimulation,
  type Checkpoint,
  type CollectibleCoin,
  type ContinuousLevel,
  type GamePlatform,
  type PlayerBody,
} from '../lib/platformClimbGame';

export type PlatformClimbRunKind = 'daily' | 'practice';

type Props = {
  user: UserState;
  mapLevel: number;
  runKind: PlatformClimbRunKind;
  /** Monedas base (sin % tienda) al completar en modo daily; 0 si hoy ya hubo premio o en practice. */
  dailyBaseCoinsOnWin: number;
  onStructuredComplete: (payload: {
    runKind: PlatformClimbRunKind;
    /** Recompensa base por completar la misión (sin bonus de monedas). */
    baseCoins: number;
    /** Bonus por MatiCoins recogidas durante la partida. */
    bonusCoins: number;
  }) => void;
  /** Se invoca cuando el jugador agota las 3 vidas: cierre sin recompensa. */
  onGameOver: (payload: { runKind: PlatformClimbRunKind; bonusCoins: number }) => void;
  onExit: () => void;
  onUpdateHistory: (key: string, isCorrect: boolean, solveAtMapLevel: number) => void;
};

type SimRef = {
  player: PlayerBody;
  platforms: GamePlatform[];
  coins: CollectibleCoin[];
  time: number;
  ended: boolean;
  falling: boolean;
  groundY: number;
  /** Última pregunta ya resuelta: desbloquea la carrera final hacia el arco. */
  lastQuizSolved: boolean;
  /** Total recolectado (suma de bonus de monedas ya cogidas) — persiste entre respawns. */
  coinsCollected: number;
};

/** Caída del héroe (solo dibujo) antes de reiniciar; el escenario no se mueve. */
type HeroFallAnimState = { t0Ms: number; durationMs: number };

type HeroFallDraw = { shift: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  kind: 'dust' | 'spark' | 'ring' | 'burst';
  color: string;
  size: number;
  rot: number;
  rotSpeed: number;
};

/**
 * Paleta visual del héroe. Cada protagonista del juego (hero1..hero20) tiene
 * su propio set de colores para que el personaje del minijuego coincida con el
 * avatar seleccionado por el jugador.
 */
type HeroPalette = {
  /** Degradado de la capa (4 stops: claro → oscuro). */
  cape: [string, string, string, string];
  /** Degradado del torso / traje. */
  body: [string, string, string, string];
  /** Pernera: trazo principal y trim de estilo. */
  leg: string;
  legTrim: string;
  /** Brazo (manga). */
  arm: string;
  /** Color del pie (suela / bota). */
  bootDark: string;
  bootLight: string;
  /** Tono de piel (cara + manos). */
  skin: string;
  /** Color del pelo visible en la frente (fleco). */
  hair: string;
  /** Accesorio en la cabeza: 'crown' | 'headband' | 'star' | 'none'. */
  accessory: 'crown' | 'headband' | 'star' | 'visor' | 'bow' | 'none';
  /** Color del accesorio. */
  accessoryColor: string;
};

const HERO_PALETTES: Record<string, HeroPalette> = {
  hero1: {
    cape: ['#fef3c7', '#fcd34d', '#f59e0b', '#92400e'],
    body: ['#fde68a', '#f59e0b', '#b45309', '#78350f'],
    leg: '#7c2d12', legTrim: '#fbbf24', arm: '#b45309',
    bootDark: '#1c1917', bootLight: '#78350f',
    skin: '#fde4d6', hair: '#c2410c',
    accessory: 'crown', accessoryColor: '#fde047',
  },
  hero2: {
    cape: ['#fce7f3', '#f9a8d4', '#ec4899', '#9d174d'],
    body: ['#fbcfe8', '#f472b6', '#be185d', '#831843'],
    leg: '#831843', legTrim: '#f9a8d4', arm: '#be185d',
    bootDark: '#4c0519', bootLight: '#be123c',
    skin: '#fde4d6', hair: '#7c2d12',
    accessory: 'bow', accessoryColor: '#f472b6',
  },
  hero3: {
    cape: ['#fee2e2', '#fca5a5', '#ef4444', '#7f1d1d'],
    body: ['#e5e7eb', '#9ca3af', '#4b5563', '#1f2937'],
    leg: '#111827', legTrim: '#ef4444', arm: '#4b5563',
    bootDark: '#030712', bootLight: '#374151',
    skin: '#fde4d6', hair: '#0f172a',
    accessory: 'headband', accessoryColor: '#dc2626',
  },
  hero4: {
    cape: ['#cffafe', '#67e8f9', '#06b6d4', '#155e75'],
    body: ['#fed7aa', '#fb923c', '#ea580c', '#7c2d12'],
    leg: '#164e63', legTrim: '#fed7aa', arm: '#ea580c',
    bootDark: '#083344', bootLight: '#0e7490',
    skin: '#fde4d6', hair: '#7c2d12',
    accessory: 'bow', accessoryColor: '#06b6d4',
  },
  hero5: {
    cape: ['#dcfce7', '#86efac', '#16a34a', '#14532d'],
    body: ['#fef3c7', '#ca8a04', '#78350f', '#451a03'],
    leg: '#451a03', legTrim: '#84cc16', arm: '#78350f',
    bootDark: '#0c0a09', bootLight: '#44403c',
    skin: '#fde4d6', hair: '#78350f',
    accessory: 'headband', accessoryColor: '#15803d',
  },
  hero6: {
    cape: ['#ede9fe', '#c4b5fd', '#7c3aed', '#4c1d95'],
    body: ['#dbeafe', '#60a5fa', '#1d4ed8', '#1e3a8a'],
    leg: '#1e3a8a', legTrim: '#a5b4fc', arm: '#1d4ed8',
    bootDark: '#0f172a', bootLight: '#3730a3',
    skin: '#fde4d6', hair: '#581c87',
    accessory: 'star', accessoryColor: '#f5d0fe',
  },
  hero7: {
    cape: ['#fef9c3', '#fde047', '#a16207', '#451a03'],
    body: ['#1f2937', '#111827', '#030712', '#020617'],
    leg: '#030712', legTrim: '#facc15', arm: '#111827',
    bootDark: '#020617', bootLight: '#1f2937',
    skin: '#fde4d6', hair: '#0c0a09',
    accessory: 'visor', accessoryColor: '#facc15',
  },
  hero8: {
    cape: ['#ffffff', '#e0e7ff', '#818cf8', '#3730a3'],
    body: ['#f0f9ff', '#7dd3fc', '#0284c7', '#0c4a6e'],
    leg: '#0c4a6e', legTrim: '#bae6fd', arm: '#0284c7',
    bootDark: '#082f49', bootLight: '#0369a1',
    skin: '#fde4d6', hair: '#93c5fd',
    accessory: 'star', accessoryColor: '#ffffff',
  },
  hero9: {
    cape: ['#ecfccb', '#bef264', '#65a30d', '#365314'],
    body: ['#fef3c7', '#d6a76a', '#854d0e', '#451a03'],
    leg: '#451a03', legTrim: '#a3e635', arm: '#854d0e',
    bootDark: '#1c1917', bootLight: '#44403c',
    skin: '#fde4d6', hair: '#78350f',
    accessory: 'headband', accessoryColor: '#65a30d',
  },
  hero10: {
    cape: ['#f5f3ff', '#c4b5fd', '#6366f1', '#312e81'],
    body: ['#1e1b4b', '#312e81', '#1e1b4b', '#0b082a'],
    leg: '#0b082a', legTrim: '#a5b4fc', arm: '#312e81',
    bootDark: '#030712', bootLight: '#1e1b4b',
    skin: '#fde4d6', hair: '#e5e7eb',
    accessory: 'star', accessoryColor: '#f0abfc',
  },
  hero11: {
    cape: ['#1e1b4b', '#312e81', '#4338ca', '#020617'],
    body: ['#1e3a8a', '#1d4ed8', '#1e40af', '#0f172a'],
    leg: '#0f172a', legTrim: '#818cf8', arm: '#1d4ed8',
    bootDark: '#020617', bootLight: '#1e1b4b',
    skin: '#fde4d6', hair: '#0b0a1a',
    accessory: 'star', accessoryColor: '#facc15',
  },
  hero12: {
    cape: ['#fdf2f8', '#f9a8d4', '#d946ef', '#701a75'],
    body: ['#f5d0fe', '#e879f9', '#a21caf', '#4a044e'],
    leg: '#4a044e', legTrim: '#f0abfc', arm: '#a21caf',
    bootDark: '#2e1065', bootLight: '#6b21a8',
    skin: '#fde4d6', hair: '#c026d3',
    accessory: 'bow', accessoryColor: '#fb7185',
  },
  hero13: {
    cape: ['#fecaca', '#f87171', '#b91c1c', '#450a0a'],
    body: ['#1c1917', '#44403c', '#111827', '#020617'],
    leg: '#0c0a09', legTrim: '#ef4444', arm: '#292524',
    bootDark: '#030712', bootLight: '#57534e',
    skin: '#fde4d6', hair: '#0c0a09',
    accessory: 'headband', accessoryColor: '#991b1b',
  },
  hero14: {
    cape: ['#ecfdf5', '#6ee7b7', '#10b981', '#064e3b'],
    body: ['#d1fae5', '#34d399', '#059669', '#065f46'],
    leg: '#064e3b', legTrim: '#a7f3d0', arm: '#059669',
    bootDark: '#022c22', bootLight: '#047857',
    skin: '#fde4d6', hair: '#065f46',
    accessory: 'bow', accessoryColor: '#34d399',
  },
  hero15: {
    cape: ['#cffafe', '#22d3ee', '#0284c7', '#082f49'],
    body: ['#bae6fd', '#0ea5e9', '#0369a1', '#082f49'],
    leg: '#082f49', legTrim: '#67e8f9', arm: '#0369a1',
    bootDark: '#030712', bootLight: '#075985',
    skin: '#fde4d6', hair: '#164e63',
    accessory: 'headband', accessoryColor: '#0891b2',
  },
  hero16: {
    cape: ['#f5d0fe', '#e879f9', '#9333ea', '#3b0764'],
    body: ['#fae8ff', '#c084fc', '#7e22ce', '#3b0764'],
    leg: '#3b0764', legTrim: '#f0abfc', arm: '#7e22ce',
    bootDark: '#1a012e', bootLight: '#581c87',
    skin: '#fde4d6', hair: '#f0abfc',
    accessory: 'star', accessoryColor: '#facc15',
  },
  hero17: {
    cape: ['#fef3c7', '#fbbf24', '#b45309', '#451a03'],
    body: ['#fde68a', '#d97706', '#92400e', '#451a03'],
    leg: '#451a03', legTrim: '#fde047', arm: '#92400e',
    bootDark: '#1c1917', bootLight: '#78350f',
    skin: '#fde4d6', hair: '#451a03',
    accessory: 'crown', accessoryColor: '#fde047',
  },
  hero18: {
    cape: ['#fef9c3', '#fbcfe8', '#c4b5fd', '#67e8f9'],
    body: ['#fef3c7', '#fbcfe8', '#e9d5ff', '#cffafe'],
    leg: '#6b21a8', legTrim: '#fbcfe8', arm: '#a855f7',
    bootDark: '#4c1d95', bootLight: '#9333ea',
    skin: '#fde4d6', hair: '#f9a8d4',
    accessory: 'star', accessoryColor: '#fde047',
  },
  hero19: {
    cape: ['#fee2e2', '#fca5a5', '#b91c1c', '#450a0a'],
    body: ['#fde68a', '#fbbf24', '#b45309', '#451a03'],
    leg: '#450a0a', legTrim: '#fde047', arm: '#b45309',
    bootDark: '#020617', bootLight: '#7f1d1d',
    skin: '#fde4d6', hair: '#450a03',
    accessory: 'crown', accessoryColor: '#fde047',
  },
  hero20: {
    cape: ['#f5f3ff', '#a78bfa', '#6d28d9', '#1e1b4b'],
    body: ['#1e1b4b', '#4c1d95', '#2e1065', '#0b082a'],
    leg: '#0b082a', legTrim: '#a78bfa', arm: '#4c1d95',
    bootDark: '#020617', bootLight: '#1e1b4b',
    skin: '#fde4d6', hair: '#1e1b4b',
    accessory: 'visor', accessoryColor: '#a78bfa',
  },
};

const DEFAULT_PALETTE: HeroPalette = HERO_PALETTES.hero1!;
function getHeroPalette(heroId: string | undefined): HeroPalette {
  if (heroId && HERO_PALETTES[heroId]) return HERO_PALETTES[heroId]!;
  return DEFAULT_PALETTE;
}

/** Personaje vectorial estilo “runner” con volumen, sin bloques básicos. */
function drawHero(
  ctx: CanvasRenderingContext2D,
  pl: PlayerBody,
  t: number,
  facing: number,
  inputLeft: boolean,
  inputRight: boolean,
  palette: HeroPalette = DEFAULT_PALETTE
) {
  const x = Math.round(pl.x);
  const y = Math.round(pl.y);
  const w = pl.w;
  const h = pl.h;
  const moving = inputLeft || inputRight;
  const air = !pl.onGround;
  const walk = t * 10.8;
  const bob = pl.onGround && moving ? Math.sin(walk) * 2.2 : 0;
  const lean = air ? Math.sign(pl.vy + 0.08) * 0.12 : moving ? Math.sin(walk * 0.5) * 0.04 : 0;
  const legPhase = air ? Math.sin(t * 13) * 0.42 : moving ? Math.sin(walk) * 0.48 : 0.06;
  const armPhase = air ? Math.sin(t * 15) * 0.95 : moving ? Math.sin(walk + 0.75) * 0.58 : 0;

  ctx.save();
  ctx.translate(x + w / 2, y + h + bob);
  ctx.rotate(lean);
  if (facing < 0) ctx.scale(-1, 1);

  const shoulderY = -h * 0.56;
  const waistY = -h * 0.36;
  /** Torso más estrecho (menos “barrigón”). */
  const tw = w * 0.31;
  const neck = w * 0.2;
  const headCx = 0;
  /** Cabeza más grande (proporción “cabezón”, solo visual). */
  const headCy = -h * 0.9;
  const headRx = w * 0.3;
  const headRy = h * 0.27;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 4.5, w * 0.48, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const capeFlutter = air ? Math.sin(t * 14) * 10 : moving ? Math.sin(walk * 1.15) * 5 : Math.sin(t * 2.2) * 2;
  ctx.beginPath();
  ctx.moveTo(-neck * 0.45, shoulderY - 4);
  ctx.quadraticCurveTo(
    -tw - 32 + capeFlutter,
    shoulderY + h * 0.12,
    -tw - 26 + capeFlutter * 0.75,
    waistY + 22
  );
  ctx.quadraticCurveTo(-tw - 6 + capeFlutter * 0.35, waistY + 16, -tw * 0.35, waistY + 8);
  ctx.quadraticCurveTo(neck * 0.15, shoulderY + 6, neck * 0.35, shoulderY - 1);
  ctx.closePath();
  const capeG = ctx.createLinearGradient(-tw - 24, shoulderY - 8, 4, waistY + 24);
  capeG.addColorStop(0, palette.cape[0]);
  capeG.addColorStop(0.28, palette.cape[1]);
  capeG.addColorStop(0.62, palette.cape[2]);
  capeG.addColorStop(1, palette.cape[3]);
  ctx.fillStyle = capeG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.45)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-tw - 8 + capeFlutter * 0.4, shoulderY + 8);
  ctx.quadraticCurveTo(-tw - 18 + capeFlutter * 0.5, waistY - 2, -tw - 10 + capeFlutter * 0.3, waistY + 10);
  ctx.stroke();

  const drawLeg = (side: number, phase: number) => {
    const hipX = side * 3.5;
    const hipY = waistY + 3;
    const kneeX = side * 9 + phase * 11;
    const kneeY = -h * 0.17 + Math.abs(phase) * 4;
    const footX = side * 10 + phase * 15;
    const footY = 1.2;
    ctx.strokeStyle = palette.leg;
    ctx.lineWidth = 9.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
    ctx.stroke();
    ctx.strokeStyle = palette.legTrim;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
    ctx.stroke();
    ctx.fillStyle = palette.bootDark;
    ctx.beginPath();
    ctx.ellipse(footX, footY + 0.5, 5.2, 3.2, side * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.bootLight;
    ctx.beginPath();
    ctx.ellipse(footX, footY + 0.2, 3.4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  drawLeg(-1, legPhase);
  drawLeg(1, -legPhase * 0.92);

  ctx.beginPath();
  ctx.moveTo(-tw, waistY + 5);
  ctx.quadraticCurveTo(-tw * 1.02, (shoulderY + waistY) * 0.52, -neck, shoulderY + 3);
  ctx.quadraticCurveTo(-neck * 0.9, shoulderY - 2, -neck * 0.45, shoulderY - 9);
  ctx.quadraticCurveTo(0, shoulderY - 13, neck * 0.45, shoulderY - 9);
  ctx.quadraticCurveTo(neck * 0.9, shoulderY - 2, neck, shoulderY + 3);
  ctx.quadraticCurveTo(tw * 1.02, (shoulderY + waistY) * 0.52, tw, waistY + 5);
  ctx.quadraticCurveTo(tw * 0.8, waistY + 8, 0, waistY + 9);
  ctx.quadraticCurveTo(-tw * 0.8, waistY + 8, -tw, waistY + 5);
  ctx.closePath();

  const bodyG = ctx.createLinearGradient(0, shoulderY - 14, 0, waistY + 12);
  bodyG.addColorStop(0, palette.body[0]);
  bodyG.addColorStop(0.25, palette.body[1]);
  bodyG.addColorStop(0.55, palette.body[2]);
  bodyG.addColorStop(1, palette.body[3]);
  ctx.fillStyle = bodyG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-tw * 0.28, shoulderY + 5);
  ctx.quadraticCurveTo(0, shoulderY - 1, tw * 0.28, shoulderY + 5);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-tw + 1, waistY + 4);
  ctx.lineTo(tw - 1, waistY + 4);
  ctx.stroke();

  const handY = shoulderY + 20;
  const handYL = handY + armPhase * 3;
  const handYR = handY - armPhase * 2;
  ctx.strokeStyle = palette.arm;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-tw + 1, shoulderY + 2);
  ctx.quadraticCurveTo(-tw - 10 + armPhase * 11, shoulderY + 12, -tw - 6 + armPhase * 12, handYL);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tw - 1, shoulderY + 2);
  ctx.quadraticCurveTo(tw + 8 - armPhase * 7, shoulderY + 11, tw + 4 - armPhase * 6, handYR);
  ctx.stroke();

  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(-tw - 5 + armPhase * 12, handYL + 1, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tw + 3 - armPhase * 6, handYR + 1, 4, 0, Math.PI * 2);
  ctx.fill();

  if (air) {
    ctx.fillStyle = 'rgba(253, 224, 71, 0.4)';
    ctx.beginPath();
    ctx.moveTo(-tw - 2, shoulderY + 4);
    ctx.quadraticCurveTo(-tw - 28 - capeFlutter * 0.3, shoulderY - h * 0.08, -tw - 14, shoulderY + 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-tw - 4, shoulderY + 8);
    ctx.quadraticCurveTo(-tw - 24, shoulderY + 1, -tw - 16, shoulderY + 20);
    ctx.stroke();
  }

  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.ellipse(headCx, headCy, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.moveTo(headCx - headRx + 0.5, headCy - 2);
  ctx.bezierCurveTo(
    headCx - headRx * 0.4,
    headCy - headRy * 1.32,
    headCx + headRx * 0.4,
    headCy - headRy * 1.32,
    headCx + headRx - 0.5,
    headCy - 2
  );
  ctx.lineTo(headCx + headRx * 0.78, headCy - headRy * 0.12);
  ctx.quadraticCurveTo(headCx, headCy - headRy * 0.04, headCx - headRx * 0.78, headCy - headRy * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const eyeOffX = headRx * 0.22;
  const eyeOffY = headRy * 0.06;
  const eyeRx = 3.8;
  const eyeRy = 4.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(headCx - eyeOffX * 1.9, headCy - eyeOffY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
  ctx.ellipse(headCx + eyeOffX * 1.9, headCy - eyeOffY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(headCx - eyeOffX * 1.55, headCy + eyeOffY * 0.2, 1.65, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(headCx + eyeOffX * 2.05, headCy + eyeOffY * 0.2, 1.65, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(headCx - eyeOffX * 1.2, headCy - eyeOffY - 0.8, 0.85, 0, Math.PI * 2);
  ctx.arc(headCx + eyeOffX * 2.35, headCy - eyeOffY - 0.8, 0.85, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.arc(headCx, headCy + headRy * 0.18, headRx * 0.38, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();

  /** Accesorio en la cabeza según el héroe seleccionado. */
  const headTopY = headCy - headRy + 1;
  if (palette.accessory === 'crown') {
    ctx.fillStyle = palette.accessoryColor;
    ctx.beginPath();
    ctx.moveTo(headCx - headRx * 0.6, headTopY);
    ctx.lineTo(headCx - headRx * 0.35, headTopY - 7);
    ctx.lineTo(headCx - headRx * 0.12, headTopY - 2);
    ctx.lineTo(headCx, headTopY - 9);
    ctx.lineTo(headCx + headRx * 0.12, headTopY - 2);
    ctx.lineTo(headCx + headRx * 0.35, headTopY - 7);
    ctx.lineTo(headCx + headRx * 0.6, headTopY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.85)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(headCx, headTopY - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (palette.accessory === 'headband') {
    ctx.fillStyle = palette.accessoryColor;
    ctx.beginPath();
    ctx.ellipse(headCx, headTopY + 3, headRx * 0.95, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.strokeStyle = palette.accessoryColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(headCx - headRx * 0.85, headTopY + 5);
    ctx.quadraticCurveTo(headCx - headRx * 1.2, headTopY + 12, headCx - headRx * 0.95, headTopY + 20);
    ctx.stroke();
  } else if (palette.accessory === 'star') {
    ctx.fillStyle = palette.accessoryColor;
    ctx.beginPath();
    const scx = headCx;
    const scy = headTopY - 4;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 5 : 2.2;
      const px = scx + Math.cos(a) * r;
      const py = scy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (palette.accessory === 'visor') {
    ctx.fillStyle = palette.accessoryColor;
    ctx.beginPath();
    ctx.ellipse(headCx, headCy - 1, headRx * 0.85, headRy * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(headCx - headRx * 0.85, headCy - 2, headRx * 1.7, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(headCx + headRx * 0.22, headCy - 1, headRx * 0.18, headRy * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (palette.accessory === 'bow') {
    const bx = headCx - headRx * 0.32;
    const by = headTopY + 2;
    ctx.fillStyle = palette.accessoryColor;
    ctx.beginPath();
    ctx.ellipse(bx - 4, by, 4, 3, Math.PI * 0.15, 0, Math.PI * 2);
    ctx.ellipse(bx + 4, by, 4, 3, -Math.PI * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function clonePlatforms(ps: readonly GamePlatform[]): GamePlatform[] {
  return ps.map((p) => ({ ...p }));
}

export function PlatformClimbScreen({
  user,
  mapLevel,
  runKind,
  dailyBaseCoinsOnWin,
  onStructuredComplete,
  onGameOver,
  onExit,
  onUpdateHistory,
}: Props) {
  const { t } = useTranslation();
  /** El nivel no debe regenerarse al actualizar `user` (p. ej. tras onUpdateHistory) o la partida vuelve al suelo. */
  const userForLevelRef = useRef(user);
  const level = useMemo(
    () => buildContinuousLevel(userForLevelRef.current, PLATFORM_CLIMB_ROUNDS, mapLevel),
    [mapLevel]
  );
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  /** Monedas recolectadas (sólo para HUD). Se actualiza cuando se recoge una. */
  const [coinsHud, setCoinsHud] = useState(0);
  /** Vidas restantes. Empiezan en `PLATFORM_CLIMB_MAX_LIVES`; llegar a 0 = Game Over. */
  const [livesHud, setLivesHud] = useState(PLATFORM_CLIMB_MAX_LIVES);
  /** Aviso breve: se reinicia desde el suelo (no se sale del minijuego). */
  const [restartNotice, setRestartNotice] = useState(false);
  /** Modal final por haber agotado las vidas. */
  const [gameOverNotice, setGameOverNotice] = useState<null | { coins: number }>(null);
  /** Total de monedas del nivel (para el HUD "N / M"). */
  const totalCoins = useMemo(
    () => level.coins.reduce((s, c) => s + c.bonus, 0),
    [level]
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const simRef = useRef<SimRef | null>(null);
  const levelRef = useRef<ContinuousLevel>(level);
  /** Copia inicial de plataformas para restaurar tras fallo (quiz resuelto, piedras, etc.). */
  const initialPlatformsRef = useRef<GamePlatform[]>([]);
  const heroFallAnimRef = useRef<HeroFallAnimState | null>(null);
  const restartNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef({ left: false, right: false, jump: false });
  const jumpEdgeRef = useRef(false);
  const lastTsRef = useRef<number | null>(null);
  const mapLevelRef = useRef(mapLevel);
  const callbacksRef = useRef({ onStructuredComplete, onGameOver, onUpdateHistory, runKind, dailyBaseCoinsOnWin });
  const currentQuizIndexRef = useRef(0);
  /** Suaviza la cámara al resolver plataformas / desbloquear tramos */
  const camSmoothYRef = useRef<number | null>(null);
  /** Suavizado horizontal (scroll lateral tipo Mario/Sonic). */
  const camSmoothXRef = useRef<number | null>(null);
  /** Último checkpoint activo (punto de respawn). Arranca en el 0. */
  const lastCheckpointRef = useRef<Checkpoint>(level.checkpoints[0] ?? { x: 60, y: 510, solvedUpTo: 0 });
  /** Barrera visual para la bandera final del castillo (0..1). */
  const finishAnimRef = useRef(0);
  /** Efectos visuales: partículas y rastro del héroe. */
  const particlesRef = useRef<Particle[]>([]);
  const wasOnGroundRef = useRef(true);
  const screenShakeRef = useRef(0);
  /** Contador de vidas restantes (sincronizado con `livesHud` vía setLivesHud). */
  const livesRef = useRef(PLATFORM_CLIMB_MAX_LIVES);
  /** Estado visual pulsado (solo UI) para feedback en táctil — independiente de CSS :active. */
  const [pressed, setPressed] = useState<{ left: boolean; right: boolean; jump: boolean }>({
    left: false,
    right: false,
    jump: false,
  });
  /** Seguimiento de punteros activos por cada botón (permite multi-touch y gestos deslizados). */
  const activePointersRef = useRef<{ left: Set<number>; right: Set<number>; jump: Set<number> }>({
    left: new Set(),
    right: new Set(),
    jump: new Set(),
  });
  callbacksRef.current = { onStructuredComplete, onGameOver, onUpdateHistory, runKind, dailyBaseCoinsOnWin };
  mapLevelRef.current = mapLevel;
  levelRef.current = level;
  currentQuizIndexRef.current = currentQuizIndex;

  const applyRunReset = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.ended) return;

    /**
     * Descuento de vida tras la animación de caída. Si aún quedan intentos,
     * respawneamos en el último checkpoint; si no, Game Over sin recompensa de misión.
     */
    const remaining = Math.max(0, livesRef.current - 1);
    livesRef.current = remaining;
    setLivesHud(remaining);

    if (remaining <= 0) {
      sim.ended = true;
      setGameOverNotice({ coins: sim.coinsCollected });
      callbacksRef.current.onGameOver({
        runKind: callbacksRef.current.runKind,
        bonusCoins: sim.coinsCollected,
      });
      return;
    }

    const cp = lastCheckpointRef.current;
    /**
     * Respawn "suave" al último checkpoint: conservamos los quiz ya resueltos y
     * restablecemos sólo los bloqueos pendientes. La partida NO se reinicia por completo.
     */
    sim.player = createPlayer(cp.x, cp.y);
    for (const p of sim.platforms) {
      if (p.kind === 'quiz' && p.quizIndex != null && p.quizIndex >= cp.solvedUpTo) {
        resetQuizRow(sim.platforms, p.quizIndex);
      }
    }
    sim.ended = false;
    jumpEdgeRef.current = false;
    currentQuizIndexRef.current = cp.solvedUpTo;
    setCurrentQuizIndex(cp.solvedUpTo);
    camSmoothYRef.current = null;
    camSmoothXRef.current = null;
    particlesRef.current.length = 0;
    wasOnGroundRef.current = true;
    screenShakeRef.current = 0;
    setRestartNotice(true);
    if (restartNoticeTimerRef.current) clearTimeout(restartNoticeTimerRef.current);
    restartNoticeTimerRef.current = setTimeout(() => {
      setRestartNotice(false);
      restartNoticeTimerRef.current = null;
    }, 1400);
  }, []);

  useEffect(() => {
    setCurrentQuizIndex(0);
    setRestartNotice(false);
    if (restartNoticeTimerRef.current) {
      clearTimeout(restartNoticeTimerRef.current);
      restartNoticeTimerRef.current = null;
    }
    heroFallAnimRef.current = null;
    initialPlatformsRef.current = clonePlatforms(level.platforms);
    simRef.current = {
      player: createPlayer(level.spawnX, level.spawnY),
      platforms: clonePlatforms(initialPlatformsRef.current),
      coins: level.coins.map((c) => ({ ...c })),
      time: 0,
      ended: false,
      falling: false,
      groundY: level.groundY,
      lastQuizSolved: false,
      coinsCollected: 0,
    };
    setCoinsHud(0);
    livesRef.current = PLATFORM_CLIMB_MAX_LIVES;
    setLivesHud(PLATFORM_CLIMB_MAX_LIVES);
    setGameOverNotice(null);
    lastTsRef.current = null;
    camSmoothYRef.current = null;
    camSmoothXRef.current = null;
    lastCheckpointRef.current = level.checkpoints[0] ?? {
      x: level.spawnX,
      y: level.spawnY,
      solvedUpTo: 0,
    };
    finishAnimRef.current = 0;
  }, [level]);

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(el.clientWidth));
      const h = Math.max(1, Math.floor(el.clientHeight));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        inputRef.current.left = true;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        inputRef.current.right = true;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!inputRef.current.jump) jumpEdgeRef.current = true;
        inputRef.current.jump = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = false;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current.jump = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    if ('imageSmoothingQuality' in ctx) {
      (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: string }).imageSmoothingQuality = 'high';
    }

    /** Paleta del héroe basada en el avatar seleccionado. */
    const heroPalette = getHeroPalette(userForLevelRef.current.selectedAvatar);

    const drawParallax = (
      cw: number,
      ch: number,
      camX: number,
      time: number,
      lvl: ContinuousLevel,
      mapLevel: number
    ) => {
      const span = Math.max(1000, lvl.worldMaxX - lvl.worldMinX);
      const progress01 = Math.max(0, Math.min(1, (camX - lvl.worldMinX) / span));
      /** El castillo meta "crece" en el fondo cuando quedan 2-3 tramos. */
      const dist = Math.max(0, lvl.goalX - camX);
      const goalCastleProgress = Math.max(0, Math.min(1, 1 - dist / 2400));
      drawParallaxDecor(ctx, cw, ch, progress01, time, camX, mapLevel, goalCastleProgress);
    };

    const drawParticles = () => {
      for (const p of particlesRef.current) {
        const u = Math.max(0, Math.min(1, p.age / p.life));
        const alpha = 1 - u;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (p.kind === 'dust') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * (1 + u * 0.6), p.size * 0.6 * (1 + u), 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'spark') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const s = p.size * (1 - u * 0.4);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const ang = (Math.PI * 2 * i) / 8;
            const rad = i % 2 === 0 ? s : s * 0.45;
            ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.kind === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (1 - u) * 0.7 + 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + u * 3.5), 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'burst') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - u * 0.7), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };

    const drawScene = (
      _cw: number,
      _ch: number,
      scale: number,
      camX: number,
      camY: number,
      ox: number,
      oy: number,
      sim: SimRef,
      lvl: ContinuousLevel,
      mapLevel: number,
      viewW: number,
      viewH: number,
      fall: HeroFallDraw
    ) => {
      void _cw;
      void _ch;
      ctx.save();
      const shake = screenShakeRef.current;
      const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      ctx.translate(Math.round(ox) + sx, Math.round(oy) + sy);
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);

      const viewLeft = camX - 40;
      const viewRight = camX + viewW + 40;

      ctx.save();
      ctx.globalAlpha = 0.88;
      drawNatureOnFloors(ctx, sim.platforms, camX, viewW, camY, viewH, mapLevel);
      ctx.restore();

      /** Castillo final al final del mundo (con bandera que sube al completar). */
      if (lvl.goalX >= viewLeft - 400 && lvl.goalX <= viewRight + 400) {
        drawGoalCastle(ctx, lvl.goalX, lvl.groundY, finishAnimRef.current, sim.time);
      }

      /** Arco de meta físico: cruzarlo termina la partida. */
      if (lvl.archX >= viewLeft - 260 && lvl.archX <= viewRight + 260) {
        drawGoalArch(ctx, lvl.archX, lvl.groundY, sim.lastQuizSolved, sim.time);
      }

      for (const plat of sim.platforms) {
        const px = Math.round(platformWorldX(plat, sim.time));
        const py = Math.round(platformWorldY(plat, sim.time));
        if (px + plat.w < viewLeft || px > viewRight) continue;
        const locked =
          plat.blockedUntilQuizSolved !== undefined &&
          !isQuizRowSolved(sim.platforms, plat.blockedUntilQuizSolved);
        if (locked) {
          ctx.save();
          ctx.globalAlpha = 0.55;
        }

        if (plat.kind === 'ground') {
          drawGroundTerrain(ctx, px, py, plat.w, plat.h, mapLevel);
        } else if (plat.kind === 'stair') {
          drawStairStep(ctx, px, py, plat.w, plat.h, plat.variant ?? plat.label);
        } else if (plat.kind === 'ledge') {
          const sec = plat.blockedUntilQuizSolved ?? 0;
          drawLedgeTerrain(ctx, px, py, plat.w, plat.h, sec);
        } else if (plat.kind === 'pipe') {
          drawPipe(ctx, px, py, plat.w, plat.h, sim.time);
        } else if (plat.kind === 'spring') {
          drawSpring(ctx, px, py, plat.w, plat.h, plat.springFiredAt, sim.time);
        } else if (plat.kind === 'hill') {
          drawHill(ctx, px, py, plat.w, plat.h, lvl.biome);
        } else if (plat.kind === 'quiz') {
          const col: 0 | 1 | 2 = ((plat.variant ?? 0) % 3) as 0 | 1 | 2;
          const state: 'idle' | 'solved' | 'stone' = plat.quizWrongStone
            ? 'stone'
            : plat.solved
              ? 'solved'
              : 'idle';
          drawQuizBlock(ctx, px, py, plat.w, plat.h, state, plat.label, sim.time, col);
        }

        if (locked) ctx.restore();
      }

      /** MatiCoins recolectables (sobre las plataformas para que sean visibles). */
      for (const c of sim.coins) {
        if (c.collected) continue;
        if (c.x < viewLeft - 30 || c.x > viewRight + 30) continue;
        const bob = Math.sin(sim.time * 2.4 + c.x * 0.02) * 2.5;
        const phase = sim.time * 3.5 + c.x * 0.015;
        /** Aura brillante en monedas "detour" para invitar a desviarse. */
        if (c.kind === 'detour') {
          ctx.save();
          const glow = 0.4 + 0.22 * Math.sin(sim.time * 3 + c.x * 0.03);
          const g = ctx.createRadialGradient(c.x, c.y + bob, 0, c.x, c.y + bob, 22);
          g.addColorStop(0, `rgba(253, 224, 71, ${glow * 0.55})`);
          g.addColorStop(1, 'rgba(253, 224, 71, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(c.x, c.y + bob, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        drawSpinningCoin(ctx, c.x, c.y + bob, phase);
      }

      /** Banderas de checkpoint: una por tramo, justo al inicio del "suelo post-puerta". */
      for (let ci = 1; ci < lvl.checkpoints.length; ci++) {
        const cp = lvl.checkpoints[ci]!;
        if (cp.x < viewLeft - 40 || cp.x > viewRight + 40) continue;
        const solved = cp.solvedUpTo <= currentQuizIndexRef.current;
        drawCheckpointFlag(ctx, cp.x, lvl.groundY, solved, sim.time, cp.solvedUpTo);
      }

      const facing = inputRef.current.right ? 1 : inputRef.current.left ? -1 : 1;
      const plDraw: PlayerBody = { ...sim.player, y: sim.player.y + fall.shift };
      drawHero(ctx, plDraw, sim.time, facing, inputRef.current.left, inputRef.current.right, heroPalette);

      drawParticles();

      ctx.restore();
    };

    const spawnDust = (x: number, y: number, count: number, strength = 1) => {
      for (let i = 0; i < count; i++) {
        const ang = Math.PI + (Math.random() - 0.5) * Math.PI * 0.9;
        const sp = 30 + Math.random() * 90 * strength;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 40,
          age: 0,
          life: 0.45 + Math.random() * 0.25,
          kind: 'dust',
          color: `rgba(${230 + ((Math.random() * 20) | 0)}, ${210 + ((Math.random() * 20) | 0)}, 170, 0.85)`,
          size: 3 + Math.random() * 3,
          rot: 0,
          rotSpeed: 0,
        });
      }
    };

    const spawnSparkBurst = (x: number, y: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 220;
        const palette = ['#facc15', '#fef08a', '#fde047', '#ffffff', '#fb923c', '#22d3ee', '#a3e635'];
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 30,
          age: 0,
          life: 0.6 + Math.random() * 0.5,
          kind: 'spark',
          color: palette[(Math.random() * palette.length) | 0]!,
          size: 3 + Math.random() * 3,
          rot: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 10,
        });
      }
      particlesRef.current.push({
        x,
        y,
        vx: 0,
        vy: 0,
        age: 0,
        life: 0.55,
        kind: 'ring',
        color: 'rgba(253, 224, 71, 0.9)',
        size: 14,
        rot: 0,
        rotSpeed: 0,
      });
      particlesRef.current.push({
        x,
        y,
        vx: 0,
        vy: 0,
        age: 0,
        life: 0.8,
        kind: 'ring',
        color: 'rgba(255, 255, 255, 0.8)',
        size: 10,
        rot: 0,
        rotSpeed: 0,
      });
    };

    const spawnFallBurst = (x: number, y: number) => {
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const sp = 120 + Math.random() * 180;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          age: 0,
          life: 0.6 + Math.random() * 0.4,
          kind: 'burst',
          color: 'rgba(148, 163, 184, 0.9)',
          size: 4 + Math.random() * 3,
          rot: 0,
          rotSpeed: 0,
        });
      }
    };

    const updateParticles = (dt: number) => {
      const arr = particlesRef.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i]!;
        p.age += dt;
        if (p.age >= p.life) {
          arr.splice(i, 1);
          continue;
        }
        if (p.kind !== 'ring') {
          p.vy += 620 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.rotSpeed * dt;
        }
      }
    };

    const tick = (ts: number) => {
      const sim = simRef.current;
      const lvl = levelRef.current;
      if (!sim) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const last = lastTsRef.current ?? ts;
      lastTsRef.current = ts;
      const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000));

      const heroFalling = heroFallAnimRef.current !== null;

      if (!sim.ended && !heroFalling) {
        const jump = jumpEdgeRef.current;
        jumpEdgeRef.current = false;
        const physicsTime = sim.time;
        const wasOnGround = sim.player.onGround;

        const step = stepSimulation(
          sim.player,
          dt,
          { ...inputRef.current, jump },
          sim.platforms,
          physicsTime,
          sim.groundY,
          lvl.worldMinX,
          lvl.worldMaxX
        );
        sim.time += dt;

        if (jump && wasOnGround) {
          audio.playSfx('jump');
          spawnDust(sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h, 5, 1.1);
        }

        if (step.bouncedSpring) {
          audio.playSfx('jump');
          spawnDust(sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h, 8, 1.5);
          spawnSparkBurst(sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h, 10);
          screenShakeRef.current = Math.max(screenShakeRef.current, 3);
        }

        /** Recolección de MatiCoins: barrido AABB por cada tick. */
        const beforeCoins = sim.coinsCollected;
        const picked = collectCoinsInRange(sim.player, sim.coins);
        if (picked > 0) {
          sim.coinsCollected = beforeCoins + picked;
          setCoinsHud(sim.coinsCollected);
          audio.playSfx('click');
          for (const c of sim.coins) {
            if (c.collected && c.phase >= 0) {
              spawnSparkBurst(c.x, c.y, 6);
              c.phase = -1;
            }
          }
        }

        /** Meta: al cruzar el arco tras resolver la última operación, se finaliza. */
        if (sim.lastQuizSolved && !sim.ended && sim.player.x + sim.player.w * 0.5 >= lvl.archX) {
          const rk = callbacksRef.current.runKind;
          const base =
            rk === 'practice' ? 0 : Math.max(0, Math.floor(callbacksRef.current.dailyBaseCoinsOnWin));
          const bonus = sim.coinsCollected;
          callbacksRef.current.onStructuredComplete({ runKind: rk, baseCoins: base, bonusCoins: bonus });
          sim.ended = true;
          audio.playSfx('correct');
          screenShakeRef.current = Math.max(screenShakeRef.current, 4);
          spawnSparkBurst(sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h / 2, 30);
        }

        /** Polvo al aterrizar desde el aire. */
        if (!wasOnGroundRef.current && sim.player.onGround && step.landedPlatform) {
          spawnDust(sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h, 7, 1.3);
        }
        wasOnGroundRef.current = sim.player.onGround;

        updateParticles(dt);
        if (screenShakeRef.current > 0) {
          screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 28);
        }

        if (step.fellOutOfBounds) {
          audio.playSfx('fall');
          if (!heroFallAnimRef.current) {
            heroFallAnimRef.current = { t0Ms: performance.now(), durationMs: 1500 };
            spawnFallBurst(sim.player.x + sim.player.w / 2, sim.player.y + sim.player.h);
            screenShakeRef.current = 6;
          }
        } else if (step.landedPlatform) {
          const lp = step.landedPlatform;
          if (lp.kind === 'quiz' && lp.quizIndex !== null && !lp.quizRowResolved) {
            const qi = currentQuizIndexRef.current;
            if (lp.quizIndex === qi) {
              const prob = lvl.problems[qi];
              if (prob && problemHasGates(prob)) {
                const key = `${prob.a}x${prob.b}`;
                if (lp.label === prob.answer) {
                  audio.playSfx('correct');
                  callbacksRef.current.onUpdateHistory(key, true, mapLevelRef.current);
                  markQuizRowComplete(sim.platforms, qi, prob.answer, physicsTime);
                  spawnSparkBurst(
                    lp.baseX + (lp.solveAnchorX != null ? lp.solveAnchorX - lp.baseX : 0) + lp.w / 2,
                    lp.baseY + lp.h / 2,
                    22
                  );
                  screenShakeRef.current = 3;
                  /** Avanza el último checkpoint al "suelo post-puerta" de este tramo. */
                  const nextCp = lvl.checkpoints[qi + 1];
                  if (nextCp) lastCheckpointRef.current = nextCp;
                  const next = qi + 1;
                  if (next >= PLATFORM_CLIMB_ROUNDS) {
                    /** Última operación resuelta: abre el camino hacia el arco pero no finaliza. */
                    sim.lastQuizSolved = true;
                    currentQuizIndexRef.current = PLATFORM_CLIMB_ROUNDS;
                    setCurrentQuizIndex(PLATFORM_CLIMB_ROUNDS);
                  } else {
                    currentQuizIndexRef.current = next;
                    setCurrentQuizIndex(next);
                  }
                } else {
                  audio.playSfx('fall');
                  callbacksRef.current.onUpdateHistory(key, false, mapLevelRef.current);
                  spawnFallBurst(lp.baseX + lp.w / 2, lp.baseY + lp.h / 2);
                  screenShakeRef.current = 5;
                  if (!heroFallAnimRef.current) {
                    heroFallAnimRef.current = { t0Ms: performance.now(), durationMs: 1500 };
                  }
                }
              }
            }
          }
        }
      } else {
        updateParticles(dt);
      }

      let fallDraw: HeroFallDraw = { shift: 0 };
      let finishHeroFall = false;
      const fState = heroFallAnimRef.current;
      if (fState) {
        const elapsed = performance.now() - fState.t0Ms;
        const u = Math.min(1, elapsed / fState.durationMs);
        const eased = u * u * u;
        const dropPx = 4200;
        fallDraw = { shift: eased * dropPx };
        if (u >= 1) {
          finishHeroFall = true;
          heroFallAnimRef.current = null;
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      /**
       * Escala "mixta": aseguramos mínimos razonables de mundo visible tanto horizontal como vertical
       * para funcionar bien en tablet portrait (estrecho) y desktop/landscape (ancho).
       */
      const MIN_VIEW_W = 620;
      const MIN_VIEW_H = 380;
      const scaleRaw = Math.min(ch / MIN_VIEW_H, cw / MIN_VIEW_W);
      const scale = Math.max(0.25, Math.round(scaleRaw * 2000) / 2000);
      const viewW = cw / scale;
      const viewH = ch / scale;

      const heroCamOff = fallDraw.shift;

      /** Cámara horizontal: sigue al jugador con look-ahead a la derecha. */
      const maxCamX = Math.max(lvl.worldMinX, lvl.worldMaxX - viewW);
      const targetCamX = sim.player.x + sim.player.w / 2 - viewW * 0.42;
      const clampedCamX = Math.max(lvl.worldMinX, Math.min(maxCamX, targetCamX));
      if (camSmoothXRef.current === null) camSmoothXRef.current = clampedCamX;
      else camSmoothXRef.current += (clampedCamX - camSmoothXRef.current) * Math.min(1, dt * 6.5);
      const camX = Math.round(camSmoothXRef.current * 10) / 10;

      /**
       * Cámara vertical: suelo siempre visible cerca del borde inferior; sube sólo cuando el
       * jugador salta por encima del "cinturón" visible (para seguir viéndolo en el aire).
       */
      const bottomAnchorCamY = lvl.groundY + 60 - viewH;
      const playerDrivenCamY = sim.player.y + heroCamOff + sim.player.h / 2 - viewH * 0.6;
      const targetCamY = Math.min(bottomAnchorCamY, playerDrivenCamY);
      const maxCamY = Math.max(lvl.worldMinY, lvl.worldMaxY - viewH);
      const clampedCamY = Math.max(lvl.worldMinY, Math.min(maxCamY, targetCamY));
      if (camSmoothYRef.current === null) camSmoothYRef.current = clampedCamY;
      else camSmoothYRef.current += (clampedCamY - camSmoothYRef.current) * Math.min(1, dt * 4.5);
      const camY = Math.round(camSmoothYRef.current * 10) / 10;

      const worldPixelW = (lvl.worldMaxX - lvl.worldMinX) * scale;
      const ox = worldPixelW < cw ? Math.round((cw - worldPixelW) / 2) : 0;
      const worldPixelH = (lvl.worldMaxY - lvl.worldMinY) * scale;
      const oy = worldPixelH < ch ? Math.round((ch - worldPixelH) / 2) : 0;
      const mapLevel = mapLevelRef.current;

      /** Anima la bandera del castillo al completar la última pregunta. */
      if (sim.ended && finishAnimRef.current < 1) {
        finishAnimRef.current = Math.min(1, finishAnimRef.current + dt * 0.9);
      }

      drawParallax(cw, ch, camX, sim.time, lvl, mapLevel);
      drawScene(cw, ch, scale, camX, camY, ox, oy, sim, lvl, mapLevel, viewW, viewH, fallDraw);

      if (finishHeroFall) {
        applyRunReset();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (restartNoticeTimerRef.current) {
        clearTimeout(restartNoticeTimerRef.current);
        restartNoticeTimerRef.current = null;
      }
    };
  }, [level, applyRunReset]);

  const syncPressed = useCallback((key: 'left' | 'right' | 'jump') => {
    const v = activePointersRef.current[key].size > 0;
    if (inputRef.current[key] !== v) {
      if (key === 'jump' && v) jumpEdgeRef.current = true;
      inputRef.current[key] = v;
    }
    setPressed((prev) => (prev[key] === v ? prev : { ...prev, [key]: v }));
  }, []);

  const onBtnPointerDown = useCallback(
    (key: 'left' | 'right' | 'jump') => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* algunos navegadores pueden rechazar la captura; ignorar. */
      }
      activePointersRef.current[key].add(e.pointerId);
      syncPressed(key);
    },
    [syncPressed]
  );

  const onBtnPointerEnd = useCallback(
    (key: 'left' | 'right' | 'jump') => (e: React.PointerEvent<HTMLButtonElement>) => {
      const target = e.currentTarget;
      try {
        if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      activePointersRef.current[key].delete(e.pointerId);
      syncPressed(key);
    },
    [syncPressed]
  );

  useEffect(() => {
    /** Red de seguridad global: al soltar/cancelar un puntero fuera del botón, limpiamos los estados. */
    const handler = (e: PointerEvent) => {
      let changed = false;
      (['left', 'right', 'jump'] as const).forEach((k) => {
        if (activePointersRef.current[k].delete(e.pointerId)) changed = true;
      });
      if (changed) {
        syncPressed('left');
        syncPressed('right');
        syncPressed('jump');
      }
    };
    window.addEventListener('pointerup', handler);
    window.addEventListener('pointercancel', handler);
    /** Al quedarse la ventana en segundo plano, sueltamos todo para no dejar un estado trabado. */
    const blur = () => {
      (['left', 'right', 'jump'] as const).forEach((k) => {
        activePointersRef.current[k].clear();
        syncPressed(k);
      });
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', blur);
    return () => {
      window.removeEventListener('pointerup', handler);
      window.removeEventListener('pointercancel', handler);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', blur);
    };
  }, [syncPressed]);

  const idx = Math.min(currentQuizIndex, PLATFORM_CLIMB_ROUNDS - 1);
  const prob = level.problems[idx];
  const showComplete = currentQuizIndex >= PLATFORM_CLIMB_ROUNDS;
  const showMath = !showComplete && problemHasGates(prob);
  const currentZone = Math.min(PLATFORM_CLIMB_ROUNDS, currentQuizIndex + 1);

  const dirBtnClass = (active: boolean) =>
    cn(
      'flex size-[4.5rem] shrink-0 items-center justify-center rounded-full border-[5px] text-2xl font-black select-none transition-[transform,box-shadow] duration-75',
      active
        ? 'translate-y-[6px] border-cyan-900 bg-gradient-to-b from-cyan-300 via-cyan-500 to-cyan-700 text-white shadow-[inset_0_3px_0_rgba(255,255,255,0.55),0_2px_0_0_#0e7490,0_4px_10px_rgba(0,0,0,0.22)]'
        : 'border-cyan-800 bg-gradient-to-b from-cyan-200 via-cyan-400 to-cyan-600 text-cyan-950 shadow-[inset_0_3px_0_rgba(255,255,255,0.55),0_8px_0_0_#0e7490,0_10px_14px_rgba(0,0,0,0.22)]'
    );
  const jumpBtnClass = (active: boolean) =>
    cn(
      'pointer-events-auto flex size-[5.6rem] shrink-0 flex-col items-center justify-center rounded-full border-[5px] text-[10px] font-black uppercase leading-tight tracking-wide select-none transition-[transform,box-shadow] duration-75',
      active
        ? 'translate-y-[8px] border-amber-900 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 text-amber-950 shadow-[inset_0_3px_0_rgba(255,255,255,0.55),0_2px_0_0_#b45309,0_5px_12px_rgba(0,0,0,0.25)]'
        : 'border-amber-800 bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 text-amber-950 shadow-[inset_0_4px_0_rgba(255,255,255,0.55),0_10px_0_0_#b45309,0_12px_16px_rgba(0,0,0,0.25)]'
    );

  const touchStyle: React.CSSProperties = { touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' };

  return (
    <div className="flex-1 relative overflow-hidden bg-[#020617] flex flex-col min-h-0">
      {restartNotice && !gameOverNotice && (
        <div className="absolute inset-x-4 top-28 z-[60] mx-auto max-w-sm rounded-2xl border-2 border-amber-400/70 bg-[#1A1A30]/95 px-4 py-3 text-center text-amber-100 font-black text-sm shadow-[0_8px_30px_rgba(0,0,0,0.5)] pointer-events-none">
          <div className="text-base">{t('platformClimbRestart')}</div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-rose-200">
            <span className="text-[11px] font-bold uppercase tracking-wide opacity-80">
              {t('platformClimbLivesLeft', { defaultValue: 'Vidas restantes' })}
            </span>
            <span className="font-headline text-lg font-black tabular-nums text-rose-300">
              {livesHud}
            </span>
          </div>
        </div>
      )}

      {gameOverNotice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-rose-500/50 bg-gradient-to-br from-[#2a0d13] via-[#1a1a30] to-[#2a0d13] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
            <h2 className="text-center font-headline text-3xl font-black uppercase tracking-wide text-rose-300 drop-shadow-[0_2px_0_rgba(0,0,0,0.7)]">
              {t('platformClimbGameOverTitle', { defaultValue: '¡Se acabaron las vidas!' })}
            </h2>
            <p className="mt-3 text-center text-base leading-snug text-[#c4b5fd]">
              {t('platformClimbGameOverBody', {
                defaultValue:
                  'Has agotado tus 3 intentos. No se obtiene la recompensa de la misión, pero te llevas las MatiCoins que ya tenías guardadas.',
              })}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 px-4 py-3">
              <div className="relative size-8" aria-hidden>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700" />
                <div className="absolute inset-1 rounded-full border-2 border-amber-700/80 bg-gradient-to-br from-yellow-100 to-amber-400 flex items-center justify-center">
                  <span className="font-headline text-[11px] font-black text-amber-900 leading-none">M</span>
                </div>
              </div>
              <div className="font-headline text-amber-200 text-sm font-bold">
                {t('platformClimbGameOverCoins', {
                  defaultValue: 'MatiCoins rescatadas: {{n}}',
                  n: gameOverNotice.coins,
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                audio.playSfx('click');
                setGameOverNotice(null);
                onExit();
              }}
              className="mt-6 w-full rounded-2xl bg-gradient-to-b from-rose-400 to-rose-700 py-3 font-headline text-lg font-black uppercase text-white shadow-[0_6px_0_#7f1d1d]"
            >
              {t('platformClimbGameOverExit', { defaultValue: 'Volver' })}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          audio.playSfx('click');
          onExit();
        }}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 border border-cyan-200 text-cyan-800 font-bold text-sm shadow-lg squish-physics"
      >
        <ChevronLeft size={22} />
        {t('back')}
      </button>

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col min-h-0 px-3">
        <div className="shrink-0 pb-2 pt-14">
          <div className="mb-2 flex flex-col items-center text-center">
            <div className="mb-2 inline-flex rotate-[-2deg] items-center gap-2 rounded-full border-4 border-cyan-300/60 bg-gradient-to-r from-fuchsia-500/45 via-sky-500/40 to-amber-300/55 px-4 py-2 shadow-[0_6px_0_rgba(8,72,104,0.55),0_10px_24px_rgba(0,0,0,0.35)] sm:px-5 sm:py-2.5">
              <Sparkles className="size-6 shrink-0 text-amber-300 drop-shadow sm:size-7" strokeWidth={2.5} />
              <h2 className="font-playful text-lg font-black uppercase tracking-wide text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.55)] sm:text-2xl">
                {t('platformClimbTitle')}
              </h2>
              <Sparkles className="size-6 shrink-0 text-cyan-200 drop-shadow sm:size-7" strokeWidth={2.5} />
            </div>
          </div>
          <div className="rounded-2xl border-2 border-cyan-300/70 bg-white/95 px-3 py-2 shadow-[0_6px_18px_rgba(2,6,23,0.35)]">
            {showComplete ? (
              <p className="text-center text-lg font-black text-amber-600 animate-pulse">
                {(t('platformClimbCrossArch', { defaultValue: '¡Cruza el arco de meta!' }) as string)}
              </p>
            ) : showMath ? (
              <>
                <h3 className="font-headline text-center text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-sky-600 to-amber-500 tracking-tight sm:text-3xl">
                  {prob.a} × {prob.b} = ?
                </h3>
                <p className="mt-1 text-center text-[10px] font-bold leading-snug text-slate-600">{t('platformClimbHint')}</p>
              </>
            ) : null}
          </div>
        </div>

        <div ref={containerRef} className="relative min-h-[220px] w-full flex-1 pb-28">
          <canvas
            ref={canvasRef}
            className="block h-full min-h-[200px] w-full rounded-2xl border-2 border-cyan-400/60 bg-sky-950 shadow-[0_10px_40px_rgba(2,6,23,0.55)] touch-none"
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />

          {/* Marcador dentro del canvas: vidas | MatiCoins | Zone */}
          <div
            className="pointer-events-none absolute left-2 right-2 top-2 z-[5] flex justify-center"
            aria-hidden
          >
            <div className="pointer-events-none inline-flex select-none items-stretch overflow-hidden rounded-xl border-2 border-slate-900/70 bg-gradient-to-b from-[#1b2240]/92 via-[#0f172a]/92 to-[#050814]/92 shadow-[0_4px_0_rgba(0,0,0,0.55),0_8px_18px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-[2px]">
              {/* Vidas */}
              <div className="flex items-center gap-1 border-r-2 border-slate-900/70 bg-gradient-to-b from-rose-900/45 via-rose-950/55 to-rose-950/70 px-2 py-1 sm:gap-1.5 sm:px-2.5">
                {Array.from({ length: PLATFORM_CLIMB_MAX_LIVES }).map((_, i) => {
                  const alive = i < livesHud;
                  return (
                    <svg
                      key={i}
                      viewBox="0 0 24 22"
                      className={cn(
                        'size-4 sm:size-5 transition-[filter,opacity,transform] duration-200',
                        alive
                          ? 'drop-shadow-[0_1px_0_rgba(0,0,0,0.65)]'
                          : 'opacity-30 saturate-0 scale-90'
                      )}
                      aria-hidden
                    >
                      <path
                        d="M12 21s-7.5-4.7-9.3-9.2C1 7.7 3.4 3.5 7.3 3.5c2 0 3.7 1.1 4.7 2.8 1-1.7 2.7-2.8 4.7-2.8 3.9 0 6.3 4.2 4.6 8.3C19.5 16.3 12 21 12 21z"
                        fill={alive ? '#ef4444' : '#4b5563'}
                        stroke={alive ? '#7f1d1d' : '#1f2937'}
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                      {alive && (
                        <path
                          d="M8 7.2c-1.3 0-2.3 1-2.3 2.4 0 0.8 0.4 1.5 1 1.9"
                          fill="none"
                          stroke="rgba(255,255,255,0.95)"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                  );
                })}
              </div>
              {/* MatiCoins */}
              <div className="flex items-center gap-1.5 border-r-2 border-slate-900/70 bg-gradient-to-b from-amber-500/20 via-amber-700/25 to-amber-950/40 px-2 py-1 sm:px-2.5">
                <div className="relative size-5 sm:size-6" aria-hidden>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_0_rgba(120,53,15,0.45)]" />
                  <div className="absolute inset-[3px] rounded-full border-[1.5px] border-amber-800 bg-gradient-to-br from-yellow-100 to-amber-400 flex items-center justify-center">
                    <span className="font-headline text-[8px] font-black text-amber-900 leading-none sm:text-[10px]">
                      M
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-0.5 leading-none">
                  <span className="font-headline text-sm font-black tabular-nums text-amber-100 drop-shadow-[0_1px_0_rgba(0,0,0,0.7)] sm:text-base">
                    {String(coinsHud).padStart(2, '0')}
                  </span>
                  <span className="text-amber-200/70 text-[9px] font-black">/</span>
                  <span className="font-headline text-[10px] font-black tabular-nums text-amber-200/85 sm:text-xs">
                    {totalCoins}
                  </span>
                </div>
              </div>
              {/* Zone */}
              <div className="flex min-w-[4.5rem] flex-col justify-center gap-0.5 bg-gradient-to-b from-emerald-700/30 via-emerald-900/35 to-emerald-950/55 px-2 py-1 sm:min-w-[5rem] sm:px-2.5">
                <div className="flex items-baseline justify-between gap-1 leading-none">
                  <span className="font-headline text-[8px] font-black uppercase tracking-[0.2em] text-emerald-200/85 sm:text-[9px]">
                    Zone
                  </span>
                  <span className="flex items-baseline gap-0.5">
                    <span className="font-headline text-sm font-black tabular-nums text-emerald-100 drop-shadow-[0_1px_0_rgba(0,0,0,0.7)] sm:text-base">
                      {String(currentZone).padStart(2, '0')}
                    </span>
                    <span className="text-emerald-200/65 text-[9px] font-black">/</span>
                    <span className="font-headline text-[10px] font-black tabular-nums text-emerald-200/80 sm:text-[11px]">
                      {PLATFORM_CLIMB_ROUNDS}
                    </span>
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-lime-300 via-emerald-400 to-emerald-600 transition-[width] duration-300"
                    style={{ width: `${Math.round((currentZone / PLATFORM_CLIMB_ROUNDS) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-5 left-0 right-0 z-50 flex justify-center px-3">
        <div className="flex w-full max-w-lg items-end justify-between gap-3">
          <div className="flex gap-3 pointer-events-auto">
            <button
              type="button"
              aria-label="Left"
              aria-pressed={pressed.left}
              className={dirBtnClass(pressed.left)}
              style={touchStyle}
              onPointerDown={onBtnPointerDown('left')}
              onPointerUp={onBtnPointerEnd('left')}
              onPointerCancel={onBtnPointerEnd('left')}
              onContextMenu={(e) => e.preventDefault()}
            >
              {'\u25C0'}
            </button>
            <button
              type="button"
              aria-label="Right"
              aria-pressed={pressed.right}
              className={dirBtnClass(pressed.right)}
              style={touchStyle}
              onPointerDown={onBtnPointerDown('right')}
              onPointerUp={onBtnPointerEnd('right')}
              onPointerCancel={onBtnPointerEnd('right')}
              onContextMenu={(e) => e.preventDefault()}
            >
              {'\u25B6'}
            </button>
          </div>
          <button
            type="button"
            aria-label="Jump"
            aria-pressed={pressed.jump}
            className={jumpBtnClass(pressed.jump)}
            style={touchStyle}
            onPointerDown={onBtnPointerDown('jump')}
            onPointerUp={onBtnPointerEnd('jump')}
            onPointerCancel={onBtnPointerEnd('jump')}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="text-3xl leading-none drop-shadow-sm">{'\u2191'}</span>
            <span className="mt-0.5 max-w-[4.25rem] text-center">{t('platformClimbJump')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
