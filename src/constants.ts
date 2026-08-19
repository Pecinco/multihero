import { ShopItem, Avatar, Achievement } from './types';

/**
 * Precios y nivel de desbloqueo alineados con monedas por batalla (~50–200+ por nivel).
 * Cada pieza solo un tipo por ranura (armadura, casco, bolígrafo, poción, hierba, mascota).
 */
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'armor_basic',
    name: 'Armadura — Aegis Lite',
    description: 'Para los primeros mapas: más vida en combate sin complicaciones.',
    price: 520,
    unlockLevel: 3,
    type: 'ARMOR',
    rarity: 'BASIC',
    image: '/img/shop/armadura basica.jpg',
    skills: ['+15% vida/defensa', 'Pasiva: -4% daño recibido'],
    modifiers: { hpMultiplier: 1.15, incomingDamageMultiplier: 0.96 },
  },
  {
    id: 'armor_rare',
    name: 'Armadura — Aegis Core',
    description: 'Para quien ya domina varias tablas: gran resistencia antes de los jefes duros.',
    price: 2400,
    unlockLevel: 18,
    type: 'ARMOR',
    rarity: 'RARE',
    image: '/img/shop/armadura fuerte.jpeg',
    skills: ['+30% vida/defensa', 'Pasiva: -10% daño recibido'],
    modifiers: { hpMultiplier: 1.3, incomingDamageMultiplier: 0.9 },
  },
  {
    id: 'armor_legendary',
    name: 'Armadura — Aegis Prime',
    description: 'Reservada a héroes de niveles altos; máxima supervivencia en combates largos.',
    price: 9200,
    unlockLevel: 45,
    type: 'ARMOR',
    rarity: 'LEGENDARY',
    image: '/img/shop/armadura legendaria.jpeg',
    skills: ['+50% vida/defensa', 'Pasiva: -18% daño recibido'],
    modifiers: { hpMultiplier: 1.5, incomingDamageMultiplier: 0.82 },
  },

  {
    id: 'helmet_basic',
    name: 'Casco — Helm One',
    description: 'Ligero; ayuda un poco a aguantar golpes mientras aprendes el ritmo del combate.',
    price: 340,
    unlockLevel: 2,
    type: 'HELMET',
    rarity: 'BASIC',
    image: '/img/shop/cascosimple.jpeg',
    skills: ['+10% vida/defensa', 'Pasiva: -3% daño recibido'],
    modifiers: { hpMultiplier: 1.1, incomingDamageMultiplier: 0.97 },
  },
  {
    id: 'helmet_tech',
    name: 'Casco — Neuro Helm',
    description: 'Para niveles medios: menos castigo por fallar un disparo.',
    price: 1950,
    unlockLevel: 15,
    type: 'HELMET',
    rarity: 'RARE',
    image: '/img/shop/cascotecno.jpeg',
    skills: ['+15% vida/defensa', 'Pasiva: -7% daño recibido'],
    modifiers: { hpMultiplier: 1.15, incomingDamageMultiplier: 0.93 },
  },
  {
    id: 'helmet_epic',
    name: 'Casco — Helm Nova',
    description: 'Élite tardía: mente enfocada y mejor aguante bajo presión.',
    price: 6400,
    unlockLevel: 36,
    type: 'HELMET',
    rarity: 'EPIC',
    image: '/img/shop/cacoepico.jpg',
    skills: ['+25% vida/defensa', 'Pasiva: -12% daño recibido'],
    modifiers: { hpMultiplier: 1.25, incomingDamageMultiplier: 0.88 },
  },

  {
    id: 'pen_basic',
    name: 'Bolígrafo — Ink Basic',
    description: 'Daño estándar; el primer bolígrafo que compran la mayoría de héroes.',
    price: 260,
    unlockLevel: 1,
    type: 'PEN',
    rarity: 'BASIC',
    image: '/img/shop/boli basico.jpg',
    skills: ['Daño base en batalla', 'Sin multiplicador extra'],
    modifiers: { damageMultiplier: 1 },
  },
  {
    id: 'pen_magic',
    name: 'Bolígrafo — Ink Pulse',
    description: 'Desbloqueo medio; cada acierto duele más al monstruo.',
    price: 2550,
    unlockLevel: 20,
    type: 'PEN',
    rarity: 'RARE',
    image: '/img/shop/boli mágico.jpeg',
    skills: ['+15% daño en batalla', 'Pasiva: combos más efectivos'],
    modifiers: { damageMultiplier: 1.15 },
  },
  {
    id: 'pen_legendary',
    name: 'Bolígrafo — Ink Nova',
    description: 'Arma de escritura de final de campaña; máximo daño por respuesta.',
    price: 9800,
    unlockLevel: 52,
    type: 'PEN',
    rarity: 'LEGENDARY',
    image: '/img/shop/boli legendario.jpeg',
    skills: ['+32% daño en batalla', 'Pasiva: máximo impacto por acierto'],
    modifiers: { damageMultiplier: 1.32 },
  },

  {
    id: 'pot_life',
    name: 'Poción — Vitalix',
    description: 'Poción de curación ligera para recuperar un 15% de vida máxima en combate.',
    price: 420,
    unlockLevel: 4,
    type: 'POTION',
    rarity: 'BASIC',
    image: '/img/shop/vida.jpg',
    skills: ['Activa: +15% de vida máxima', '1 uso por combate'],
    modifiers: {},
  },
  {
    id: 'pot_energy',
    name: 'Poción — Enerflux',
    description: 'Poción de curación media: restaura un 30% de vida máxima.',
    price: 680,
    unlockLevel: 8,
    type: 'POTION',
    rarity: 'BASIC',
    image: '/img/shop/energia.jpg',
    skills: ['Activa: +30% de vida máxima', '1 uso por combate'],
    modifiers: {},
  },
  {
    id: 'pot_special',
    name: 'Poción — Prisma Boost',
    description: 'Poción mayor: cura un 50% de vida máxima y añade bonus de monedas.',
    price: 3200,
    unlockLevel: 28,
    type: 'POTION',
    rarity: 'RARE',
    image: '/img/shop/especial.jpeg',
    skills: ['Activa: +50% de vida máxima', 'Pasiva: +6% daño y +20% maticoins', '1 uso por combate'],
    modifiers: { damageMultiplier: 1.06, coinRewardBonusPercent: 20 },
  },

  {
    id: 'herb_basic',
    name: 'Hierba — Green Heal',
    description: 'Hierba ofensiva básica: activa +20% de ataque durante 10 segundos.',
    price: 240,
    unlockLevel: 2,
    type: 'HERB',
    rarity: 'BASIC',
    image: '/img/shop/hierbita.jpg',
    skills: ['Activa: +20% ataque durante 10s', '1 uso por combate'],
    modifiers: {},
  },
  {
    id: 'herb_energy',
    name: 'Hierba — Spark Leaf',
    description: 'Hierba de impulso: +22% ataque temporal y pequeño bonus pasivo de daño.',
    price: 1680,
    unlockLevel: 14,
    type: 'HERB',
    rarity: 'RARE',
    image: '/img/shop/curativa.jpg',
    skills: ['Activa: +22% ataque durante 12s', 'Pasiva: +4% daño'],
    modifiers: { damageMultiplier: 1.04 },
  },
  {
    id: 'herb_mystic',
    name: 'Hierba — Mystic Root',
    description: 'Hierba mística: gran buff temporal de ataque y bonus de maticoins.',
    price: 5100,
    unlockLevel: 32,
    type: 'HERB',
    rarity: 'EPIC',
    image: '/img/shop/mistica.jpg',
    skills: ['Activa: +28% ataque durante 15s', 'Pasiva: +5% daño y +30% maticoins'],
    modifiers: { damageMultiplier: 1.05, coinRewardBonusPercent: 30 },
  },

  {
    id: 'pet_barky',
    name: 'Mascota — Barky',
    description: 'Perro que distrae al monstruo: menos daño recibido.',
    price: 2900,
    unlockLevel: 10,
    type: 'PET',
    rarity: 'RARE',
    image: '/img/shop/Barky.jpg',
    skills: ['Pasiva: -25% daño recibido'],
    modifiers: { incomingDamageMultiplier: 0.75 },
  },
  {
    id: 'pet_mimi',
    name: 'Mascota — Mimi',
    description: 'Gato ágil: esquivas parte del castigo y respondes algo mejor.',
    price: 3400,
    unlockLevel: 22,
    type: 'PET',
    rarity: 'RARE',
    image: '/img/shop/Mimi.jpg',
    skills: ['Pasiva: +10% daño', 'Pasiva: -10% daño recibido'],
    modifiers: { incomingDamageMultiplier: 0.9, damageMultiplier: 1.1 },
  },
  {
    id: 'pet_pyro',
    name: 'Mascota — Pyro',
    description: 'Fénix menor: aura que refuerza vida y ataque en combates serios.',
    price: 11800,
    unlockLevel: 58,
    type: 'PET',
    rarity: 'LEGENDARY',
    image: '/img/shop/Pyro.jpg',
    skills: ['Pasiva: +15% daño', 'Pasiva: +15% vida/defensa'],
    modifiers: { hpMultiplier: 1.15, damageMultiplier: 1.15 },
  },
  {
    id: 'pet_drako',
    name: 'Mascota — Drako',
    description: 'Dragón joven centrado en el daño; para quien ya aguanta bien.',
    price: 7600,
    unlockLevel: 40,
    type: 'PET',
    rarity: 'EPIC',
    image: '/img/shop/Drako.jpg',
    skills: ['Pasiva: +25% daño', 'Pasiva: -10% daño recibido'],
    modifiers: { damageMultiplier: 1.25, incomingDamageMultiplier: 0.9 },
  },
  {
    id: 'pet_zapp',
    name: 'Mascota — Zapp',
    description: 'Robot táctico equilibrado con efecto especial de ayuda en respuestas.',
    price: 6200,
    unlockLevel: 35,
    type: 'PET',
    rarity: 'EPIC',
    image: '/img/shop/Zapp.jpg',
    skills: ['Pasiva: +5% daño', 'Pasiva: +5% vida/defensa y -5% daño recibido', 'Especial: elimina uno de los posibles resultados'],
    modifiers: { incomingDamageMultiplier: 0.95, damageMultiplier: 1.05, hpMultiplier: 1.05 },
  },
  {
    id: 'pet_luma',
    name: 'Mascota — Luma',
    description: 'Mascota élite de soporte con mejora general y recompensa especial por victoria.',
    price: 10200,
    unlockLevel: 48,
    type: 'PET',
    rarity: 'LEGENDARY',
    image: '/img/shop/Luma.jpg',
    skills: ['Pasiva: +10% daño', 'Pasiva: +10% vida/defensa y -10% daño recibido', 'Especial: regala 1 poción aleatoria por victoria'],
    modifiers: { damageMultiplier: 1.1, hpMultiplier: 1.1, incomingDamageMultiplier: 0.9 },
  },
];

