import { ShopItem } from '../types';
import { SHOP_ITEMS } from '../constants';

/** Fracción de vida máxima que restaura al pulsar en batalla (una vez por combate). */
export const BATTLE_CONSUMABLE_HEAL_FRACTION: Record<string, number> = {
  pot_life: 0.15,
  pot_energy: 0.3,
  pot_special: 0.5,
};

/** Buff temporal de daño al usar ciertas hierbas en batalla (una vez por combate). */
export const BATTLE_CONSUMABLE_DAMAGE_BOOST: Record<string, { multiplier: number; durationSec: number }> = {
  herb_basic: { multiplier: 1.2, durationSec: 10 },
  herb_energy: { multiplier: 1.22, durationSec: 12 },
  herb_mystic: { multiplier: 1.28, durationSec: 15 },
};

export function isBattleConsumableType(type: ShopItem['type']): boolean {
  return type === 'POTION' || type === 'HERB';
}

export function getEquippedBattleConsumables(equippedIds: string[] | undefined): ShopItem[] {
  const ids = equippedIds || [];
  const out: ShopItem[] = [];
  for (const id of ids) {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (item && isBattleConsumableType(item.type)) out.push(item);
  }
  return out;
}

export function getHealFractionForBattleConsumable(item: ShopItem): number {
  return BATTLE_CONSUMABLE_HEAL_FRACTION[item.id] ?? 0;
}

export function getDamageBoostForBattleConsumable(item: ShopItem): { multiplier: number; durationSec: number } | null {
  return BATTLE_CONSUMABLE_DAMAGE_BOOST[item.id] ?? null;
}
