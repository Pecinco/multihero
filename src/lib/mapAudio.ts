/**
 * Música de mapa por “mundo”: cada 10 niveles (1–10, 11–20, …) = mundo 1–10,
 * igual que los fondos del mapa (`1-10map.jpg`, `11-20map.jpg`, …).
 *
 * Archivos en `public/audio/world1.mp3` … `world10.mp3`.
 */
export const DEFAULT_MAP_BGM = '/audio/world1.mp3';

/** Una ruta por mundo (índice 0 = mundo 1). */
export const MAP_WORLD_BGM_PATHS: readonly string[] = Array.from({ length: 10 }, (_, i) => `/audio/world${i + 1}.mp3`);

export function getMapWorldBgmPath(world: number): string {
  const w = Math.max(1, Math.min(10, Math.floor(world) || 1));
  return MAP_WORLD_BGM_PATHS[w - 1] ?? DEFAULT_MAP_BGM;
}

/** Nivel de mapa 1–100 → mundo 1–10. */
export function getMapWorldFromLevel(level: number): number {
  const l = Math.max(1, Math.min(100, Math.floor(level) || 1));
  return Math.min(10, Math.floor((l - 1) / 10) + 1);
}