export const AVATARS: Avatar[] = [
  { id: 'hero1', name: 'LEO', image: '/img/heros/1-Leo.jpg', description: '', unlockLevel: 1 },
  { id: 'hero2', name: 'NIA', image: '/img/heros/2-Nia.jpg', description: '', unlockLevel: 1 },
  { id: 'hero3', name: 'MAX', image: '/img/heros/3-Max.jpg', description: '', unlockLevel: 10 },
  { id: 'hero4', name: 'LIA', image: '/img/heros/4-Lia.jpg', description: '', unlockLevel: 10 },
  { id: 'hero5', name: 'TEO', image: '/img/heros/5-Teo.jpg', description: '', unlockLevel: 20 },
  { id: 'hero6', name: 'VEGA', image: '/img/heros/6-Vega.jpg', description: '', unlockLevel: 20 },
  { id: 'hero7', name: 'AXEL', image: '/img/heros/7-Axel.jpg', description: '', unlockLevel: 30 },
  { id: 'hero8', name: 'KIRA', image: '/img/heros/8-Kira.jpg', description: '', unlockLevel: 30 },
  { id: 'hero9', name: 'NICO', image: '/img/heros/9-Nico.jpg', description: '', unlockLevel: 40 },
  { id: 'hero10', name: 'LUNA', image: '/img/heros/10-Luna.jpg', description: '', unlockLevel: 40 },
  { id: 'hero11', name: 'ORION', image: '/img/heros/11-Orion.jpg', description: '', unlockLevel: 50 },
  { id: 'hero12', name: 'ARIA', image: '/img/heros/12-Aria.jpg', description: '', unlockLevel: 50 },
  { id: 'hero13', name: 'DAX', image: '/img/heros/13-Dax.jpg', description: '', unlockLevel: 60 },
  { id: 'hero14', name: 'ELIA', image: '/img/heros/14-Elia.jpg', description: '', unlockLevel: 60 },
  { id: 'hero15', name: 'KAI', image: '/img/heros/15-Kai.jpg', description: '', unlockLevel: 70 },
  { id: 'hero16', name: 'NOVA', image: '/img/heros/16-Nova.jpg', description: '', unlockLevel: 70 },
  { id: 'hero17', name: 'TITAN', image: '/img/heros/17-Titan.jpg', description: '', unlockLevel: 80 },
  { id: 'hero18', name: 'AURA', image: '/img/heros/18-Aura.jpg', description: '', unlockLevel: 80 },
  { id: 'hero19', name: 'REX', image: '/img/heros/19-Rex.jpg', description: '', unlockLevel: 90 },
  { id: 'hero20', name: 'ZIRA', image: '/img/heros/20-Zira.jpg', description: '', unlockLevel: 90 },
];

