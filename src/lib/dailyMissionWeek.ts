/**
 * Misión diaria (lunes–domingo, calendario local del dispositivo).
 * Sin servidor: toda la lógica es determinista a partir de fechas locales.
 *
 * Manual QA (cambiar fecha del dispositivo/emulador):
 * - Lunes: primera misión con premio → 100.
 * - Mar tras Lun cobrado → 150; si saltas Lun y solo cobras Mar → 100.
 * - Hueco entre días → siguiente premio vuelve a 100 dentro de la semana.
 * - Nuevo lunes → otra vez 100 aunque el domingo anterior hubiera racha.
 */

export const DAILY_MISSION_REWARD_COINS = [100, 150, 250, 400, 600, 800, 1000] as const;

export const DAILY_BONUS_AD_REWARD_COINS = [100, 150, 200, 250, 300] as const;

export const DAILY_BONUS_AD_MAX_PER_DAY = 5;

/** Si true, las monedas de misión diaria y bonus ads usan `coinRewardBonusPercent` del equipo. */
export const DAILY_MISSION_APPLY_SHOP_COIN_BONUS = true;

/** YYYY-MM-DD en zona horaria local. */
export function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lunes de la semana que contiene `d` (medianoche local del día calendario). */
export function getMondayOfWeekLocal(d: Date): Date {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jsDay = day.getDay(); // 0 Sun … 6 Sat
  const daysFromMonday = (jsDay + 6) % 7; // Mon → 0, Sun → 6
  day.setDate(day.getDate() - daysFromMonday);
  return day;
}

export function mondayKeyLocal(now: Date = new Date()): string {
  return dateKeyLocal(getMondayOfWeekLocal(now));
}

/** Las 7 claves YYYY-MM-DD de lunes a domingo de esa semana (lunes = weekMonday). */
export function listWeekDayKeysFromMonday(weekMonday: Date): string[] {
  const keys: string[] = [];
  const base = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate());
  for (let i = 0; i < 7; i++) {
    const x = new Date(base);
    x.setDate(base.getDate() + i);
    keys.push(dateKeyLocal(x));
  }
  return keys;
}

/** Índices 0–6 dentro de la semana para una clave (lunes=0). -1 si no pertenece. */
export function dayIndexInWeek(weekMonday: Date, dayKey: string): number {
  const keys = listWeekDayKeysFromMonday(weekMonday);
  return keys.indexOf(dayKey);
}

/**
 * Días consecutivos con premio de misión **antes** de `todayKey`, solo dentro de
 * [lunes … ayer] de la semana de `weekMonday`. Si `todayKey` es lunes, devuelve 0.
 */
export function countConsecutiveRewardedDaysBeforeToday(
  weekMonday: Date,
  todayKey: string,
  rewardedDates: Record<string, true | undefined>
): number {
  const keys = listWeekDayKeysFromMonday(weekMonday);
  const todayIdx = keys.indexOf(todayKey);
  if (todayIdx < 0) return 0;
  let n = 0;
  for (let i = todayIdx - 1; i >= 0; i--) {
    if (rewardedDates[keys[i]]) n += 1;
    else break;
  }
  return n;
}

/** Monedas base (sin % tienda) para la primera victoria con premio de `todayKey`. */
export function getDailyMissionBaseCoins(
  weekMonday: Date,
  todayKey: string,
  rewardedDates: Record<string, true | undefined>
): number {
  const prior = countConsecutiveRewardedDaysBeforeToday(weekMonday, todayKey, rewardedDates);
  const idx = Math.min(DAILY_MISSION_REWARD_COINS.length - 1, prior);
  return DAILY_MISSION_REWARD_COINS[idx];
}

/** Siguiente premio del modal de anuncios (0-based index = veces ya completadas hoy). */
export function getNextBonusAdCoins(alreadyWatchedToday: number): number {
  if (alreadyWatchedToday < 0 || alreadyWatchedToday >= DAILY_BONUS_AD_REWARD_COINS.length) {
    return DAILY_BONUS_AD_REWARD_COINS[DAILY_BONUS_AD_REWARD_COINS.length - 1];
  }
  return DAILY_BONUS_AD_REWARD_COINS[alreadyWatchedToday];
}

export function isBonusAdCapReached(countToday: number): boolean {
  return countToday >= DAILY_BONUS_AD_MAX_PER_DAY;
}

/** Recorta fechas premiadas a la semana actual y resetea contador de anuncios bonus si cambió el día. */
export function normalizeDailyMissionStorage<T extends {
  dailyMissionWeekMonday?: string;
  dailyMissionRewardedDates?: Record<string, true>;
  dailyMissionBonusAds?: { dateKey: string; count: number };
}>(user: T, now: Date = new Date()): T {
  const mon = getMondayOfWeekLocal(now);
  const monKey = dateKeyLocal(mon);
  const weekKeys = listWeekDayKeysFromMonday(mon);
  const raw = user.dailyMissionRewardedDates || {};
  const nextRewarded: Record<string, true> = {};
  for (const k of weekKeys) {
    if (raw[k]) nextRewarded[k] = true;
  }
  const todayKey = dateKeyLocal(now);
  const bonus = user.dailyMissionBonusAds;
  const nextBonus =
    !bonus || bonus.dateKey !== todayKey ? { dateKey: todayKey, count: 0 } : { ...bonus };

  return {
    ...user,
    dailyMissionWeekMonday: monKey,
    dailyMissionRewardedDates: nextRewarded,
    dailyMissionBonusAds: nextBonus,
  };
}
