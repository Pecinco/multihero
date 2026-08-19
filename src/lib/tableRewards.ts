import { UserState } from '../types';

const REWARD_TIERS = [200, 125, 100, 75, 60, 50, 40, 30, 20, 10] as const;

/**
 * Orden de más difícil → más fácil cuando no hay datos suficientes (resto de juegos).
 * Coincide con la petición: 7, 8, 9, 6, 4, 3, 5, 2, 10, 1
 */
export const DEFAULT_ORDER_HARD_TO_EASY = [7, 8, 9, 6, 4, 3, 5, 2, 10, 1] as const;

/** Mínimo de respuestas registradas en problemHistory para fiarnos del ranking por fallos. */
const MIN_TOTAL_ATTEMPTS = 25;

type TableStat = { correct: number; incorrect: number };

function emptyStats(): Record<number, TableStat> {
  const s: Record<number, TableStat> = {};
  for (let t = 1; t <= 10; t++) {
    s[t] = { correct: 0, incorrect: 0 };
  }
  return s;
}

/** Agrupa por tabla del primer factor (6x7 → tabla 6), igual que el dominio en el juego. */
function aggregateByTable(problemHistory: UserState['problemHistory']): {
  stats: Record<number, TableStat>;
  totalAttempts: number;
} {
  const stats = emptyStats();
  const h = problemHistory || {};
  for (const [key, val] of Object.entries(h)) {
    const parts = key.split('x');
    if (parts.length < 2) continue;
    const table = parseInt(parts[0], 10);
    if (Number.isNaN(table) || table < 1 || table > 10) continue;
    const c = Number(val?.correct) || 0;
    const i = Number(val?.incorrect) || 0;
    stats[table].correct += c;
    stats[table].incorrect += i;
  }
  let totalAttempts = 0;
  for (let t = 1; t <= 10; t++) {
    totalAttempts += stats[t].correct + stats[t].incorrect;
  }
  return { stats, totalAttempts };
}

/**
 * Recompensas por minijuego de tablas: prioriza tablas con más fallos en batallas/runner/etc.
 * Sin datos suficientes usa DEFAULT_ORDER_HARD_TO_EASY.
 */
export function getTableRewards(user: UserState): Record<number, number> {
  const { stats, totalAttempts } = aggregateByTable(user.problemHistory);
  const defaultIdx = new Map<number, number>(
    DEFAULT_ORDER_HARD_TO_EASY.map((t, i) => [t, i])
  );

  const tables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  let ordered: number[];
  if (totalAttempts < MIN_TOTAL_ATTEMPTS) {
    ordered = [...DEFAULT_ORDER_HARD_TO_EASY];
  } else {
    ordered = [...tables].sort((a, b) => {
      const sa = stats[a];
      const sb = stats[b];
      if (sa.incorrect !== sb.incorrect) {
        return sb.incorrect - sa.incorrect;
      }
      const ta = sa.correct + sa.incorrect;
      const tb = sb.correct + sb.incorrect;
      const ra = ta > 0 ? sa.incorrect / ta : 0;
      const rb = tb > 0 ? sb.incorrect / tb : 0;
      if (Math.abs(ra - rb) > 1e-9) {
        return rb - ra;
      }
      return (defaultIdx.get(a) ?? 99) - (defaultIdx.get(b) ?? 99);
    });
  }

  const rewardByTable: Record<number, number> = {};
  ordered.forEach((table, i) => {
    rewardByTable[table] = REWARD_TIERS[i] ?? 10;
  });
  return rewardByTable;
}