export const HERO_BATTLE_STATS: Record<string, { damage: number; defense: number }> = {
  hero1: { damage: 25, defense: 100 },  // LEO
  hero2: { damage: 25, defense: 100 },  // NIA
  hero3: { damage: 28, defense: 125 },  // MAX
  hero4: { damage: 28, defense: 125 },  // LIA
  hero5: { damage: 32, defense: 150 },  // TEO
  hero6: { damage: 32, defense: 150 },  // VEGA
  hero7: { damage: 37, defense: 175 },  // AXEL
  hero8: { damage: 37, defense: 175 },  // KIRA
  hero9: { damage: 43, defense: 200 },  // NICO
  hero10: { damage: 43, defense: 200 }, // LUNA
  hero11: { damage: 50, defense: 225 }, // ORION
  hero12: { damage: 50, defense: 225 }, // ARIA
  hero13: { damage: 58, defense: 250 }, // DAX
  hero14: { damage: 58, defense: 250 }, // ELIA
  hero15: { damage: 67, defense: 275 }, // KAI
  hero16: { damage: 67, defense: 275 }, // NOVA
  hero17: { damage: 77, defense: 300 }, // TITAN
  hero18: { damage: 77, defense: 300 }, // AURA
  hero19: { damage: 88, defense: 350 }, // REX
  hero20: { damage: 88, defense: 350 }, // ZIRA
};

