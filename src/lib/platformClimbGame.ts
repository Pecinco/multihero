import type { UserState } from '../types';
import { PLATFORM_CLIMB_ROUNDS } from '../constants';
import { generateAdaptiveProblem, type Problem } from './engine';

/**
 * Mundo horizontal tipo Sonic/Mario: el héroe avanza de izquierda a derecha
 * atravesando tramos con variedad (colinas, tuberías, muelles, plataformas flotantes,
 * carriles de monedas...) y cada tramo acaba en una "puerta" con 3 bloques de quiz
 * sobre un pequeño foso. Solo el bloque con la respuesta correcta permite cruzar;
 * al fallar, el héroe respawnea en el último checkpoint (no desde el principio).
 */
export const PLATFORM_PHYSICS = {
  GRAVITY: 2100,
  MOVE_SPEED: 300,
  JUMP_VELOCITY: -820,
  PLAYER_W: 44,
  PLAYER_H: 50,
  /** Ancho "de referencia" para HUD y escalado mínimo. El mundo real es mucho más largo. */
  WORLD_W: 820,
  /** Ancho de los bloques de quiz (elevados sobre el foso). */
  QUIZ_PLATFORM_W: 72,
  QUIZ_PLATFORM_H: 30,
  /** Oscilación vertical muy suave para bloques de quiz (subir/bajar levemente). */
  OSC_AMPLITUDE: 0,
  OSC_FREQ: 0,
  QUIZ_OSC_AMP_Y: 5,
  QUIZ_OSC_FREQ_Y: 0.9,
  /** Mantenido por compatibilidad con la deco — no se usa en el builder horizontal. */
  STAIR_STEP_W: 92,
  STAIR_STEP_LAST_W: 114,
  STAIR_STEP_H: 22,
  STAIR_RISE: 40,
  STAIR_ZIG: 50,
  STAIR_ZIG_LAST2: 30,
  STAIR_COUNT_BEFORE_QUIZ: 5,
  STAIR_FUNNEL_COUNT: 3,
  GAP_BEFORE_QUIZ: 56,
  LEDGE_H: 22,
  GAP_AFTER_QUIZ: 58,
  GAP_LEDGE_TO_STAIRS: 38,
  /** Velocidad vertical que imprime un muelle al ser pisado. */
  SPRING_VELOCITY: -1180,
} as const;

export type GamePlatformKind =
  | 'ground'
  | 'stair'
  | 'ledge'
  | 'quiz'
  | 'pipe'
  | 'spring'
  | 'hill'
  | 'goal';

export type GamePlatform = {
  kind: GamePlatformKind;
  label: number;
  /** Índice de multiplicación (0..n-1); null si no es quiz */
  quizIndex: number | null;
  /** Casilla correcta: sigue en verde */
  solved?: boolean;
  solveAnchorX?: number;
  /** Fila contestada: desbloquea el siguiente tramo */
  quizRowResolved?: boolean;
  /** Casilla incorrecta tras fallo: aspecto piedra */
  quizWrongStone?: boolean;
  /** Sin colisión hasta que la fila de quiz con este índice esté resuelta */
  blockedUntilQuizSolved?: number;
  baseX: number;
  baseY: number;
  w: number;
  h: number;
  phase: number;
  amp: number;
  freq: number;
  /** Oscilación vertical opcional (para plataformas móviles tipo ascensor o bloques de quiz con bob). */
  ampY?: number;
  freqY?: number;
  /** Variante visual (tinte, textura, decoración). */
  variant?: number;
  /** Animación del muelle al disparar (segundos de sim al último rebote). */
  springFiredAt?: number;
};

export type PlayerBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  /**
   * Plataforma sobre la que el jugador está apoyado actualmente (o null si está en el aire / suelo base).
   * Si la plataforma oscila, el jugador se desplaza con ella (horizontal y verticalmente).
   */
  standingOn?: GamePlatform | null;
};

/** Bandera de checkpoint (visual + respawn). `solvedUpTo` = cuántos quiz se salvan si respawneas aquí. */
export type Checkpoint = {
  x: number;
  y: number;
  solvedUpTo: number;
};

/**
 * Moneda recolectable (MatiCoin). Cada una suma recompensa al final del minijuego.
 * `bonus` = valor extra (normalmente 1; las doradas "secretas" pueden valer más).
 */
