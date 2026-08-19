import type { UserState } from '../types';

/**
 * Dominio de una tabla: mezcla aciertos y nivel medio del mapa en el que se acertó.
 * Sin levelSumCorrect (partidas antiguas) se estima con currentUserLevel.
 */
export function computeTableMasteryPercent(
  problemHistory: UserState['problemHistory'],
  table: number,
  currentUserLevel: number
): number {
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let levelSum = 0;

  for (let i = 1; i <= 10; i++) {
    const key = `${table}x${i}`;
    const h = problemHistory[key];
    if (!h) continue;
    totalCorrect += h.correct;
    totalIncorrect += h.incorrect;
    levelSum += h.levelSumCorrect ?? 0;
  }

  const attempts = totalCorrect + totalIncorrect;
  if (attempts === 0) return 0;

  const accuracy = totalCorrect / attempts;

  let avgSolveLevel = 0;
  if (totalCorrect > 0) {
    if (levelSum > 0) {
      avgSolveLevel = levelSum / totalCorrect;
    } else {
      // Datos antiguos: aproximar con el progreso actual del mapa
      avgSolveLevel = Math.max(1, Math.min(100, currentUserLevel * 0.75));
    }
  }

  const levelFactor = Math.min(1, avgSolveLevel / 100);
  const blended = accuracy * (0.22 + 0.78 * levelFactor);
  return Math.min(100, Math.round(blended * 100));
}

export function recomputeAllTableMastery(
  problemHistory: UserState['problemHistory'],
  currentUserLevel: number
): Record<number, number> {
  const m: Record<number, number> = {};
  for (let t = 1; t <= 10; t++) {
    m[t] = computeTableMasteryPercent(problemHistory, t, currentUserLevel);
  }
  return m;
}