export const MONSTER_NAMES = [
  'Yelo', 'Blui', 'Lumi', 'Mova', 'Orin', 'Roko', 'Pinko', 'Turi', 'Vero', 'Chroma',
  'Flowi', 'Drizi', 'Barko', 'Puffy', 'Petli', 'Grassi', 'Breezo', 'Monti', 'Stono', 'Sunny',
  'Milki', 'Lolli', 'Choco', 'Cupi', 'Dono', 'Cooki', 'Gelly', 'Mallow', 'Candyx', 'Frosti',
  'Bytey', 'Metix', 'Rollix', 'Cablo', 'Pixy', 'Lumix', 'Spinx', 'Butix', 'Flexo', 'Helmo',
  'Stari', 'Kelpi', 'Whaly', 'Bubbli', 'Crabi', 'Corli', 'Jelly', 'Finny', 'Octi', 'Sharko',
  'Vortex', 'Zeno', 'Astro', 'Comi', 'Stelo', 'Luna', 'Meteo', 'Ufoy', 'Orbit', 'Nebu',
  'Labix', 'Copo', 'Growy', 'Beat', 'Plushy', 'Blazo', 'Arti', 'Teachy', 'Chefy', 'Medix',
  'Flyo', 'Button', 'Zoomy', 'Stringo', 'Toybot', 'Bricko', 'Traino', 'Bouncy', 'Blocky', 'Ballo',
  'Shroom', 'Fae', 'Drako', 'Glowi', 'Uni', 'Misty', 'Gobi', 'Crysta', 'Spirio', 'Magic',
  'Zenzo', 'Dashy', 'Swimi', 'Smashy', 'Surfy', 'Climbo', 'Pedal', 'Kicko', 'Dunky', 'Punchy',
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'master_of_8s',
    title: 'Master of 8s',
    description: 'Tabla del 8 completada',
    icon: 'looks_8',
    color: 'bg-secondary-container',
  },
  {
    id: 'invincible',
    title: 'Invincible',
    description: '50 respuestas sin fallo',
    icon: 'shield',
    color: 'bg-primary-container',
  },
  {
    id: 'streak_7',
    title: '7-day streak',
    description: '¡Una semana imparable!',
    icon: 'calendar_today',
    color: 'bg-tertiary-container',
  },
];

/** Batalla rápida: no avanza el mapa; recompensa base fija; HP enemigo no depende del nivel visual */
export const FAST_BATTLE_REWARD_COINS = 100;
export const FAST_BATTLE_ENEMY_LEVEL = 50;

/** Minijuego de plataformas (carrera mágica / misión diaria): multiplicaciones en la misión diaria */
export const PLATFORM_CLIMB_ROUNDS = 10;
export const PLATFORM_CLIMB_BASE_COINS = 100;
/** Vidas iniciales del minijuego de plataformas. Al llegar a 0 → Game Over. */
export const PLATFORM_CLIMB_MAX_LIVES = 3;

export const ENEMY_AVATARS = [
  'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f47e.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f479.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f47b.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9df.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f432.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f916.svg',
];
