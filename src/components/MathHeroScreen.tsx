import React, { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Stars, useTexture, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useTranslation } from 'react-i18next';
import { Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import type { UserState } from '../types';
import { generateAdaptiveProblem, type Problem } from '../lib/engine';
import { audio } from '../lib/audio';
import { cn } from '../lib/utils';

/** URL bajo `public/` respetando `base` de Vite (subcarpeta o Capacitor). */
function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${clean}`;
}

const RUNNER_CHARACTERS = {
  nico: { glb: publicAssetUrl('/img/models/nico.glb'), image: '/img/heros/9-Nico.jpg', name: 'NICO' },
  nova: { glb: publicAssetUrl('/img/models/nova.glb'), image: '/img/heros/16-Nova.jpg', name: 'NOVA' },
} as const;
type RunnerCharId = keyof typeof RUNNER_CHARACTERS;

const MATH_HERO_SPACE_BG_URL = publicAssetUrl('/img/math-hero-space-bg-wide.png');

/** Seed-able pseudo-random para texturas determinísticas. */
function seededRand(seed: number) {
  let s = seed | 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/**
 * Pista realista tipo Mondo EPDM:
 * - Grano de caucho con micro-ruido (partículas individuales)
 * - Variación sutil de tono entre carriles
 * - Bordillos metálicos (aluminio)
 * - Césped artificial en los laterales con fibras
 * - Líneas de carril con desgaste/imperfecciones
 * - Números de calle (1-4) pintados
 */
function createAthleticsTrackTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  if (!ctx) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

  const rng = seededRand(42);
  const grassEdge = 0.065;
  const curbW = 0.012;
  const trackL = grassEdge + curbW;
  const trackR = 1 - grassEdge - curbW;

  // --- Césped lateral ---
  const grassBase = ctx.createLinearGradient(0, 0, W, 0);
  grassBase.addColorStop(0, '#1a472a');
  grassBase.addColorStop(grassEdge - 0.005, '#1a472a');
  grassBase.addColorStop(grassEdge, '#2d5a3f');
  grassBase.addColorStop(1 - grassEdge, '#2d5a3f');
  grassBase.addColorStop(1 - grassEdge + 0.005, '#1a472a');
  grassBase.addColorStop(1, '#1a472a');
  ctx.fillStyle = grassBase;
  ctx.fillRect(0, 0, W, H);

  // Fibras de césped
  const leftGrassEnd = Math.floor(W * grassEdge);
  const rightGrassStart = Math.floor(W * (1 - grassEdge));
  for (let i = 0; i < 8000; i++) {
    const side = rng() > 0.5;
    const bx = side ? rightGrassStart + rng() * (W - rightGrassStart) : rng() * leftGrassEnd;
    const by = rng() * H;
    const len = 3 + rng() * 7;
    const hue = 110 + rng() * 30;
    const lightness = 18 + rng() * 14;
    ctx.strokeStyle = `hsl(${hue},55%,${lightness}%)`;
    ctx.lineWidth = 0.8 + rng() * 0.6;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + (rng() - 0.5) * 2, by - len);
    ctx.stroke();
  }

  // --- Bordillos metálicos ---
  const curbLx = Math.floor(W * grassEdge);
  const curbRx = Math.floor(W * (1 - grassEdge - curbW));
  const curbPx = Math.floor(W * curbW);
  for (const cx of [curbLx, curbRx]) {
    const cg = ctx.createLinearGradient(cx, 0, cx + curbPx, 0);
    cg.addColorStop(0, '#6b7280');
    cg.addColorStop(0.3, '#d1d5db');
    cg.addColorStop(0.5, '#f3f4f6');
    cg.addColorStop(0.7, '#d1d5db');
    cg.addColorStop(1, '#6b7280');
    ctx.fillStyle = cg;
    ctx.fillRect(cx, 0, curbPx, H);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < H; y += 18) {
      ctx.fillRect(cx, y, curbPx, 1);
    }
  }

  // --- Superficie roja EPDM ---
  const tL = Math.floor(W * trackL);
  const tR = Math.floor(W * trackR);
  const tW = tR - tL;

  // Base roja con variación por carril
  const laneCount = 4;
  const laneW = tW / laneCount;
  const laneHues = [
    { base: '#8b2240', light: '#a83055', dark: '#6e1a32' },
    { base: '#932445', light: '#b0335a', dark: '#751c38' },
    { base: '#8b2240', light: '#a83055', dark: '#6e1a32' },
    { base: '#882040', light: '#a52e52', dark: '#6c1930' },
  ];
  for (let lane = 0; lane < laneCount; lane++) {
    const lx = tL + lane * laneW;
    const h = laneHues[lane];
    const lg = ctx.createLinearGradient(lx, 0, lx + laneW, 0);
    lg.addColorStop(0, h.dark);
    lg.addColorStop(0.15, h.base);
    lg.addColorStop(0.5, h.light);
    lg.addColorStop(0.85, h.base);
    lg.addColorStop(1, h.dark);
    ctx.fillStyle = lg;
    ctx.fillRect(lx, 0, laneW, H);
  }

  // Grano de caucho EPDM (miles de partículas diminutas)
  for (let i = 0; i < 120000; i++) {
    const px = tL + rng() * tW;
    const py = rng() * H;
    const size = 0.6 + rng() * 1.8;
    const brightness = rng();
    if (brightness > 0.7) {
      ctx.fillStyle = `rgba(180,60,80,${0.12 + rng() * 0.18})`;
    } else if (brightness > 0.35) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.08})`;
    } else {
      ctx.fillStyle = `rgba(220,120,110,${0.06 + rng() * 0.1})`;
    }
    ctx.fillRect(px, py, size, size);
  }

  // Micro-estrías horizontales (huella del rodillo al instalar el caucho)
  for (let y = 0; y < H; y += 2) {
    const alpha = 0.005 + Math.abs(Math.sin(y * 0.08 + rng() * 6)) * 0.012;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(tL, y, tW, 1);
  }

  // Manchas de desgaste sutiles
  for (let i = 0; i < 40; i++) {
    const mx = tL + rng() * tW;
    const my = rng() * H;
    const mr = 8 + rng() * 25;
    const wg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
    wg.addColorStop(0, `rgba(60,20,30,${0.04 + rng() * 0.06})`);
    wg.addColorStop(1, 'rgba(60,20,30,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  }

  // --- Líneas de carril ---
  const drawLaneLine = (x: number, style: 'solid' | 'dashed' | 'border') => {
    ctx.save();
    const lineW = style === 'border' ? 6 : 3.5;
    const opacity = style === 'border' ? 0.95 : 0.88;

    if (style === 'dashed') {
      ctx.setLineDash([32, 28]);
    } else {
      ctx.setLineDash([]);
    }

    // Sombra del relieve de la pintura
    ctx.strokeStyle = `rgba(0,0,0,0.2)`;
    ctx.lineWidth = lineW + 3;
    ctx.beginPath();
    ctx.moveTo(x + 1, 0);
    ctx.lineTo(x + 1, H);
    ctx.stroke();

    // Línea principal
    ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();

    // Brillo superior (pintura reflectante)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = lineW + 5;
    ctx.shadowColor = 'rgba(255,255,255,0.25)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();

    // Imperfecciones (desgaste)
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    for (let j = 0; j < 12; j++) {
      const wy = rng() * H;
      const wLen = 6 + rng() * 20;
      ctx.fillStyle = `rgba(139,34,64,${0.35 + rng() * 0.3})`;
      ctx.fillRect(x - lineW / 2 - 1, wy, lineW + 2, wLen);
    }
    ctx.restore();
  };

  // Bordes exterior de la pista
  drawLaneLine(tL + 2, 'border');
  drawLaneLine(tR - 2, 'border');

  // Separadores de carril (entre los 4 carriles)
  for (let i = 1; i < laneCount; i++) {
    const lx = tL + i * laneW;
    drawLaneLine(lx, 'dashed');
  }

  // --- Números de calle ---
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let lane = 0; lane < laneCount; lane++) {
    const nx = tL + lane * laneW + laneW / 2;
    const numY = H * 0.5;
    ctx.font = `bold ${Math.round(laneW * 0.38)}px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillText(String(lane + 1), nx + 2, numY + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillText(String(lane + 1), nx, numY);
  }
  ctx.restore();

  // --- Textura final ---
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.0, 12);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Bump map procedural para la pista (grano del caucho). */
function createTrackBumpTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  const rng = seededRand(99);
  for (let i = 0; i < 12000; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const v = 118 + Math.floor(rng() * 24);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(px, py, 1 + rng() * 1.5, 1 + rng() * 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 80);
  tex.anisotropy = 4;
  return tex;
}

const LANE_X_LANDSCAPE = [-4.5, -1.5, 1.5, 4.5] as const;
/** Carriles más juntos en retrato para que los 4 quepan en el campo de visión. */
const LANE_X_PORTRAIT = [-3.25, -1.08, 1.08, 3.25] as const;
const PORTRAIT_ASPECT_THRESHOLD = 0.95;

function lanePositionsForAspect(aspect: number): readonly number[] {
  return aspect < PORTRAIT_ASPECT_THRESHOLD ? LANE_X_PORTRAIT : LANE_X_LANDSCAPE;
}

function laneXAt(laneIndex: number, laneX: readonly number[]): number {
  return laneX[Math.min(3, Math.max(0, laneIndex))] ?? 0;
}
/** Colores neón por carril (cian, violeta, ámbar, rosa) como en Math Hero. */
const GATE_LANE_STYLE = [
  { top: '#22d3ee', pillar: '#0891b2', ring: '#67e8f9', em: 0.55 },
  { top: '#c084fc', pillar: '#7c3aed', ring: '#e9d5ff', em: 0.5 },
  { top: '#fbbf24', pillar: '#d97706', ring: '#fde68a', em: 0.55 },
  { top: '#fb7185', pillar: '#db2777', ring: '#fecdd3', em: 0.52 },
] as const;

const GATE_START_Z = -58;
const GATE_TRIGGER_Z = -0.35;
const GATE_EXIT_Z = 12;
const FINISH_LEVEL = 20;
const BLOCKS_PER_LEVEL = 3;
const MAX_LIVES = 5;
const FINISH_LINE_OFFSET_Z = -26;
const FINISH_CROSS_Z = 0.9;
const SLOW_FACTOR = 0.35;
const SLOW_DURATION = 1.4;
const OBSTACLE_SLOW_DURATION = SLOW_DURATION * 2;
const BOOST_FACTOR = 1.3;
const BOOST_DURATION = 0.65;
const OBSTACLE_TYPES = ['barrel', 'cone', 'barrier'] as const;
type ObstacleType = typeof OBSTACLE_TYPES[number];
type EndReason = 'TIME' | 'LIVES' | 'GOAL' | 'QUIT';
const TOTAL_GOAL_CORRECT = FINISH_LEVEL * BLOCKS_PER_LEVEL;

/** Difficulty params that scale with map level (1-100). Tuned for kids: slower run, more thinking time. */
function getDifficultyForLevel(mapLevel: number) {
  const t = Math.min(1, Math.max(0, (mapLevel - 1) / 99));
  return {
    initialTime: Math.round(60 - t * 15),
    timeCorrect: Math.max(2, Math.round(5 - t * 2)),
    timeWrong: Math.round(2 + t * 3),
    baseSpeed: 5.5 + t * 4.5,
    coinsPerCorrect: Math.round(8 + t * 20),
    obstacleChance: 0.25 + t * 0.4,
    maxObstacles: t < 0.3 ? 1 : t < 0.7 ? 2 : 3,
    timeMax: 99,
  };
}

type ObstacleData = { lane: number; type: ObstacleType; z: number; hit: boolean };

function spawnObstacles(chance: number, maxCount: number): ObstacleData[] {
  if (Math.random() > chance) return [];
  const count = 1 + Math.floor(Math.random() * maxCount);
  const obs: ObstacleData[] = [];
  const usedLanes = new Set<number>();
  for (let i = 0; i < Math.min(count, 4); i++) {
    let lane: number;
    do { lane = Math.floor(Math.random() * 4); } while (usedLanes.has(lane));
    usedLanes.add(lane);
    obs.push({
      lane,
      type: OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)],
      z: 12 + Math.random() * 16,
      hit: false,
    });
  }
  return obs;
}

type GameLoopProps = {
  laneIndex: number;
  gates: number[];
  answer: number;
  gateZRef: React.MutableRefObject<number>;
  speedRef: React.MutableRefObject<number>;
  baseSpeedRef: React.MutableRefObject<number>;
  timerRef: React.MutableRefObject<number>;
  pausedRef: React.MutableRefObject<boolean>;
  endedRef: React.MutableRefObject<boolean>;
  jumpVelRef: React.MutableRefObject<number>;
  jumpYRef: React.MutableRefObject<number>;
  shakeRef: React.MutableRefObject<number>;
  effectRef: React.MutableRefObject<{ type: 'boost' | 'slow' | null; timer: number }>;
  obstaclesRef: React.MutableRefObject<ObstacleData[]>;
  finishActiveRef: React.MutableRefObject<boolean>;
  onGateResult: (correct: boolean) => void;
  onTimeDrain: () => void;
  onTickSecond: (secLeft: number) => void;
  onObstacleHit: () => void;
  onReachGoal: () => void;
};

function GameLoop({
  laneIndex,
  gates,
  answer,
  gateZRef,
  speedRef,
  baseSpeedRef,
  timerRef,
  pausedRef,
  endedRef,
  jumpVelRef,
  jumpYRef,
  shakeRef,
  effectRef,
  obstaclesRef,
  finishActiveRef,
  onGateResult,
  onTimeDrain,
  onTickSecond,
  onObstacleHit,
  onReachGoal,
}: GameLoopProps) {
  const lastSecond = useRef(-1);
  const evaluatedForWave = useRef(false);
  const waitingRecycle = useRef(false);

  useFrame((_, delta) => {
    if (pausedRef.current || endedRef.current) return;

    // Jump physics
    jumpVelRef.current -= 22 * delta;
    jumpYRef.current = Math.max(0, jumpYRef.current + jumpVelRef.current * delta);

    // Timer
    timerRef.current = Math.max(0, timerRef.current - delta);
    const sec = Math.ceil(timerRef.current);
    if (sec !== lastSecond.current) {
      lastSecond.current = sec;
      onTickSecond(sec);
    }
    if (timerRef.current <= 0 && !endedRef.current) {
      endedRef.current = true;
      onTimeDrain();
      return;
    }

    // Speed effects (boost/slow)
    const eff = effectRef.current;
    if (eff.type) {
      eff.timer -= delta;
      if (eff.timer <= 0) {
        eff.type = null;
        speedRef.current = baseSpeedRef.current;
      } else if (eff.type === 'boost') {
        speedRef.current = baseSpeedRef.current * BOOST_FACTOR;
      } else {
        speedRef.current = baseSpeedRef.current * SLOW_FACTOR;
      }
    }

    const spd = speedRef.current;
    gateZRef.current += spd * delta;

    // Finish line trigger (after reaching level 20)
    if (finishActiveRef.current) {
      const finishWorldZ = FINISH_LINE_OFFSET_Z + gateZRef.current;
      if (finishWorldZ >= FINISH_CROSS_Z) {
        onReachGoal();
      }
    } else {
      // Gate trigger
      if (gateZRef.current >= GATE_TRIGGER_Z && !evaluatedForWave.current) {
        evaluatedForWave.current = true;
        const correctLane = gates.indexOf(answer);
        const ok = laneIndex === correctLane;
        onGateResult(ok);
        waitingRecycle.current = true;
      }
    }

    // Gate recycle (disabled once finish mode is active)
    if (waitingRecycle.current && gateZRef.current >= GATE_EXIT_Z && !finishActiveRef.current) {
      waitingRecycle.current = false;
      gateZRef.current = GATE_START_Z;
    }

    // Obstacle collision
    for (const obs of obstaclesRef.current) {
      if (obs.hit) continue;
      const obsWorldZ = obs.z + gateZRef.current;
      if (obsWorldZ > -1 && obsWorldZ < 1.5 && obs.lane === laneIndex && jumpYRef.current < 0.8) {
        obs.hit = true;
        onObstacleHit();
      }
    }
  });

  useEffect(() => {
    gateZRef.current = GATE_START_Z;
    evaluatedForWave.current = false;
    waitingRecycle.current = false;
    lastSecond.current = Math.ceil(timerRef.current);
  }, [gates, answer, gateZRef]);

  return null;
}

/** Neon-portal gate with animated energy pulse, glowing edges and holographic number. */
function GateArch({
  laneSlot,
  value,
  isCorrect,
}: {
  laneSlot: number;
  value: number;
  isCorrect: boolean;
}) {
  const style = GATE_LANE_STYLE[Math.min(3, Math.max(0, laneSlot))] ?? GATE_LANE_STYLE[0];
  const topColor = style.top;
  const pillarColor = style.pillar;
  const pillarH = 3.8;
  const archW = 2.3;
  const topY = pillarH + 0.18;
  const portalColor = new THREE.Color(style.top);
  const portalRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + laneSlot * 1.2;
    if (portalRef.current) {
      const mat = portalRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.22 + Math.sin(t * 3.2) * 0.08;
    }
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.6;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.45;
    if (glowRef.current) {
      glowRef.current.intensity = 0.5 + Math.sin(t * 4.5) * 0.25;
    }
  });

  return (
    <group>
      {/* Pillar left — octagonal tube */}
      <mesh position={[-archW / 2, pillarH / 2, 0]}>
        <cylinderGeometry args={[0.13, 0.16, pillarH, 8]} />
        <meshStandardMaterial
          color={pillarColor}
          emissive={pillarColor}
          emissiveIntensity={0.4}
          metalness={0.55}
          roughness={0.25}
        />
      </mesh>
      {/* Pillar right */}
      <mesh position={[archW / 2, pillarH / 2, 0]}>
        <cylinderGeometry args={[0.13, 0.16, pillarH, 8]} />
        <meshStandardMaterial
          color={pillarColor}
          emissive={pillarColor}
          emissiveIntensity={0.4}
          metalness={0.55}
          roughness={0.25}
        />
      </mesh>

      {/* Energy strip on pillars */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * archW / 2, pillarH / 2, 0.09]}>
          <boxGeometry args={[0.05, pillarH - 0.3, 0.05]} />
          <meshStandardMaterial
            color={topColor}
            emissive={topColor}
            emissiveIntensity={0.9}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* Top arch beam — rounded, rotated horizontal */}
      <mesh position={[0, topY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.16, archW - 0.3, 6, 12]} />
        <meshStandardMaterial
          color={topColor}
          emissive={topColor}
          emissiveIntensity={0.65}
          metalness={0.45}
          roughness={0.2}
        />
      </mesh>

      {/* Corner glow spheres */}
      {[[-archW / 2, topY], [archW / 2, topY]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial
            color={topColor}
            emissive={topColor}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Portal membrane — animated opacity */}
      <mesh ref={portalRef} position={[0, pillarH * 0.52, 0.04]} renderOrder={2}>
        <planeGeometry args={[archW - 0.35, pillarH - 0.2]} />
        <meshStandardMaterial
          color={portalColor}
          emissive={portalColor}
          emissiveIntensity={0.35}
          transparent
          opacity={0.26}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Spinning energy rings inside portal */}
      <mesh ref={ring1Ref} position={[0, pillarH * 0.52, 0.06]}>
        <torusGeometry args={[0.85, 0.025, 8, 40]} />
        <meshStandardMaterial
          color={topColor}
          emissive={topColor}
          emissiveIntensity={0.8}
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring2Ref} position={[0, pillarH * 0.52, 0.02]}>
        <torusGeometry args={[0.62, 0.02, 8, 32]} />
        <meshStandardMaterial
          color={style.ring}
          emissive={style.ring}
          emissiveIntensity={0.65}
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[0.7, 0.98, 40]} />
        <meshStandardMaterial
          color={isCorrect ? '#ffffff' : style.ring}
          emissive={isCorrect ? '#fef08a' : style.ring}
          emissiveIntensity={isCorrect ? 0.9 : 0.35}
          transparent
          opacity={isCorrect ? 0.95 : 0.55}
        />
      </mesh>

      {/* Point light glow at center */}
      <pointLight
        ref={glowRef}
        position={[0, pillarH * 0.5, 0.5]}
        color={topColor}
        intensity={0.6}
        distance={5}
        decay={2}
      />

      {/* Number — holographic style, same as HUD */}
      <Text
        position={[0, topY + 0.55, 0.22]}
        fontSize={1.15}
        color="#fde047"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#1e1b4b"
        outlineOpacity={1}
        fontWeight={900}
      >
        {String(value)}
      </Text>
      {/* Shadow / echo number for depth */}
      <Text
        position={[0, topY + 0.52, -0.08]}
        fontSize={1.15}
        color={topColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor={topColor}
        outlineOpacity={0.3}
        fontWeight={900}
        fillOpacity={0.18}
      >
        {String(value)}
      </Text>
    </group>
  );
}

const TRACK_PLANE_Z_EXTENT = 620;
/** Debe coincidir con `repeat.y` de `createAthleticsTrackTexture` para alinear scroll con el avance del mundo. */
const TRACK_COLOR_REPEAT_Y = 12;

function RunnerTrack({
  trackTexture,
  bumpTexture,
  speedRef,
  pausedRef,
  endedRef,
}: {
  trackTexture: THREE.CanvasTexture;
  bumpTexture: THREE.CanvasTexture;
  speedRef: React.MutableRefObject<number>;
  pausedRef: React.MutableRefObject<boolean>;
  endedRef: React.MutableRefObject<boolean>;
}) {
  const laneLineZ = -22;

  useFrame((_, delta) => {
    if (pausedRef.current || endedRef.current) return;
    const scroll = (speedRef.current * delta * TRACK_COLOR_REPEAT_Y) / TRACK_PLANE_Z_EXTENT;
    trackTexture.offset.y += scroll;
    bumpTexture.offset.y += scroll;
    trackTexture.offset.y %= 1;
    bumpTexture.offset.y %= 1;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, laneLineZ]} receiveShadow>
        <planeGeometry args={[14.2, TRACK_PLANE_Z_EXTENT]} />
        <meshStandardMaterial
          map={trackTexture}
          bumpMap={bumpTexture}
          bumpScale={0.12}
          metalness={0.03}
          roughness={0.82}
        />
      </mesh>
    </group>
  );
}

function SpaceBackdrop() {
  const map = useTexture(MATH_HERO_SPACE_BG_URL);
  const meshRef = useRef<THREE.Mesh>(null);
  const backdropZ = -88;
  const overscan = 1.12;
  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.anisotropy = 4;
  }, [map]);

  useFrame(({ camera }) => {
    const m = meshRef.current;
    if (!m) return;
    m.position.x = camera.position.x * 0.06;
    const pCam = camera as THREE.PerspectiveCamera;
    if (!pCam.isPerspectiveCamera) return;
    const dist = Math.max(0.1, pCam.position.z - backdropZ);
    const visibleH = 2 * Math.tan((THREE.MathUtils.degToRad(pCam.fov) * 0.5)) * dist;
    const visibleW = visibleH * pCam.aspect;
    const imgEl = map.image as { width: number; height: number } | undefined;
    const imgW = imgEl?.width ?? 16;
    const imgH = imgEl?.height ?? 9;
    const imgAspect = imgW / imgH;
    const viewAspect = visibleW / visibleH;
    const coverW = viewAspect > imgAspect ? visibleW : visibleH * imgAspect;
    const coverH = viewAspect > imgAspect ? visibleW / imgAspect : visibleH;
    m.scale.set(coverW * overscan, coverH * overscan, 1);
  });

  return (
    <mesh ref={meshRef} position={[0, -4, backdropZ]} renderOrder={-8}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={map}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

function GateRow({
  gateZRef,
  gates,
  answer,
  laneX,
}: {
  gateZRef: React.MutableRefObject<number>;
  gates: number[];
  answer: number;
  laneX: readonly number[];
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.z = gateZRef.current;
  });
  return (
    <group ref={ref}>
      {gates.map((g, i) => (
        <group key={`${i}-${g}`} position={[laneXAt(i, laneX), 0, 0]}>
          <GateArch laneSlot={i} value={g} isCorrect={g === answer} />
        </group>
      ))}
    </group>
  );
}

/** 3D Obstacles between gate waves */
function ObstacleRow({
  gateZRef,
  obstacles,
  laneX,
}: {
  gateZRef: React.MutableRefObject<number>;
  obstacles: ObstacleData[];
  laneX: readonly number[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groupRef.current) groupRef.current.position.z = gateZRef.current;
  });
  return (
    <group ref={groupRef}>
      {obstacles.map((obs, i) => {
        const x = laneXAt(obs.lane, laneX);
        if (obs.type === 'barrel') {
          return (
            <group key={i} position={[x, 0.5, obs.z]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.35, 0.4, 1.0, 12]} />
                <meshStandardMaterial color="#a16207" roughness={0.7} metalness={0.1} />
              </mesh>
              <mesh position={[0, 0, 0.36]}>
                <boxGeometry args={[0.6, 0.08, 0.04]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0, 0, -0.36]}>
                <boxGeometry args={[0.6, 0.08, 0.04]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
            </group>
          );
        }
        if (obs.type === 'cone') {
          return (
            <group key={i} position={[x, 0, obs.z]}>
              <mesh position={[0, 0.55, 0]} castShadow>
                <coneGeometry args={[0.3, 1.1, 8]} />
                <meshStandardMaterial color="#ea580c" emissive="#c2410c" emissiveIntensity={0.15} />
              </mesh>
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.8, 0.8]} />
                <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.2} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={i} position={[x, 0, obs.z]}>
            <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.08, 1.8, 4, 8]} />
              <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.3} metalness={0.4} roughness={0.3} />
            </mesh>
            <mesh position={[-0.95, 0.45, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.9, 6]} />
              <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0.95, 0.45, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.9, 6]} />
              <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function FinishLine({ gateZRef }: { gateZRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  const flagTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const cols = 16;
    const rows = 5;
    const cw = c.width / cols;
    const ch = c.height / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111827';
        ctx.fillRect(x * cw, y * ch, cw, ch);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      flagTex?.dispose();
    };
  }, [flagTex]);

  useFrame(() => {
    if (ref.current) ref.current.position.z = FINISH_LINE_OFFSET_Z + gateZRef.current;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 7.2, 0]}>
        <boxGeometry args={[14.5, 0.32, 0.32]} />
        <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={0.45} />
      </mesh>
      {[-6.8, 6.8].map((x) => (
        <mesh key={x} position={[x, 3.6, 0]}>
          <boxGeometry args={[0.34, 7.6, 0.34]} />
          <meshStandardMaterial color="#d97706" emissive="#92400e" emissiveIntensity={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 6.2, 0.14]}>
        <planeGeometry args={[12.6, 0.86]} />
        <meshBasicMaterial map={flagTex ?? undefined} transparent={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Particle burst on correct answer */
function ParticleBurst({ active, position }: { active: boolean; position: [number, number, number] }) {
  const pointsRef = useRef<THREE.Points>(null);
  const velocities = useRef<Float32Array | null>(null);
  const life = useRef(0);

  useEffect(() => {
    if (active && pointsRef.current) {
      const count = 60;
      const pos = new Float32Array(count * 3);
      const vel = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 0.3;
        pos[i * 3 + 1] = Math.random() * 0.3;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        vel[i * 3] = (Math.random() - 0.5) * 8;
        vel[i * 3 + 1] = 3 + Math.random() * 6;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 8;
        const c = new THREE.Color().setHSL(0.15 + Math.random() * 0.15, 1, 0.6);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      const geom = pointsRef.current.geometry;
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      velocities.current = vel;
      life.current = 1.0;
    }
  }, [active]);

  useFrame((_, dt) => {
    if (life.current <= 0 || !pointsRef.current) return;
    life.current -= dt * 1.5;
    const geom = pointsRef.current.geometry;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const vel = velocities.current;
    if (!posAttr || !vel) return;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3] += vel[i * 3] * dt;
      arr[i * 3 + 1] += vel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += vel[i * 3 + 2] * dt;
      vel[i * 3 + 1] -= 12 * dt;
    }
    posAttr.needsUpdate = true;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, life.current);
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry />
      <pointsMaterial size={0.18} vertexColors transparent opacity={1} depthWrite={false} toneMapped={false} />
    </points>
  );
}

function GoalConfetti({ trigger }: { trigger: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const velocities = useRef<Float32Array | null>(null);
  const life = useRef(0);

  useEffect(() => {
    if (!trigger || !pointsRef.current) return;
    const count = 140;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#ffffff'];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = 1.8 + Math.random() * 2.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
      vel[i * 3] = (Math.random() - 0.5) * 2.8;
      vel[i * 3 + 1] = 3.2 + Math.random() * 4.6;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
      const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geom = pointsRef.current.geometry;
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    velocities.current = vel;
    life.current = 1.25;
  }, [trigger]);

  useFrame((_, dt) => {
    if (!pointsRef.current || life.current <= 0 || !velocities.current) return;
    life.current -= dt;
    const geom = pointsRef.current.geometry;
    const attr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const pos = attr.array as Float32Array;
    const vel = velocities.current;
    for (let i = 0; i < pos.length; i += 3) {
      vel[i + 1] -= 7.8 * dt;
      pos[i] += vel[i] * dt;
      pos[i + 1] += vel[i + 1] * dt;
      pos[i + 2] += vel[i + 2] * dt;
    }
    attr.needsUpdate = true;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, life.current * 0.95);
  });

  return (
    <points ref={pointsRef} position={[0, 1.5, 0.2]}>
      <bufferGeometry />
      <pointsMaterial size={0.16} vertexColors transparent opacity={0} depthWrite={false} toneMapped={false} />
    </points>
  );
}

/** Screen-wide flash overlay effect */
function ScreenFlash({ flashRef }: { flashRef: React.MutableRefObject<{ color: string; opacity: number }> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    const f = flashRef.current;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = f.opacity;
    mat.color.set(f.color);
    f.opacity = Math.max(0, f.opacity - 0.03);
    meshRef.current.position.copy(camera.position);
    meshRef.current.quaternion.copy(camera.quaternion);
    meshRef.current.translateZ(-0.5);
  });
  return (
    <mesh ref={meshRef} renderOrder={999}>
      <planeGeometry args={[20, 20]} />
      <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

/** En retrato el FOV vertical deja poco margen horizontal: acercar carriles y alejar cámara. */
function PortraitRunnerCameraSetup() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < PORTRAIT_ASPECT_THRESHOLD;
    if (portrait) {
      c.fov = 62;
      c.position.set(0, 4.1, 16.2);
    } else {
      c.fov = 50;
      c.position.set(0, 4.35, 9.4);
    }
    c.near = 0.1;
    c.far = 200;
    c.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function CameraRig({ laneIndex, laneX }: { laneIndex: number; laneX: readonly number[] }) {
  const vx = laneXAt(laneIndex, laneX);
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const portrait = aspect < PORTRAIT_ASPECT_THRESHOLD;
  /** En retrato menos desplazamiento lateral de cámara para no perder al corredor en los bordes. */
  const lateralFollow = portrait ? 0.08 : 0.26;
  useFrame(({ camera }) => {
    const targetX = vx * lateralFollow;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.07);
    camera.lookAt(0, 0.85, -14);
  });
  return null;
}

/** ErrorBoundary for R3F children — renders fallback on crash instead of killing Canvas. */
class R3fErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.warn('[MathHero] R3F child error:', err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

/** Outer ErrorBoundary — catches Canvas / WebGL initialisation failures. */
class WebGLErrorBoundary extends Component<
  { onFallbackExit: () => void; children: React.ReactNode; title: string; body: string; backLabel: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error('[MathHero] WebGL fatal:', err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#08051a] p-6 gap-6">
          <p className="font-headline text-2xl font-black text-white/80 text-center">{this.props.title}</p>
          <p className="text-sm text-white/50 text-center max-w-xs">{this.props.body}</p>
          <button
            type="button"
            onClick={this.props.onFallbackExit}
            className="rounded-3xl bg-gradient-to-b from-[#a78bfa] to-[#6d28d9] px-8 py-4 font-black uppercase text-white shadow-[0_8px_0_0_#4c1d95] active:translate-y-2 active:shadow-none"
          >
            {this.props.backLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type PlayerShellProps = {
  laneIndex: number;
  laneX: readonly number[];
  jumpYRef: React.MutableRefObject<number>;
  glbUrl: string;
};

/** Fallback procedural: cápsula amarilla + ojitos si el GLB no carga. */
function PlayerFallback({ laneIndex, laneX, jumpYRef }: PlayerShellProps) {
  const groupRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Mesh>(null);
  const legRRef = useRef<THREE.Mesh>(null);
  const bobPhase = useRef(0);
  const laneRef = useRef(laneIndex);
  laneRef.current = laneIndex;
  const laneXRef = useRef(laneX);
  laneXRef.current = laneX;
  const currentX = useRef(laneXAt(laneIndex, laneX));

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const targetX = laneXAt(laneRef.current, laneXRef.current);
    currentX.current = THREE.MathUtils.lerp(currentX.current, targetX, 0.15);
    bobPhase.current += dt * 8;
    const bob = Math.sin(bobPhase.current) * 0.04;
    g.position.set(currentX.current, 0.7 + jumpYRef.current + bob, 0.5);

    const legSwing = Math.sin(bobPhase.current) * 0.5;
    if (legLRef.current) legLRef.current.rotation.x = 0.3 + legSwing;
    if (legRRef.current) legRRef.current.rotation.x = 0.3 - legSwing;
  });

  return (
    <>
      <group ref={groupRef} rotation={[0, Math.PI, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.38, 0.7, 8, 16]} />
          <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.18} roughness={0.55} />
        </mesh>
        {/* Eyes on the back side (facing -Z in local, which is away from camera after PI rotation) */}
        <mesh position={[-0.15, 0.25, -0.28]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.15, 0.25, -0.28]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.15, 0.25, -0.35]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#1e1b4b" />
        </mesh>
        <mesh position={[0.15, 0.25, -0.35]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#1e1b4b" />
        </mesh>
        <mesh ref={legLRef} position={[-0.22, -0.55, -0.08]} rotation={[0.3, 0, -0.1]} castShadow>
          <capsuleGeometry args={[0.09, 0.12, 4, 8]} />
          <meshStandardMaterial color="#c2410c" roughness={0.65} />
        </mesh>
        <mesh ref={legRRef} position={[0.22, -0.55, -0.08]} rotation={[0.3, 0, 0.1]} castShadow>
          <capsuleGeometry args={[0.09, 0.12, 4, 8]} />
          <meshStandardMaterial color="#c2410c" roughness={0.65} />
        </mesh>
      </group>
    </>
  );
}

function PlayerCharGLB({ laneIndex, laneX, jumpYRef, glbUrl }: PlayerShellProps) {
  const gltf = useGLTF(glbUrl);

  const { clonedScene, mixer } = useMemo(() => {
    const cloned = cloneSkeleton(gltf.scene) as THREE.Group;

    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) throw new Error('GLB bounding box is zero');
    const targetH = 0.02;
    const s = targetH / size.y;
    cloned.scale.setScalar(s);

    const scaledBox = new THREE.Box3().setFromObject(cloned);
    cloned.position.y -= scaledBox.min.y;

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const mx = new THREE.AnimationMixer(cloned);
    const clips = gltf.animations ?? [];
    if (clips.length > 0) {
      const runClip = clips.find(c => /run|walk|gallop|move|idle/i.test(c.name)) ?? clips[0];
      const action = mx.clipAction(runClip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.timeScale = 1.5;
      action.play();
    }

    return { clonedScene: cloned, mixer: mx };
  }, [gltf]);

  const groupRef = useRef<THREE.Group>(null);
  const laneRef = useRef(laneIndex);
  laneRef.current = laneIndex;
  const laneXRef = useRef(laneX);
  laneXRef.current = laneX;
  const currentX = useRef(laneXAt(laneIndex, laneX));

  useFrame((_, dt) => {
    mixer.update(dt);

    const g = groupRef.current;
    if (!g) return;

    const targetX = laneXAt(laneRef.current, laneXRef.current);
    currentX.current = THREE.MathUtils.lerp(currentX.current, targetX, 0.15);

    g.position.set(currentX.current, jumpYRef.current, 0.5);
  });

  return (
    <>
      <group ref={groupRef} rotation={[0, Math.PI, 0]}>
        <primitive object={clonedScene} />
      </group>
    </>
  );
}

function PlayerChar(props: PlayerShellProps) {
  return (
    <R3fErrorBoundary fallback={<PlayerFallback {...props} />}>
      <Suspense fallback={<PlayerFallback {...props} />}>
        <PlayerCharGLB {...props} />
      </Suspense>
    </R3fErrorBoundary>
  );
}

function SceneR3f({
  laneIndex,
  gates,
  answer,
  gateZRef,
  jumpYRef,
  shakeRef,
  speedRef,
  pausedRef,
  endedRef,
  finishActive,
  goalConfettiTrigger,
  obstacles,
  particleBurst,
  flashRef,
  glbUrl,
}: {
  laneIndex: number;
  gates: number[];
  answer: number;
  gateZRef: React.MutableRefObject<number>;
  jumpYRef: React.MutableRefObject<number>;
  shakeRef: React.MutableRefObject<number>;
  speedRef: React.MutableRefObject<number>;
  pausedRef: React.MutableRefObject<boolean>;
  endedRef: React.MutableRefObject<boolean>;
  finishActive: boolean;
  goalConfettiTrigger: number;
  obstacles: ObstacleData[];
  particleBurst: boolean;
  flashRef: React.MutableRefObject<{ color: string; opacity: number }>;
  glbUrl: string;
}) {
  const { size } = useThree();
  const laneX = useMemo(
    () => lanePositionsForAspect(size.width / Math.max(1, size.height)),
    [size.width, size.height]
  );
  const rootRef = useRef<THREE.Group>(null);
  const trackTex = useMemo(() => createAthleticsTrackTexture(), []);
  const bumpTex = useMemo(() => createTrackBumpTexture(), []);

  useEffect(() => {
    return () => {
      trackTex.dispose();
      bumpTex.dispose();
    };
  }, [trackTex, bumpTex]);

  useFrame(() => {
    if (!rootRef.current) return;
    const t = performance.now() / 1000;
    rootRef.current.position.x = Math.sin(t * 38) * 0.08 * shakeRef.current;
    shakeRef.current = THREE.MathUtils.lerp(shakeRef.current, 0, 0.11);
  });

  const playerX = laneXAt(laneIndex, laneX);

  return (
    <group ref={rootRef}>
      <PortraitRunnerCameraSetup />
      <CameraRig laneIndex={laneIndex} laneX={laneX} />
      <color attach="background" args={['#08051a']} />
      <fog attach="fog" args={['#0a061a', 18, 82]} />
      <Stars radius={150} depth={90} count={180} factor={3.5} saturation={0.06} fade speed={0.22} />
      <ambientLight intensity={0.38} color="#f5d0c8" />
      <hemisphereLight args={['#818cf8', '#0f172a', 0.42]} position={[0, 22, 0]} />
      <directionalLight position={[6, 18, 12]} intensity={1.05} color="#fef3c7" castShadow />
      <pointLight position={[playerX, 4, 6]} intensity={0.85} color="#22d3ee" distance={28} />
      <pointLight position={[-4, 2, -10]} intensity={0.35} color="#a78bfa" />
      <RunnerTrack
        trackTexture={trackTex}
        bumpTexture={bumpTex}
        speedRef={speedRef}
        pausedRef={pausedRef}
        endedRef={endedRef}
      />
      {finishActive && <FinishLine gateZRef={gateZRef} />}
      <GoalConfetti trigger={goalConfettiTrigger} />
      <GateRow gateZRef={gateZRef} gates={gates} answer={answer} laneX={laneX} />
      <ObstacleRow gateZRef={gateZRef} obstacles={obstacles} laneX={laneX} />
      <ParticleBurst active={particleBurst} position={[playerX, 1.2, 0.5]} />
      <ScreenFlash flashRef={flashRef} />
      <Suspense fallback={null}>
        <SpaceBackdrop />
      </Suspense>
      <PlayerChar laneIndex={laneIndex} laneX={laneX} jumpYRef={jumpYRef} glbUrl={glbUrl} />
    </group>
  );
}

export type MathHeroScreenProps = {
  user: UserState;
  mapLevel: number;
  onWin: (coins: number) => void;
  onLose: () => void;
  onUpdateHistory: (key: string, isCorrect: boolean, solveAtMapLevel: number) => void;
  onSaveScore: (level: number, score: number) => void;
  onRequestDoubleReward: () => Promise<boolean>;
  adsRemoved: boolean;
};

/** Character selection screen — fun, kid-friendly with tilted cards. */
function CharacterSelect({ onSelect }: { onSelect: (id: RunnerCharId) => void }) {
  const { t } = useTranslation();
  const cards: { id: RunnerCharId; rotate: string; hoverRotate: string; border: string; glow: string; shadow: string }[] = [
    { id: 'nico', rotate: '-rotate-6', hoverRotate: 'hover:-rotate-2', border: 'border-[#22d3ee]', glow: 'shadow-[0_0_30px_rgba(34,211,238,0.4)]', shadow: 'shadow-[0_8px_0_0_#0e7490]' },
    { id: 'nova', rotate: 'rotate-6', hoverRotate: 'hover:rotate-2', border: 'border-[#f472b6]', glow: 'shadow-[0_0_30px_rgba(244,114,182,0.4)]', shadow: 'shadow-[0_8px_0_0_#9d174d]' },
  ];
  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center bg-[#08051a] p-6 overflow-hidden">
      <h2 className="mb-2 -rotate-2 font-headline text-4xl font-black uppercase tracking-tight text-transparent bg-gradient-to-r from-[#fbbf24] via-[#fb7185] to-[#c084fc] bg-clip-text sm:text-5xl">
        {t('heroRunnerChooseChar')}
      </h2>
      <p className="mb-8 rotate-1 font-headline text-base font-bold text-white/50 sm:text-lg">
        {t('heroRunnerChooseHint')}
      </p>
      <div className="flex w-full max-w-lg items-center justify-center gap-4 px-2 sm:gap-8">
        {cards.map(({ id, rotate, hoverRotate, border, glow, shadow }) => {
          const char = RUNNER_CHARACTERS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => { audio.playSfx('click'); onSelect(id); }}
              className={cn(
                'group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[2rem] border-[3px] bg-gradient-to-b from-[#1e1433] to-[#12091f] p-3 transition-all duration-300 active:scale-90 sm:gap-3 sm:p-5',
                rotate, hoverRotate, border, glow,
                'hover:scale-105'
              )}
            >
              <div className={cn(
                'aspect-square w-full max-w-[11rem] overflow-hidden rounded-2xl border-[3px] transition-transform group-hover:scale-110',
                border
              )}>
                <img src={char.image} alt={char.name} className="h-full w-full object-cover" />
              </div>
              <p className="font-headline text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] sm:text-3xl">{char.name}</p>
              <p className="max-w-[11rem] text-center font-label text-xs font-bold leading-tight text-white/60 sm:text-sm">
                {t(`heroRunnerTagline_${id}`)}
              </p>
              <div className={cn(
                'mt-1 rounded-full px-5 py-2 font-headline text-xs font-black uppercase tracking-wider text-white sm:text-sm',
                id === 'nico'
                  ? 'bg-gradient-to-r from-[#0891b2] to-[#22d3ee]'
                  : 'bg-gradient-to-r from-[#db2777] to-[#f472b6]',
                shadow,
                'active:translate-y-1 active:shadow-none'
              )}>
                {t('heroRunnerPickMe')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MathHeroScreen({
  user,
  mapLevel,
  onWin,
  onLose,
  onUpdateHistory,
  onSaveScore,
  onRequestDoubleReward,
  adsRemoved,
}: MathHeroScreenProps) {
  const { t } = useTranslation();
  const [charId, setCharId] = useState<RunnerCharId | null>(null);
  const diff = useMemo(() => getDifficultyForLevel(mapLevel), [mapLevel]);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [laneIndex, setLaneIndex] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [displayTime, setDisplayTime] = useState(diff.initialTime);
  const [isPaused, setIsPaused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [particleBurst, setParticleBurst] = useState(false);
  const [doubled, setDoubled] = useState(false);
  const [lives, setLives] = useState(MAX_LIVES);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [finishActive, setFinishActive] = useState(false);
  const [goalConfettiTrigger, setGoalConfettiTrigger] = useState(0);
  const [doubleBusy, setDoubleBusy] = useState(false);

  const gateZRef = useRef(GATE_START_Z);
  const speedRef = useRef(diff.baseSpeed);
  const baseSpeedRef = useRef(diff.baseSpeed);
  const timerRef = useRef(diff.initialTime);
  const pausedRef = useRef(false);
  const endedRef = useRef(false);
  const jumpVelRef = useRef(0);
  const jumpYRef = useRef(0);
  const shakeRef = useRef(0);
  const effectRef = useRef<{ type: 'boost' | 'slow' | null; timer: number }>({ type: null, timer: 0 });
  const flashRef = useRef({ color: '#4ade80', opacity: 0 });
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const [obstacles, setObstacles] = useState<ObstacleData[]>([]);
  const totalCoinsRef = useRef(0);
  const scoreSavedRef = useRef(false);
  const finishActiveRef = useRef(false);
  const goalFinishTimeoutRef = useRef<number | null>(null);

  const glbUrl = charId ? RUNNER_CHARACTERS[charId].glb : '';

  useEffect(() => {
    if (charId && !problem) {
      setProblem(generateAdaptiveProblem(user, 'MATH_HERO', undefined, mapLevel));
      const obs = spawnObstacles(diff.obstacleChance, diff.maxObstacles);
      obstaclesRef.current = obs;
      setObstacles(obs);
    }
  }, [charId, problem, user, mapLevel, diff]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    finishActiveRef.current = finishActive;
  }, [finishActive]);

  useEffect(() => {
    return () => {
      if (goalFinishTimeoutRef.current != null) {
        window.clearTimeout(goalFinishTimeoutRef.current);
      }
    };
  }, []);

  const runTier = useMemo(
    () => Math.min(FINISH_LEVEL, Math.floor(correctCount / BLOCKS_PER_LEVEL) + 1),
    [correctCount]
  );
  const levelBlockProgress = useMemo(() => {
    if (correctCount >= TOTAL_GOAL_CORRECT) return BLOCKS_PER_LEVEL;
    return correctCount % BLOCKS_PER_LEVEL;
  }, [correctCount]);

  const nextProblem = useCallback(() => {
    setProblem(generateAdaptiveProblem(user, 'MATH_HERO', undefined, mapLevel));
    const newObs = spawnObstacles(diff.obstacleChance, diff.maxObstacles);
    obstaclesRef.current = newObs;
    setObstacles(newObs);
  }, [user, mapLevel, diff]);

  const canReceiveReward = endReason !== 'QUIT';
  const earnedCoins = canReceiveReward ? (correctCount * diff.coinsPerCorrect) * (doubled ? 2 : 1) : 0;

  const topScores = useMemo(() => {
    const existing = user.heroRunnerScores?.[mapLevel] ?? [];
    const all = [...existing, correctCount].sort((a, b) => b - a).slice(0, 5);
    return all;
  }, [user.heroRunnerScores, mapLevel, correctCount]);

  const handleGateResult = useCallback(
    (correct: boolean) => {
      if (endedRef.current) return;
      if (!problem?.gates) return;

      const key = `${problem.a}x${problem.b}`;
      onUpdateHistory(key, correct, mapLevel);

      if (correct) {
        audio.playSfx('correct');
        timerRef.current = Math.min(diff.timeMax, timerRef.current + diff.timeCorrect);
        totalCoinsRef.current += diff.coinsPerCorrect;
        setCorrectCount((c) => {
          const n = c + 1;
          baseSpeedRef.current = diff.baseSpeed * (1 + Math.min(n, 20) * 0.012);
          return n;
        });

        effectRef.current = { type: 'boost', timer: BOOST_DURATION };
        flashRef.current = { color: '#4ade80', opacity: 0.25 };
        setParticleBurst(false);
        requestAnimationFrame(() => setParticleBurst(true));

        const reachedFinish = (correctCount + 1) >= TOTAL_GOAL_CORRECT;
        if (reachedFinish) {
          setFinishActive(true);
        } else {
          nextProblem();
        }
      } else {
        audio.playSfx('wrong');
        shakeRef.current = 1;
        setLives((prev) => {
          const next = Math.max(0, prev - 1);
          if (next <= 0) {
            endedRef.current = true;
            setEndReason('LIVES');
            setShowResults(true);
            return 0;
          }
          return next;
        });
        timerRef.current = Math.max(0, timerRef.current - diff.timeWrong);

        effectRef.current = { type: 'slow', timer: SLOW_DURATION };
        flashRef.current = { color: '#ef4444', opacity: 0.3 };

        if (timerRef.current <= 0) {
          endedRef.current = true;
          setEndReason('TIME');
          setShowResults(true);
        } else if (!endedRef.current) {
          nextProblem();
        }
      }
      setDisplayTime(Math.ceil(timerRef.current));
    },
    [problem, mapLevel, diff, onUpdateHistory, nextProblem, correctCount]
  );

  const handleTimeDrain = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    audio.playSfx('wrong');
    setEndReason('TIME');
    setShowResults(true);
  }, []);

  const handleObstacleHit = useCallback(() => {
    if (endedRef.current) return;
    audio.playSfx('wrong');
    shakeRef.current = 0.6;
    timerRef.current = Math.max(0, timerRef.current - 2);
    flashRef.current = { color: '#f97316', opacity: 0.2 };
    effectRef.current = { type: 'slow', timer: OBSTACLE_SLOW_DURATION };
    setDisplayTime(Math.ceil(timerRef.current));
    if (timerRef.current <= 0 && !endedRef.current) {
      endedRef.current = true;
      setEndReason('TIME');
      setShowResults(true);
    }
  }, []);

  const handleReachGoal = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEndReason('GOAL');
    setGoalConfettiTrigger((n) => n + 1);
    goalFinishTimeoutRef.current = window.setTimeout(() => {
      setShowResults(true);
      goalFinishTimeoutRef.current = null;
    }, 850);
  }, []);

  const onTickSecond = useCallback((sec: number) => {
    setDisplayTime(sec);
  }, []);

  useEffect(() => {
    if (showResults && !scoreSavedRef.current) {
      scoreSavedRef.current = true;
      onSaveScore(mapLevel, correctCount);
    }
  }, [showResults, mapLevel, correctCount, onSaveScore]);

  const handleResultsDone = useCallback(() => {
    if (endReason === 'QUIT') {
      onLose();
      return;
    }
    const coins = totalCoinsRef.current * (doubled ? 2 : 1);
    if (coins > 0) {
      onWin(coins);
    } else {
      onLose();
    }
  }, [onWin, onLose, doubled, endReason]);

  const handleDoubleReward = useCallback(async () => {
    if (doubleBusy || doubled) return;
    setDoubleBusy(true);
    try {
      const ok = await onRequestDoubleReward();
      if (ok) setDoubled(true);
    } finally {
      setDoubleBusy(false);
    }
  }, [doubleBusy, doubled, onRequestDoubleReward]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showResults || !charId) return;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setLaneIndex((l) => Math.max(0, l - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setLaneIndex((l) => Math.min(3, l + 1));
      } else if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (jumpYRef.current <= 0.02) jumpVelRef.current = 9;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showResults, charId]);

  if (!charId) {
    return <CharacterSelect onSelect={setCharId} />;
  }

  if (!problem?.gates || problem.gates.length < 4) return null;

  const timerWarm = displayTime > 20;
  const timerMid = displayTime >= 10 && displayTime <= 20;

  if (showResults) {
    const isNewBest = topScores[0] === correctCount;
    const endReasonText =
      endReason === 'GOAL'
        ? 'Meta alcanzada'
        : endReason === 'LIVES'
          ? 'Sin vidas'
          : endReason === 'QUIT'
            ? 'Abandono'
            : 'Tiempo agotado';
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center bg-[#08051a] p-4 overflow-y-auto">
        <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-[2rem] border-2 border-[#a78bfa]/40 bg-[#1a1028]/95 p-6 shadow-[0_0_60px_rgba(167,139,250,0.3)] backdrop-blur-md sm:p-8">
          <h2 className="w-full text-center font-headline text-3xl font-black uppercase tracking-tight text-transparent bg-gradient-to-r from-[#fbbf24] to-[#fb7185] bg-clip-text sm:text-4xl">
            {t('heroRunnerResultsTitle')}
          </h2>
          <p className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-widest text-white/80">
            Fin: {endReasonText}
          </p>

          <div className="flex w-full justify-around">
            <div className="flex flex-col items-center gap-1">
              <p className="font-label text-[10px] font-bold uppercase tracking-widest text-white/50">{t('heroRunnerCorrect')}</p>
              <p className="font-headline text-4xl font-black text-[#86efac]">{correctCount}</p>
              {isNewBest && <p className="text-xs font-bold text-[#fbbf24] animate-pulse">{t('heroRunnerNewBest')}</p>}
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="font-label text-[10px] font-bold uppercase tracking-widest text-white/50">{t('heroRunnerCoinsEarned')}</p>
              <div className="flex items-center gap-2">
                <p className="font-headline text-4xl font-black text-[#fde047] drop-shadow-[0_0_12px_rgba(253,224,71,0.5)]">
                  {earnedCoins}
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-[#fbbf24] to-[#d97706] font-headline text-sm font-black text-[#78350f]">M</span>
              </div>
            </div>
          </div>

          {/* Double reward */}
          {!doubled && canReceiveReward && earnedCoins > 0 && (
            <button
              type="button"
              disabled={doubleBusy}
              onClick={() => {
                void handleDoubleReward();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#fbbf24]/50 bg-gradient-to-r from-[#422006]/80 to-[#78350f]/80 py-3 font-headline text-sm font-black uppercase text-[#fde047] shadow-[0_0_20px_rgba(251,191,36,0.2)] active:scale-95"
            >
              <Play className="h-5 w-5" />
              {doubleBusy
                ? '...'
                : adsRemoved
                  ? t('solveMultiplicationToDouble', { defaultValue: 'Resuelve multiplicación para doblar' })
                  : t('heroRunnerDoubleReward')}
            </button>
          )}
          {doubled && (
            <p className="text-center font-headline text-sm font-black text-[#4ade80]">{t('heroRunnerDoubled')}</p>
          )}

          {/* Top 5 leaderboard */}
          <div className="w-full rounded-xl border border-white/10 bg-[#0f0a1e]/60 p-3">
            <p className="mb-2 text-center font-label text-xs font-bold uppercase tracking-widest text-white/50">{t('heroRunnerTop5')}</p>
            <div className="flex flex-col gap-1">
              {topScores.map((score, idx) => {
                const isCurrentRun = score === correctCount && idx === topScores.indexOf(correctCount);
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-1.5 text-sm',
                      isCurrentRun ? 'bg-[#fbbf24]/15 text-[#fde047]' : 'text-white/70'
                    )}
                  >
                    <span className="font-headline font-black">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <span className="font-headline font-black tabular-nums">{score} {t('heroRunnerCorrect').toLowerCase()}</span>
                  </div>
                );
              })}
              {topScores.length === 0 && (
                <p className="py-2 text-center text-xs text-white/40">—</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleResultsDone}
            className="w-full rounded-3xl bg-gradient-to-b from-[#a78bfa] to-[#6d28d9] py-4 text-center font-headline text-lg font-black uppercase tracking-wider text-white shadow-[0_8px_0_0_#4c1d95] active:translate-y-2 active:shadow-none"
          >
            {t('heroRunnerContinue')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#08051a]">
      <WebGLErrorBoundary
        onFallbackExit={onLose}
        title={t('mathHeroWebglTitle')}
        body={t('mathHeroWebglBody')}
        backLabel={t('mathHeroWebglBack')}
      >
      <div className="relative min-h-0 flex-1">
        <Canvas
          className="h-full w-full min-h-[300px] touch-none"
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 4.35, 9.4], fov: 50, near: 0.1, far: 200 }}
          gl={{ antialias: false, powerPreference: 'default', precision: 'mediump', alpha: false, stencil: false, depth: true }}
          onCreated={({ gl }) => {
            gl.setClearColor('#08051a');
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.getContext().canvas.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              console.warn('[MathHero] WebGL context lost');
            });
          }}
        >
          <SceneR3f
            laneIndex={laneIndex}
            gates={problem.gates}
            answer={problem.answer}
            gateZRef={gateZRef}
            jumpYRef={jumpYRef}
            shakeRef={shakeRef}
            speedRef={speedRef}
            pausedRef={pausedRef}
            endedRef={endedRef}
            finishActive={finishActive}
            goalConfettiTrigger={goalConfettiTrigger}
            obstacles={obstacles}
            particleBurst={particleBurst}
            flashRef={flashRef}
            glbUrl={glbUrl}
          />
          <GameLoop
            laneIndex={laneIndex}
            gates={problem.gates}
            answer={problem.answer}
            gateZRef={gateZRef}
            speedRef={speedRef}
            baseSpeedRef={baseSpeedRef}
            timerRef={timerRef}
            pausedRef={pausedRef}
            endedRef={endedRef}
            jumpVelRef={jumpVelRef}
            jumpYRef={jumpYRef}
            shakeRef={shakeRef}
            effectRef={effectRef}
            obstaclesRef={obstaclesRef}
            finishActiveRef={finishActiveRef}
            onGateResult={handleGateResult}
            onTimeDrain={handleTimeDrain}
            onTickSecond={onTickSecond}
            onObstacleHit={handleObstacleHit}
            onReachGoal={handleReachGoal}
          />
        </Canvas>

        {/* HUD: coins | timer | level + question bubble */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-3 pt-3 sm:pt-4">
          <div className="flex w-full max-w-lg items-start justify-between gap-2">
            <div className="pointer-events-none flex items-center gap-2 rounded-full border-[3px] border-[#fbbf24] bg-[#1a1028]/90 px-3 py-1.5 shadow-[0_0_20px_rgba(251,191,36,0.35)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-[#fbbf24] to-[#d97706] font-headline text-xs font-black text-[#78350f]">M</span>
              <span className="font-headline text-2xl font-black tabular-nums text-[#fef08a]">{correctCount * diff.coinsPerCorrect}</span>
            </div>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'rounded-2xl border-[3px] px-5 py-2 text-center shadow-[0_0_24px_rgba(0,0,0,0.45)]',
                  timerWarm && 'border-[#4ade80] bg-[#052e16]/90 shadow-[0_0_28px_rgba(74,222,128,0.35)]',
                  timerMid && 'border-[#fbbf24] bg-[#422006]/90 shadow-[0_0_24px_rgba(251,191,36,0.3)]',
                  !timerWarm && !timerMid && 'border-[#fb7185] bg-[#450a0a]/90 shadow-[0_0_26px_rgba(251,113,133,0.35)] animate-pulse'
                )}
              >
                <p
                  className={cn(
                    'font-headline text-3xl font-black tabular-nums leading-none sm:text-4xl',
                    timerWarm && 'text-[#86efac]',
                    timerMid && 'text-[#fde047]',
                    !timerWarm && !timerMid && 'text-[#fecaca]'
                  )}
                >
                  {displayTime}s
                </p>
                <p className="mt-0.5 font-label text-[10px] font-extrabold uppercase tracking-widest text-white/80">
                  {t('mathHeroTimeLabel')}
                </p>
              </div>
            </div>
            <div className="rounded-full border-[3px] border-[#a78bfa] bg-[#2e1065]/90 px-3 py-2 text-center shadow-[0_0_18px_rgba(167,139,250,0.4)]">
              <p className="font-headline text-sm font-black text-[#e9d5ff]">{t('mathHeroLevelShort', { n: runTier })}</p>
              <p className="mt-0.5 font-label text-[10px] font-bold tracking-wide text-white/75">{levelBlockProgress}/{BLOCKS_PER_LEVEL}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <span key={i} className={cn('text-lg', i < lives ? 'text-[#fb7185]' : 'text-white/25')}>❤</span>
            ))}
          </div>

          <div className="mt-3 w-full max-w-md rounded-[1.75rem] border-2 border-[#a78bfa]/50 bg-[#3b1f5c]/55 px-5 py-3 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <p className="text-[10px] font-medium leading-snug text-white/60 sm:text-xs">{t('mathHeroMixedHint')}</p>
            <p className="mt-1 font-headline text-sm font-bold text-white sm:text-base">{t('mathHeroHowMuch')}</p>
            <p className="mt-1 font-headline text-4xl font-black tracking-tight sm:text-5xl">
              <span className="text-[#fde047] drop-shadow-[0_0_12px_rgba(253,224,71,0.45)]">{problem.a}</span>
              <span className="mx-1.5 text-[#fb7185] drop-shadow-[0_0_10px_rgba(251,113,133,0.5)]">×</span>
              <span className="text-[#fde047] drop-shadow-[0_0_12px_rgba(253,224,71,0.45)]">{problem.b}</span>
            </p>
          </div>
        </div>

        <div
          className={cn(
            'absolute left-0 right-0 z-30 w-full px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-3',
            'portrait:flex portrait:items-end portrait:justify-between portrait:gap-2',
            'landscape:bottom-4 landscape:flex landscape:items-center landscape:justify-center landscape:gap-7 landscape:px-5'
          )}
          style={{ bottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        >
          {/* Retrato: lateral izq — salto (pulgar zurdo) + carril ← abajo */}
          <div className="pointer-events-auto flex max-w-[48%] flex-col items-center gap-2.5 landscape:hidden">
            <button
              type="button"
              aria-label={t('mathHeroJump')}
              className="flex h-14 min-w-[5.75rem] items-center justify-center rounded-2xl border-[3px] border-[#fbbf24] bg-[#1c1917]/95 px-3 font-headline text-sm font-black uppercase tracking-wide text-[#fef08a] shadow-[0_0_22px_rgba(251,191,36,0.35)] active:scale-95 sm:h-16 sm:min-w-[6.5rem] sm:text-base"
              onPointerDown={() => {
                audio.playSfx('click');
                if (jumpYRef.current <= 0.02) jumpVelRef.current = 9;
              }}
            >
              {t('mathHeroJump')}
            </button>
            <button
              type="button"
              aria-label={t('mathHeroLeft')}
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#22d3ee] bg-[#0f172a]/95 text-[#67e8f9] shadow-[0_0_22px_rgba(34,211,238,0.35)] active:scale-95 sm:h-[4.75rem] sm:w-[4.75rem]"
              onPointerDown={() => {
                audio.playSfx('click');
                setLaneIndex((l) => Math.max(0, l - 1));
              }}
            >
              <ChevronLeft size={40} strokeWidth={2.5} className="sm:h-11 sm:w-11" />
            </button>
          </div>

          {/* Retrato: lateral der — salto (pulgar diestro) + carril → abajo */}
          <div className="pointer-events-auto flex max-w-[48%] flex-col items-center gap-2.5 landscape:hidden">
            <button
              type="button"
              aria-label={t('mathHeroJump')}
              className="flex h-14 min-w-[5.75rem] items-center justify-center rounded-2xl border-[3px] border-[#fbbf24] bg-[#1c1917]/95 px-3 font-headline text-sm font-black uppercase tracking-wide text-[#fef08a] shadow-[0_0_22px_rgba(251,191,36,0.35)] active:scale-95 sm:h-16 sm:min-w-[6.5rem] sm:text-base"
              onPointerDown={() => {
                audio.playSfx('click');
                if (jumpYRef.current <= 0.02) jumpVelRef.current = 9;
              }}
            >
              {t('mathHeroJump')}
            </button>
            <button
              type="button"
              aria-label={t('mathHeroRight')}
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#fb7185] bg-[#0f172a]/95 text-[#fda4af] shadow-[0_0_22px_rgba(251,113,133,0.35)] active:scale-95 sm:h-[4.75rem] sm:w-[4.75rem]"
              onPointerDown={() => {
                audio.playSfx('click');
                setLaneIndex((l) => Math.min(3, l + 1));
              }}
            >
              <ChevronRight size={40} strokeWidth={2.5} className="sm:h-11 sm:w-11" />
            </button>
          </div>

          {/* Apaisado: fila centrada clásica */}
          <div className="pointer-events-auto hidden items-center gap-6 sm:gap-8 landscape:flex">
            <button
              type="button"
              aria-label={t('mathHeroLeft')}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#22d3ee] bg-[#0f172a]/95 text-[#67e8f9] shadow-[0_0_22px_rgba(34,211,238,0.35)] active:scale-95 sm:h-[4.5rem] sm:w-[4.5rem]"
              onPointerDown={() => {
                audio.playSfx('click');
                setLaneIndex((l) => Math.max(0, l - 1));
              }}
            >
              <ChevronLeft size={42} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label={t('mathHeroJump')}
              className="flex h-16 min-w-[6rem] items-center justify-center rounded-2xl border-[3px] border-[#fbbf24] bg-[#1c1917]/95 px-4 font-headline text-base font-black uppercase tracking-wide text-[#fef08a] shadow-[0_0_22px_rgba(251,191,36,0.35)] active:scale-95 sm:h-[4.5rem] sm:min-w-[6.5rem]"
              onPointerDown={() => {
                audio.playSfx('click');
                if (jumpYRef.current <= 0.02) jumpVelRef.current = 9;
              }}
            >
              {t('mathHeroJump')}
            </button>
            <button
              type="button"
              aria-label={t('mathHeroRight')}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#fb7185] bg-[#0f172a]/95 text-[#fda4af] shadow-[0_0_22px_rgba(251,113,133,0.35)] active:scale-95 sm:h-[4.5rem] sm:w-[4.5rem]"
              onPointerDown={() => {
                audio.playSfx('click');
                setLaneIndex((l) => Math.min(3, l + 1));
              }}
            >
              <ChevronRight size={42} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          audio.playSfx('click');
          setIsPaused((p) => !p);
        }}
        className="fixed right-4 top-20 z-40 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#a78bfa]/60 bg-[#1e1433]/95 text-[#e9d5ff] shadow-lg backdrop-blur-md sm:right-5 sm:top-24 sm:h-12 sm:w-12"
      >
        {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      </button>

      {isPaused && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#08051a]/94 p-6 backdrop-blur-md">
          <h2 className="mb-8 font-headline text-4xl font-black uppercase tracking-tight text-transparent bg-gradient-to-r from-[#c084fc] to-[#fde047] bg-clip-text">
            {t('pauseTitle')}
          </h2>
          <div className="flex w-full max-w-sm flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsPaused(false)}
              className="rounded-3xl bg-gradient-to-b from-[#a78bfa] to-[#6d28d9] py-4 text-center font-black uppercase tracking-wider text-white shadow-[0_8px_0_0_#4c1d95] active:translate-y-2 active:shadow-none"
            >
              {t('resume')}
            </button>
            <button
              type="button"
              onClick={() => {
                endedRef.current = true;
                setEndReason('QUIT');
                setShowResults(true);
              }}
              className="rounded-3xl border-2 border-white/10 bg-[#2A2A45] py-4 text-center font-black uppercase tracking-wider text-white shadow-[0_8px_0_0_#1A1A30] active:translate-y-2"
            >
              {t('quitRun')}
            </button>
          </div>
        </div>
      )}
      </WebGLErrorBoundary>
    </div>
  );
}