export type CollectibleCoin = {
  x: number;
  y: number;
  r: number;
  bonus: number;
  /** 'path' = en la ruta natural; 'detour' = requiere desviarse/subir. */
  kind: 'path' | 'detour';
  collected: boolean;
  /** Desfase visual de la animación de giro. */
  phase: number;
  /** Tramo al que pertenece; sólo se cuentan las del tramo activo (sin spoilear). */
  sectionIndex: number;
};

export type ContinuousLevel = {
  platforms: GamePlatform[];
  problems: (Problem & { gates: number[] })[];
  groundY: number;
  /** Bordes horizontales del mundo (clamp del jugador). */
  worldMinX: number;
  worldMaxX: number;
  /** Y mínima (cielo visible) y máxima (bajo tierra) */
  worldMinY: number;
  worldMaxY: number;
  spawnX: number;
  spawnY: number;
  checkpoints: Checkpoint[];
  /** X del castillo meta (solo visual). */
  goalX: number;
  /** X del arco final: el jugador debe cruzarlo físicamente para terminar. */
  archX: number;
  /** Monedas recolectables repartidas por el mundo. */
  coins: CollectibleCoin[];
  /** Color / bioma asociado al nivel del mapa, 0..5. */
  biome: number;
};

export function createPlayer(spawnX: number, spawnY: number): PlayerBody {
  return {
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    w: PLATFORM_PHYSICS.PLAYER_W,
    h: PLATFORM_PHYSICS.PLAYER_H,
    onGround: true,
    standingOn: null,
  };
}

export function platformWorldX(p: GamePlatform, timeSec: number): number {
  if (p.kind === 'quiz') {
    if (p.quizWrongStone) return p.baseX;
    if (p.solved && p.solveAnchorX != null) return p.solveAnchorX;
    if (p.solved) return p.baseX;
  }
  if (!p.amp || !p.freq) return p.baseX;
  return p.baseX + p.amp * Math.sin(p.phase + timeSec * p.freq * 2);
}

/** Oscilación vertical: usada por ascensores y por el bob suave de los bloques de quiz. */
export function platformWorldY(p: GamePlatform, timeSec: number): number {
  const ay = p.ampY ?? 0;
  const fy = p.freqY ?? 0;
  if (!ay || !fy) return p.baseY;
  if (p.kind === 'quiz' && (p.quizWrongStone || p.solved)) return p.baseY;
  return p.baseY + ay * Math.sin(p.phase + timeSec * fy * 2);
}

export type StepInputClean = { left: boolean; right: boolean; jump: boolean };

export type StepResult = {
  landedPlatform: GamePlatform | null;
  fellOutOfBounds: boolean;
  /** Disparó un muelle este paso (para SFX/FX). */
  bouncedSpring: GamePlatform | null;
  /** El jugador chocó horizontalmente con una tubería. */
  hitPipe: GamePlatform | null;
};

function isPlatformActive(p: GamePlatform, platforms: GamePlatform[]): boolean {
  if (p.blockedUntilQuizSolved === undefined) return true;
  return isQuizRowSolved(platforms, p.blockedUntilQuizSolved);
}

function resolveHorizontalCollision(
  player: PlayerBody,
  prevX: number,
  platforms: GamePlatform[],
  timeSec: number
): GamePlatform | null {
  let hit: GamePlatform | null = null;
  for (const p of platforms) {
    if (p.kind !== 'pipe' && p.kind !== 'goal') continue;
    if (!isPlatformActive(p, platforms)) continue;
    const px = platformWorldX(p, timeSec);
    const py = platformWorldY(p, timeSec);
    const pw = p.w;
    const ph = p.h;
    const yOverlap = player.y + player.h > py + 1 && player.y < py + ph - 1;
    const xOverlap = player.x + player.w > px && player.x < px + pw;
    if (!(yOverlap && xOverlap)) continue;
    const prevRight = prevX + player.w;
    const prevLeft = prevX;
    if (prevRight <= px + 0.5) {
      player.x = px - player.w;
      hit = p;
    } else if (prevLeft >= px + pw - 0.5) {
      player.x = px + pw;
      hit = p;
    } else {
      const dLeft = player.x + player.w - px;
      const dRight = px + pw - player.x;
      if (dLeft < dRight) player.x = px - player.w;
      else player.x = px + pw;
      hit = p;
    }
  }
  return hit;
}

