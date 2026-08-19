import { SHOP_ITEMS } from '../constants';

export type AggregatedMods = {
  hpMult: number;
  dmgMult: number;
  /** Multiplicador del daño que recibes (<1 = menos daño). */
  incomingDamageMult: number;
  /** Suma de % extra de monedas en victorias (mapa, bonus, tablas). */
  coinRewardBonusPercent: number;
  /** >1 acelera la barra del runner (progreso por tick). */
  runnerProgressMult: number;
};

const defaultAgg: AggregatedMods = {
  hpMult: 1,
  dmgMult: 1,
  incomingDamageMult: 1,
  coinRewardBonusPercent: 0,
  runnerProgressMult: 1,
};

export function getAggregatedShopModifiers(equippedIds: (string | undefined)[] | undefined): AggregatedMods {
  const ids = (equippedIds || []).filter(Boolean) as string[];
  if (ids.length === 0) return { ...defaultAgg };

  let hpMult = 1;
  let dmgMult = 1;
  let incomingDamageMult = 1;
  let coinRewardBonusPercent = 0;
  let runnerProgressMult = 1;

  for (const id of ids) {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    const m = item?.modifiers;
    if (!m) continue;
    if (m.hpMultiplier && m.hpMultiplier > 0) hpMult *= m.hpMultiplier;
    if (m.damageMultiplier && m.damageMultiplier > 0) dmgMult *= m.damageMultiplier;
    if (m.incomingDamageMultiplier && m.incomingDamageMultiplier > 0) {
      incomingDamageMult *= m.incomingDamageMultiplier;
    }
    if (m.coinRewardBonusPercent) coinRewardBonusPercent += m.coinRewardBonusPercent;
    if (m.runnerProgressMultiplier && m.runnerProgressMultiplier > 0) {
      runnerProgressMult *= m.runnerProgressMultiplier;
    }
  }

  return {
    hpMult,
    dmgMult,
    incomingDamageMult,
    coinRewardBonusPercent,
    runnerProgressMult,
  };
}
