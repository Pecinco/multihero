export type Screen =
  | 'AUTH_GATE'
  | 'MAP'
  | 'BATTLE'
  | 'SHOP'
  | 'INVENTORY'
  | 'PROFILE'
  | 'SETTINGS'
  | 'AUDIO_SETTINGS'
  | 'AVATAR_SELECTION'
  | 'RUNNER'
  | 'MATH_HERO'
  | 'VICTORY'
  | 'TABLES'
  | 'MULTIPLAYER'
  | 'PVP_BATTLE'
  | 'PVP_TUG'
  | 'PVP_SPRINT'
  | 'PLATFORM_CLIMB'
  | 'DAILY_MISSION_HUB';

/** Origen de la victoria para recompensas y progreso de mapa. */
export type WinSource =
  | 'MAP_BATTLE'
  | 'FAST_BATTLE'
  | 'BONUS_RUNNER'
  | 'BONUS_MATH_HERO'
  | 'TABLES'
  | 'PLATFORM_CLIMB'
  | 'DAILY_PLATFORM';

export interface UserState {
  level: number;
  xp: number;
  coins: number;
  energy: number;
  streak: number;
  solvedCount: number;
  selectedAvatar: string;
  language: 'Spanish' | 'Catalan' | 'English' | 'French' | 'Portuguese' | 'German' | 'Dutch' | 'Russian';
  difficulty?: 'EASY' | 'NORMAL' | 'HARD';
  unlockedItems: string[];
  mastery: Record<number, number>; // table number -> percentage
  /** Lunes local (YYYY-MM-DD) de la semana usada para el hub de misión diaria. */
  dailyMissionWeekMonday?: string;
  /** Días locales en los que ya se cobró el premio de la misión diaria (una vez). */
  dailyMissionRewardedDates?: Record<string, true>;
  /** Anuncios bonus del calendario: máx. 5 por día local; `count` = ya vistos con premio ese día. */
  dailyMissionBonusAds?: { dateKey: string; count: number };
  /** Suma de niveles de mapa en cada acierto (para dominio ponderado). */
  problemHistory: Record<string, { correct: number; incorrect: number; levelSumCorrect?: number }>; // e.g. "6x7"
  currentLevel: number; // For map progression 1-30
  equippedItems: string[]; // Active item IDs
  /** Inventario por itemId. Consumibles pueden tener cantidad >1. */
  itemInventory?: Record<string, number>;
  playerName?: string;
  hasAcceptedTerms?: boolean;
  /** Si ya vio la pantalla post-onboarding de login/guest. */
  authPromptShown?: boolean;
  /** Código corto para compartir (también en RTDB users/{uid}/friendCode); la identidad multiplayer es auth.uid. */
  friendCode?: string;
  friends?: { id: string; name: string; level: number; avatar: string }[];
  /** Solicitudes recibidas (persisten en localStorage). */
  friendRequestsIncoming?: { fromId: string; name: string; level: number; avatar: string; receivedAt: number }[];
  /** Solicitudes enviadas pendientes de aceptación. */
  friendRequestsOutgoing?: { toId: string; sentAt: number }[];
  /** Nodos bonus runner 2D (10, 20, …), rama derecha del mapa; estrellas 1–3 por dificultad. */
  bonusStars?: Record<number, 1 | 2 | 3>;
  /** Nodos normales del mapa (batalla): estrellas 1–3 según dificultad lograda en ese nivel. */
  levelStars?: Record<number, 1 | 2 | 3>;
  /** Nodos bonus Math Hero (5, 10, 15, …): minijuego 3D a la izquierda. */
  bonusHeroStars?: Record<number, 1 | 2 | 3>;
  /** Top scores por nivel del Hero Runner: { level: [score1, score2, ...] } máx 5 por nivel. */
  heroRunnerScores?: Record<number, number[]>;
  /** Compra premium para quitar anuncios y desbloquear retos de multiplicación en su lugar. */
  adsRemoved?: boolean;
  /** Evita mostrar varias veces el diploma final del nivel 100. */
  diplomaLevel100Awarded?: boolean;
  /** Marca temporal local/remota para resolver sincronización básica cloud/local. */
  updatedAt?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Nivel de mapa mínimo para poder comprar */
  unlockLevel: number;
  image: string;
  type: 'ARMOR' | 'HELMET' | 'PEN' | 'POTION' | 'HERB' | 'PET';
  rarity?: 'BASIC' | 'RARE' | 'EPIC' | 'LEGENDARY';
  skills?: string[];
  bonus?: string;
  modifiers?: {
    hpMultiplier?: number;
    damageMultiplier?: number;
    /** <1 reduce daño recibido en batalla (p. ej. 0.85 = -15%). */
    incomingDamageMultiplier?: number;
    /** % extra de monedas al ganar batallas, bonus o tablas (suma con otros ítems). */
    coinRewardBonusPercent?: number;
    /** Multiplicador del avance del monstruo en el runner (>1 = más rápido el jugador). */
    runnerProgressMultiplier?: number;
  };
}

export interface Avatar {
  id: string;
  name: string;
  image: string;
  description: string;
  unlockLevel?: number;
}