function buildSectionVariety(
  platforms: GamePlatform[],
  startX: number,
  width: number,
  groundY: number,
  floorH: number,
  variant: number
): void {
  /** Suelo base continuo del tramo (evita huecos y "dificultad inesperada"). */
  platforms.push({
    kind: 'ground',
    label: 0,
    quizIndex: null,
    baseX: startX,
    baseY: groundY,
    w: width,
    h: floorH,
    phase: 0,
    amp: 0,
    freq: 0,
    variant,
  });

  const midX = startX + width / 2;
  const v = ((variant % 8) + 8) % 8;

  if (v === 0) {
    /** Trío de plataformas flotantes ascendentes: ruta aérea claramente vertical. */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.18, baseY: groundY - 110, w: 92, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.45, baseY: groundY - 175, w: 92, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.72, baseY: groundY - 130, w: 92, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  } else if (v === 1) {
    /** Colina decorativa + plataforma alta con ascensor vertical para alcanzarla. */
    platforms.push({
      kind: 'hill', label: 0, quizIndex: null,
      baseX: startX + width * 0.18, baseY: groundY - 60, w: 170, h: 60,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    /** Ascensor: plataforma con oscilación vertical entre -60 y -180. */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.48, baseY: groundY - 130, w: 70, h: 18,
      phase: 0, amp: 0, freq: 0, ampY: 60, freqY: 0.55, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.72, baseY: groundY - 190, w: 110, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  } else if (v === 2) {
    /** Tótem de cristal en medio para saltar + plataforma alta detrás. */
    platforms.push({
      kind: 'pipe', label: 0, quizIndex: null,
      baseX: midX - 36, baseY: groundY - 80, w: 72, h: 80,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.74, baseY: groundY - 150, w: 96, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  } else if (v === 3) {
    /** Muelle + dos plataformas encadenadas en altura (ruta vertical opcional). */
    platforms.push({
      kind: 'spring', label: 0, quizIndex: null,
      baseX: startX + width * 0.22, baseY: groundY - 20, w: 46, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.48, baseY: groundY - 220, w: 110, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.78, baseY: groundY - 150, w: 96, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  } else if (v === 4) {
    /** Dos tótems bajos seguidos (saltos cortos). */
    platforms.push({
      kind: 'pipe', label: 0, quizIndex: null,
      baseX: startX + width * 0.28, baseY: groundY - 58, w: 58, h: 58,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'pipe', label: 0, quizIndex: null,
      baseX: startX + width * 0.6, baseY: groundY - 58, w: 58, h: 58,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    /** Bonus alto entre ambos. */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.42, baseY: groundY - 170, w: 80, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  } else if (v === 5) {
    /** "Escalera" de bloques hacia arriba: avance vertical + horizontal. */
    for (let i = 0; i < 4; i++) {
      const stepW = 62;
      platforms.push({
        kind: 'stair', label: (variant % 6),
        quizIndex: null,
        baseX: startX + width * 0.2 + i * stepW,
        baseY: groundY - 40 - i * 46,
        w: stepW, h: 24,
        phase: 0, amp: 0, freq: 0, variant: v,
      });
    }
    /** Plataforma superior de premio. */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.75, baseY: groundY - 230, w: 110, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  } else if (v === 6) {
    /** Plataforma móvil horizontal (va y viene) + plataforma alta estática. */
    const mvBaseX = startX + width * 0.35;
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: mvBaseX, baseY: groundY - 120, w: 92, h: 20,
      phase: 0, amp: 80, freq: 0.7, variant: v,
    });
    /** Segunda móvil vertical como ascensor. */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.64, baseY: groundY - 140, w: 70, h: 18,
      phase: Math.PI / 2, amp: 0, freq: 0, ampY: 55, freqY: 0.6, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.82, baseY: groundY - 210, w: 92, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  } else {
    /**
     * v=7: TORRE VERTICAL. Muro de tótems obliga a subir y cruzar por arriba,
     * combinando avance vertical + horizontal en el mismo tramo.
     */
    const wallX = startX + width * 0.62;
    /** Muelle al inicio: catapulta directa si el jugador prefiere vertical puro. */
    platforms.push({
      kind: 'spring', label: 0, quizIndex: null,
      baseX: startX + width * 0.05, baseY: groundY - 20, w: 46, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    /** Muro: dos tótems juntos formando pared. */
    platforms.push({
      kind: 'pipe', label: 0, quizIndex: null,
      baseX: wallX, baseY: groundY - 150, w: 48, h: 150,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'pipe', label: 0, quizIndex: null,
      baseX: wallX + 48, baseY: groundY - 150, w: 48, h: 150,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    /** Escalada izquierda (3 escalones generosos para aterrizaje cómodo). */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.12, baseY: groundY - 90, w: 110, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.28, baseY: groundY - 160, w: 100, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.42, baseY: groundY - 230, w: 100, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    /** Tejado que cruza el muro (más alto que los tótems, por encima del jugador). */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: wallX - 10, baseY: groundY - 230, w: 140, h: 22,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    /** Descenso derecho (2 escalones, bien alineados con el tejado). */
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.82, baseY: groundY - 160, w: 100, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
    platforms.push({
      kind: 'ledge', label: 0, quizIndex: null,
      baseX: startX + width * 0.9, baseY: groundY - 90, w: 90, h: 20,
      phase: 0, amp: 0, freq: 0, variant: v,
    });
  }
}

function layoutQuizGate(
  platforms: GamePlatform[],
  gateStartX: number,
  gateWidth: number,
  groundY: number,
  gates: number[],
  quizIndex: number,
  blockedUntilQuizSolved?: number
): void {
  const phys = PLATFORM_PHYSICS;
  const qW = phys.QUIZ_PLATFORM_W;
  const qH = phys.QUIZ_PLATFORM_H;
  /**
   * DISEÑO DE ALCANZABILIDAD (verificado con la física del juego):
   *   gravedad 2100, jumpV -820, moveSpeed 300, playerW 44.
   *   Alcance máximo horizontal durante un salto ≈ 234px, altura pico ≈ 160px.
   *
   * Se colocan los TRES bloques a la MISMA altura baja (60 sobre el suelo).
   * Con "full-right" desde el borde izquierdo del foso, la trayectoria parabólica
   * pasa POR ENCIMA de los dos primeros bloques (porque en esos X el jugador aún
   * está por encima de 60px de altura) y aterriza sobre el TERCERO (el más lejano).
   *
   * Para elegir el bloque del medio hay que soltar "right" a mitad de salto.
   * Para elegir el primero, soltar "right" muy pronto.
   * Así cada respuesta es alcanzable y la del extremo NO obliga a cruzar la central.
   */
  const blockH = 60; // altura del top sobre el suelo
  const edgePad = 8;
  const gap = 10;
  const total = 2 * edgePad + 3 * qW + 2 * gap;
  const extra = Math.max(0, gateWidth - total);
  const leftPad = edgePad + Math.floor(extra / 2);
  const x0 = gateStartX + leftPad;
  const x1 = x0 + qW + gap;
  const x2 = x1 + qW + gap;
  const xs = [x0, x1, x2];
  const ys = [
    groundY - blockH,
    groundY - blockH,
    groundY - blockH,
  ];
  const phases = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

  for (let i = 0; i < 3; i++) {
    platforms.push({
      kind: 'quiz',
      label: gates[i]!,
      quizIndex,
      ...(blockedUntilQuizSolved !== undefined ? { blockedUntilQuizSolved } : {}),
      baseX: Math.round(xs[i]!),
      baseY: Math.round(ys[i]!),
      w: qW,
      h: qH,
      phase: phases[i]!,
      amp: phys.OSC_AMPLITUDE,
      freq: phys.OSC_FREQ,
      ampY: phys.QUIZ_OSC_AMP_Y,
      freqY: phys.QUIZ_OSC_FREQ_Y,
      variant: i,
    });
  }
}

/**
 * Mundo horizontal: suelo-seguro → variedad de tramos → puerta de quiz con foso → siguiente tramo ...
 * → castillo meta al final.
 */
export function buildContinuousLevel(
  user: UserState,
  rounds: number = PLATFORM_CLIMB_ROUNDS,
  mapLevel: number = 1
): ContinuousLevel {
  const phys = PLATFORM_PHYSICS;
  const biome = ((Math.floor(mapLevel) % 6) + 6) % 6;
  const problems: (Problem & { gates: number[] })[] = [];
  for (let i = 0; i < rounds; i++) {
    const p = generateAdaptiveProblem(user, 'RUNNER', undefined);
    if (p.gates && p.gates.length >= 2) {
      problems.push(p as Problem & { gates: number[] });
    }
  }
  let guard = 0;
  while (problems.length < rounds && guard < 200) {
    guard++;
    const p = generateAdaptiveProblem(user, 'RUNNER', undefined);
    if (p.gates && p.gates.length >= 2) {
      problems.push(p as Problem & { gates: number[] });
    }
  }
  while (problems.length < rounds) {
    const a = 3 + (problems.length % 6);
    const b = 2 + (problems.length % 7);
    const ans = a * b;
    problems.push({
      a,
      b,
      answer: ans,
      options: [],
      gates: [ans, ans + 4, ans + 9],
    } as Problem & { gates: number[] });
  }

  const groundY = 560;
  const floorH = 62;
  const playerH = phys.PLAYER_H;
  const platforms: GamePlatform[] = [];
  const checkpoints: Checkpoint[] = [];
  const coins: CollectibleCoin[] = [];

  const SPAWN_PAD_W = 440;
  const SECTION_PRE_W = 620;
  /** Ancho del foso: 3 bloques de 72 + 2 gaps de 10 + 2 pads de 8 = 252. Mayor que el alcance directo 234 para impedir cruzarlo de un salto sin tocar quiz. */
  const GATE_PIT_W = 252;
  const GATE_POST_W = 220;

  const addCoin = (
    x: number,
    y: number,
    sectionIndex: number,
    kind: 'path' | 'detour' = 'path',
    bonus?: number,
    phaseSeed: number = 0
  ) => {
    /** Las monedas "detour" valen 2; las de ruta natural, 1. */
    const finalBonus = bonus ?? (kind === 'detour' ? 2 : 1);
    coins.push({
      x,
      y,
      r: 11,
      bonus: finalBonus,
      kind,
      collected: false,
      phase: phaseSeed,
      sectionIndex,
    });
  };

  /** Trail horizontal de monedas a una altura dada. */
  const addCoinTrail = (
    x0: number,
    y: number,
    count: number,
    step: number,
    section: number,
    kind: 'path' | 'detour' = 'path'
  ) => {
    for (let i = 0; i < count; i++) {
      addCoin(x0 + i * step, y, section, kind, undefined, i * 0.6);
    }
  };

  /** Arco ascendente de monedas (parábola suave) entre dos puntos, útil sobre fosos. */
  const addCoinArc = (
    x0: number,
    x1: number,
    yTop: number,
    yEnds: number,
    count: number,
    section: number
  ) => {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = x0 + (x1 - x0) * t;
      const yP = yEnds - (yEnds - yTop) * 4 * t * (1 - t);
      addCoin(x, yP, section, 'path', 1, i * 0.5);
    }
  };

  let cursorX = 0;

  platforms.push({
    kind: 'ground', label: 0, quizIndex: null,
    baseX: 0, baseY: groundY, w: SPAWN_PAD_W, h: floorH,
    phase: 0, amp: 0, freq: 0, variant: 0,
  });
  checkpoints.push({ x: 40, y: groundY - playerH - 0.5, solvedUpTo: 0 });
  /** Monedas iniciales sobre la rampa de salida para enseñar la mecánica. */
  addCoinTrail(160, groundY - 90, 4, 44, 0, 'path');
  cursorX = SPAWN_PAD_W;

  for (let qi = 0; qi < rounds; qi++) {
    /** Variedad rotativa: depende del tramo + mapLevel + hash del problema. */
    const variant = (qi * 3 + biome + problems[qi]!.a) % 8;
    const secStartX = cursorX;
    buildSectionVariety(platforms, cursorX, SECTION_PRE_W, groundY, floorH, variant);

    /**
     * Monedas por variante: la ruta natural tiene monedas; las detour (altas, alejadas)
     * requieren que el jugador se desvíe de su camino.
     */
    const secSec = qi;
    const secW = SECTION_PRE_W;
    if (variant === 0) {
      addCoin(secStartX + secW * 0.18 + 46, groundY - 145, secSec);
      addCoin(secStartX + secW * 0.45 + 46, groundY - 215, secSec, 'detour');
      addCoin(secStartX + secW * 0.72 + 46, groundY - 165, secSec);
    } else if (variant === 1) {
      addCoinTrail(secStartX + secW * 0.48 - 20, groundY - 180, 3, 20, secSec, 'detour');
      addCoinTrail(secStartX + secW * 0.72, groundY - 230, 4, 30, secSec, 'detour');
    } else if (variant === 2) {
      addCoinArc(
        secStartX + secW * 0.35,
        secStartX + secW * 0.66,
        groundY - 230,
        groundY - 140,
        5,
        secSec
      );
    } else if (variant === 3) {
      addCoinTrail(secStartX + secW * 0.47, groundY - 260, 5, 28, secSec, 'detour');
      addCoin(secStartX + secW * 0.82, groundY - 190, secSec);
    } else if (variant === 4) {
      addCoin(secStartX + secW * 0.46, groundY - 210, secSec, 'detour');
      addCoinArc(
        secStartX + secW * 0.28 + 58,
        secStartX + secW * 0.6,
        groundY - 160,
        groundY - 105,
        4,
        secSec
      );
    } else if (variant === 5) {
      for (let i = 0; i < 4; i++) {
        addCoin(secStartX + secW * 0.2 + i * 62 + 31, groundY - 75 - i * 46, secSec);
      }
      addCoinTrail(secStartX + secW * 0.75, groundY - 270, 3, 36, secSec, 'detour');
    } else if (variant === 6) {
      addCoinArc(
        secStartX + secW * 0.3,
        secStartX + secW * 0.55,
        groundY - 200,
        groundY - 130,
        4,
        secSec
      );
      addCoinTrail(secStartX + secW * 0.82, groundY - 250, 3, 30, secSec, 'detour');
    } else {
      /** v=7: monedas escondidas encima del tejado (requieren subir la torre). */
      addCoinTrail(secStartX + secW * 0.46, groundY - 270, 4, 34, secSec, 'detour');
      addCoin(secStartX + secW * 0.12 + 55, groundY - 130, secSec);
      addCoin(secStartX + secW * 0.9 + 45, groundY - 130, secSec);
    }
    cursorX += SECTION_PRE_W;

    /** Foso con los 3 bloques del quiz. Sin suelo entre borde izquierdo del foso y borde derecho. */
    const gateStartX = cursorX;
    layoutQuizGate(
      platforms,
      gateStartX,
      GATE_PIT_W,
      groundY,
      problems[qi]!.gates!,
      qi,
      qi > 0 ? qi - 1 : undefined
    );
    cursorX += GATE_PIT_W;

    /** Suelo post-puerta (zona segura + checkpoint). Permanece "bloqueado" hasta resolver el quiz. */
    platforms.push({
      kind: 'ground',
      label: 0,
      quizIndex: null,
      blockedUntilQuizSolved: qi,
      baseX: cursorX,
      baseY: groundY,
      w: GATE_POST_W,
      h: floorH,
      phase: 0, amp: 0, freq: 0, variant: biome,
    });
    /** Monedas premio sobre el suelo post-puerta (visibles al resolver el quiz). */
    addCoinTrail(cursorX + 30, groundY - 90, 4, 36, qi);
    checkpoints.push({
      x: cursorX + 40,
      y: groundY - playerH - 0.5,
      solvedUpTo: qi + 1,
    });
    cursorX += GATE_POST_W;
  }

  /**
   * Zona final: tras la última respuesta todavía hay que recorrer un trecho y cruzar
   * un arco de meta. Incluye monedas y un par de plataformas altas con bonus.
   */
  const FINAL_W = 820;
  const finalStartX = cursorX;
  platforms.push({
    kind: 'ground', label: 0, quizIndex: null,
    baseX: cursorX, baseY: groundY, w: FINAL_W, h: floorH,
    phase: 0, amp: 0, freq: 0, variant: biome,
  });
  /** Dos ledges altos con monedas de bonificación. */
  platforms.push({
    kind: 'ledge', label: 0, quizIndex: null,
    baseX: finalStartX + 120, baseY: groundY - 160, w: 110, h: 20,
    phase: 0, amp: 0, freq: 0, variant: 0,
  });
  platforms.push({
    kind: 'ledge', label: 0, quizIndex: null,
    baseX: finalStartX + 300, baseY: groundY - 230, w: 110, h: 20,
    phase: 0, amp: 0, freq: 0, variant: 0,
  });
  const finalSec = rounds;
  addCoinTrail(finalStartX + 130, groundY - 200, 4, 28, finalSec, 'detour');
  addCoinTrail(finalStartX + 310, groundY - 270, 4, 28, finalSec, 'detour');
  addCoinTrail(finalStartX + 40, groundY - 90, 6, 44, finalSec, 'path');
  addCoinTrail(finalStartX + 520, groundY - 90, 5, 40, finalSec, 'path');

  /** X del ARCO DE META: la meta no se dispara hasta cruzarlo físicamente. */
  const archX = finalStartX + FINAL_W - 180;
  /** El castillo decorativo queda justo detrás del arco. */
  const goalX = finalStartX + FINAL_W - 40;
  cursorX += FINAL_W;

  const worldMinX = 0;
  const worldMaxX = cursorX;
  const worldMinY = groundY - 560;
  const worldMaxY = groundY + floorH + 420;
  const spawnX = 60;
  const spawnY = groundY - playerH - 0.5;

  return {
    platforms,
    problems,
    groundY,
    worldMinX,
    worldMaxX,
    worldMinY,
    worldMaxY,
    spawnX,
    spawnY,
    checkpoints,
    goalX,
    archX,
    coins,
    biome,
  };
}

/** Tras acertar: solo la casilla correcta queda "viva" en verde; las otras pasan a piedra. */
export function markQuizRowComplete(
  platforms: GamePlatform[],
  quizIndex: number,
  correctLabel: number,
  timeSec: number
) {
  for (const p of platforms) {
    if (p.kind !== 'quiz' || p.quizIndex !== quizIndex) continue;
    p.quizRowResolved = true;
    if (p.label === correctLabel) {
      p.solved = true;
      p.solveAnchorX = p.baseX + (p.amp ? p.amp * Math.sin(p.phase + timeSec * p.freq * 2) : 0);
    } else {
      p.quizWrongStone = true;
    }
  }
}

/** Reinicia la fila de un quiz aún no resuelto (tras respawn de checkpoint). */
export function resetQuizRow(platforms: GamePlatform[], quizIndex: number) {
  for (const p of platforms) {
    if (p.kind !== 'quiz' || p.quizIndex !== quizIndex) continue;
    p.solved = false;
    p.quizRowResolved = false;
    p.quizWrongStone = false;
    p.solveAnchorX = undefined;
  }
}

export function isQuizRowSolved(platforms: GamePlatform[], quizIndex: number): boolean {
  return platforms.some((p) => p.kind === 'quiz' && p.quizIndex === quizIndex && p.quizRowResolved);
}

/**
 * Detecta colisión entre el jugador (AABB) y cada moneda pendiente.
 * Devuelve el bonus total recogido en este tick y muta las monedas tocadas.
 */
export function collectCoinsInRange(player: PlayerBody, coins: CollectibleCoin[]): number {
  const px0 = player.x;
  const py0 = player.y;
  const px1 = player.x + player.w;
  const py1 = player.y + player.h;
  let collected = 0;
  for (const c of coins) {
    if (c.collected) continue;
    const cxClamped = Math.max(px0, Math.min(px1, c.x));
    const cyClamped = Math.max(py0, Math.min(py1, c.y));
    const dx = c.x - cxClamped;
    const dy = c.y - cyClamped;
    if (dx * dx + dy * dy <= c.r * c.r) {
      c.collected = true;
      collected += c.bonus;
    }
  }
  return collected;
}

/**
 * Un paso de simulación horizontal. Mutates `player`.
 *  - Clamp del jugador al mundo [worldMinX, worldMaxX].
 *  - Colisión horizontal con tuberías/poste-meta.
 *  - Colisión vertical (aterrizaje) con suelo/plataformas/muelles/quiz.
 *  - `fellOutOfBounds`: cuando cae por debajo del suelo un trecho generoso (pit).
 */
export function stepSimulation(
  player: PlayerBody,
  dt: number,
  input: StepInputClean,
  platforms: GamePlatform[],
  timeSec: number,
  groundY: number,
  worldMinX = 0,
  worldMaxX = Infinity
): StepResult {
  const phys = PLATFORM_PHYSICS;
  const prevTime = timeSec - dt;

  /**
   * "Platform carrying": si el jugador está apoyado en una plataforma oscilante
   * (horizontal o vertical), se desplaza junto a ella antes de procesar input.
   * Esto evita que (a) se quede quieto mientras una plataforma horizontal se mueve debajo,
   * o (b) que parezca "pisar aire" sobre un ascensor vertical (efecto de "pipí" de polvo).
   */
  const carry = player.standingOn && player.onGround ? player.standingOn : null;
  if (carry) {
    const dx = platformWorldX(carry, timeSec) - platformWorldX(carry, prevTime);
    const dy = platformWorldY(carry, timeSec) - platformWorldY(carry, prevTime);
    player.x += dx;
    player.y += dy;
  }

  const prevBottom = player.y + player.h;
  const prevX = player.x;
  const wasAirborne = !player.onGround;

  player.vx = 0;
  if (input.left) player.vx -= phys.MOVE_SPEED;
  if (input.right) player.vx += phys.MOVE_SPEED;
  player.x += player.vx * dt;
  player.x = Math.max(worldMinX, Math.min(worldMaxX - player.w, player.x));

  const hitPipe = resolveHorizontalCollision(player, prevX, platforms, timeSec);

  if (player.onGround && input.jump) {
    player.vy = phys.JUMP_VELOCITY;
    player.onGround = false;
    player.standingOn = null;
  }

  player.vy += phys.GRAVITY * dt;
  player.y += player.vy * dt;

  player.onGround = false;
  let landedPlatform: GamePlatform | null = null;
  let bouncedSpring: GamePlatform | null = null;
  let supportPlatform: GamePlatform | null = null;

  /**
   * Orden: más altas físicamente primero (menor baseY) para que al caer se aterrice en la primera
   * que el jugador cruza en su descenso, no en una inferior si ambas solapan en X.
   */
  const platSorted = [...platforms].sort((a, b) => a.baseY - b.baseY);

  for (const p of platSorted) {
    if (p.kind === 'hill') continue;
    if (p.kind === 'goal') continue;
    if (!isPlatformActive(p, platforms)) continue;

    const px = platformWorldX(p, timeSec);
    const py = platformWorldY(p, timeSec);
    const overlapX = player.x + player.w > px + 2 && player.x < px + p.w - 2;
    if (!overlapX) continue;

    const platTop = py;
    const playerBottom = player.y + player.h;
    const penetrating = playerBottom > platTop && player.y < py + p.h;

    if (penetrating && player.vy >= 0 && prevBottom <= platTop + 16) {
      player.y = platTop - player.h;
      if (p.kind === 'spring') {
        player.vy = phys.SPRING_VELOCITY;
        player.onGround = false;
        bouncedSpring = p;
        p.springFiredAt = timeSec;
        supportPlatform = null;
      } else {
        if (player.vy > 0) player.vy = 0;
        player.onGround = true;
        supportPlatform = p;
      }
      if (wasAirborne) {
        landedPlatform = p;
      }
      break;
    }
  }

  player.standingOn = supportPlatform;

  if (!player.onGround && player.y + player.h >= groundY) {
    /**
     * Suelo "pseudo-infinito" como colchón: solo si había suelo justo debajo. En el mundo horizontal
     * con fosos, esto ya no aplica — las bajadas son controladas por los ground platforms. Dejamos
     * el check desactivado: la caída al foso la detecta `fellOutOfBounds`.
     */
  }

  const fellOutOfBounds = player.y > groundY + 320;

  return { landedPlatform, fellOutOfBounds, bouncedSpring, hitPipe };
}

export function problemHasGates(p: Problem | null): p is Problem & { gates: number[] } {
  return !!p?.gates && p.gates.length >= 2;
}
