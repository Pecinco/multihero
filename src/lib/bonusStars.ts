import type { UserState } from '../types';

/** localStorage convierte claves numéricas a string; normalizamos a número. */
export function normalizeBonusStars(raw: unknown): Record<number, 1 | 2 | 3> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<number, 1 | 2 | 3> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    if (v === 1 || v === 2 || v === 3) out[n] = v;
  }
  return out;
}

export function getStarsForLevel(
  raw: Record<number, 1 | 2 | 3> | undefined,
  levelIndex: number
): 0 | 1 | 2 | 3 {
  if (!raw) return 0;
  const v = raw[levelIndex] ?? (raw as Record<string, 1 | 2 | 3 | undefined>)[String(levelIndex)];
  return v === 1 || v === 2 || v === 3 ? v : 0;
}

export function getBonusStarsForLevel(raw: UserState['bonusStars'], levelIndex: number): 0 | 1 | 2 | 3 {
  return getStarsForLevel(raw, levelIndex);
}

export function getBonusHeroStarsForLevel(raw: UserState['bonusHeroStars'], levelIndex: number): 0 | 1 | 2 | 3 {
  return getStarsForLevel(raw, levelIndex);
}
