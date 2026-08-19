import { Howl } from 'howler';
import { getMapWorldBgmPath, getMapWorldFromLevel } from './mapAudio';

/**
 * BGM en bucle (Howler) + SFX retro (Web Audio API).
 * Mapa y batallas: un mp3 por mundo (`/audio/worldN.mp3`).
 */

const STORAGE_KEY = 'multihero_audio_prefs';
const LEGACY_MUTE_KEY = 'multihero_mute';

export type AudioPrefs = {
  masterMuted: boolean;
  mapMusicOn: boolean;
  battleMusicOn: boolean;
  sfxOn: boolean;
  mapVol: number;
  battleVol: number;
  sfxVol: number;
};

const DEFAULT_PREFS: AudioPrefs = {
  masterMuted: false,
  mapMusicOn: true,
  battleMusicOn: true,
  sfxOn: true,
  mapVol: 0.4,
  battleVol: 0.4,
  sfxVol: 1,
};

export type SFXType = 'click' | 'correct' | 'wrong' | 'win' | 'lose' | 'levelUp' | 'jump' | 'fall';

type BgmKind = 'map' | 'battle';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return {
        ...DEFAULT_PREFS,
        ...p,
        mapVol: clamp01(typeof p.mapVol === 'number' ? p.mapVol : DEFAULT_PREFS.mapVol),
        battleVol: clamp01(typeof p.battleVol === 'number' ? p.battleVol : DEFAULT_PREFS.battleVol),
        sfxVol: clamp01(typeof p.sfxVol === 'number' ? p.sfxVol : DEFAULT_PREFS.sfxVol),
      };
    }
  } catch {
    /* ignore */
  }
  try {
    if (localStorage.getItem(LEGACY_MUTE_KEY) === 'true') {
      return { ...DEFAULT_PREFS, masterMuted: true };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS };
}

class GameAudioEngine {
  private bgmHowls: Record<string, Howl> = {};
  private currentBgmSrc: string | null = null;
  private currentBgmKind: BgmKind | null = null;
  private prefs: AudioPrefs = loadPrefs();
  private listeners = new Set<() => void>();
  private bgmWasPlayingBeforeHidden = false;

  constructor() {
    try {
      if (localStorage.getItem(LEGACY_MUTE_KEY) !== null) {
        localStorage.removeItem(LEGACY_MUTE_KEY);
      }
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handlePageHide);
      window.addEventListener('pageshow', this.handlePageShow);
    }
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.pauseForBackground();
    } else {
      this.resumeAfterForeground();
    }
  };

  private handlePageHide = () => {
    this.pauseForBackground();
  };

  private handlePageShow = () => {
    this.resumeAfterForeground();
  };

  private pauseForBackground() {
    if (this.currentBgmSrc && this.bgmHowls[this.currentBgmSrc]) {
      const h = this.bgmHowls[this.currentBgmSrc];
      this.bgmWasPlayingBeforeHidden = h.playing();
      if (h.playing()) h.pause();
    } else {
      this.bgmWasPlayingBeforeHidden = false;
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      void this.audioCtx.suspend();
    }
  }

  private resumeAfterForeground() {
    if (!this.currentBgmSrc || !this.currentBgmKind) return;
    if (!this.bgmWasPlayingBeforeHidden) return;
    const h = this.bgmHowls[this.currentBgmSrc];
    if (!h) return;
    const targetVol = this.effectiveBgmVolume(this.currentBgmKind);
    if (targetVol <= 0) return;
    if (!h.playing()) {
      h.volume(targetVol);
      h.play();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    this.bgmWasPlayingBeforeHidden = false;
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      /* ignore */
    }
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getPrefs(): AudioPrefs {
    return { ...this.prefs };
  }

  setPrefs(updates: Partial<AudioPrefs>) {
    this.prefs = {
      ...this.prefs,
      ...updates,
      mapVol: updates.mapVol !== undefined ? clamp01(updates.mapVol) : this.prefs.mapVol,
      battleVol: updates.battleVol !== undefined ? clamp01(updates.battleVol) : this.prefs.battleVol,
      sfxVol: updates.sfxVol !== undefined ? clamp01(updates.sfxVol) : this.prefs.sfxVol,
    };
    this.persist();
    this.applyBgmVolume();
    this.notify();
  }

  private effectiveBgmVolume(kind: BgmKind): number {
    if (this.prefs.masterMuted) return 0;
    if (kind === 'map' && !this.prefs.mapMusicOn) return 0;
    if (kind === 'battle' && !this.prefs.battleMusicOn) return 0;
    return kind === 'map' ? this.prefs.mapVol : this.prefs.battleVol;
  }

  private applyBgmVolume() {
    if (!this.currentBgmSrc) return;
    const howl = this.bgmHowls[this.currentBgmSrc];
    if (!howl) return;
    const kind = this.currentBgmKind;
    if (!kind) return;
    const v = this.effectiveBgmVolume(kind);
    if (howl.playing()) {
      howl.volume(v);
    }
  }

  private audioCtx: AudioContext | null = null;

  private initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /** Caída larga tipo “whoosh” descendente (p. ej. fallo en ascenso de plataformas). */
  private playFallWhoosh(vol: number) {
    if (this.prefs.masterMuted || !this.prefs.sfxOn || this.prefs.sfxVol <= 0) return;
    try {
      const ctx = this.initCtx();
      const t0 = ctx.currentTime;
      const peak = 0.18 * this.prefs.sfxVol * vol;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, t0);
      osc.frequency.exponentialRampToValueAtTime(48, t0 + 1.05);

      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.006, t0 + 1.12);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.18);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(170, t0 + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(36, t0 + 1.0);
      g2.gain.setValueAtTime(0, t0);
      g2.gain.linearRampToValueAtTime(peak * 0.45, t0 + 0.12);
      g2.gain.exponentialRampToValueAtTime(0.005, t0 + 1.08);
      osc2.connect(g2);
      g2.connect(ctx.destination);
      osc2.start(t0);
      osc2.stop(t0 + 1.15);
    } catch (e) {
      console.warn('Fall whoosh failed', e);
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number) {
    if (this.prefs.masterMuted || !this.prefs.sfxOn || this.prefs.sfxVol <= 0) return;
    try {
      const ctx = this.initCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const eff = vol * this.prefs.sfxVol;
      gain.gain.setValueAtTime(eff, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio Context init failed', e);
    }
  }

  public playSfx(type: SFXType) {
    if (this.prefs.masterMuted || !this.prefs.sfxOn) return;

    const vol = 0.15;

    switch (type) {
      case 'click':
        this.playTone(600, 'square', 0.05, vol);
        break;
      case 'correct':
        this.playTone(600, 'sine', 0.1, vol);
        setTimeout(() => this.playTone(800, 'sine', 0.15, vol), 100);
        break;
      case 'wrong':
        this.playTone(150, 'sawtooth', 0.3, vol);
        break;
      case 'jump':
        this.playTone(420, 'sine', 0.05, vol * 0.95);
        window.setTimeout(() => this.playTone(620, 'sine', 0.06, vol * 0.65), 38);
        break;
      case 'fall':
        this.playFallWhoosh(vol);
        break;
      case 'win':
        [400, 500, 600, 800].forEach((f, i) => {
          setTimeout(() => this.playTone(f, 'square', 0.15, vol), i * 100);
        });
        break;
      case 'lose':
        [300, 250, 200, 150].forEach((f, i) => {
          setTimeout(() => this.playTone(f, 'sawtooth', 0.25, vol), i * 150);
        });
        break;
      case 'levelUp':
        [300, 400, 500, 600, 800, 1000].forEach((f, i) => {
          setTimeout(() => this.playTone(f, 'sine', 0.2, vol), i * 80);
        });
        break;
      default:
        this.playTone(400, 'sine', 0.1, vol);
    }
  }

  /** Fanfarria tipo latón (Web Audio) para victorias con confeti. */
  public playVictoryFanfare() {
    if (this.prefs.masterMuted || !this.prefs.sfxOn || this.prefs.sfxVol <= 0) return;
    try {
      const ctx = this.initCtx();
      const t0 = ctx.currentTime;
      const peak = 0.1 * this.prefs.sfxVol;

      const playBrass = (freq: number, start: number, dur: number) => {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, t0 + start);
        filter.Q.setValueAtTime(0.7, t0 + start);
        o1.type = 'triangle';
        o2.type = 'triangle';
        o1.frequency.setValueAtTime(freq, t0 + start);
        o2.frequency.setValueAtTime(freq * 1.008, t0 + start);
        g.gain.setValueAtTime(0, t0 + start);
        g.gain.linearRampToValueAtTime(peak, t0 + start + 0.035);
        g.gain.exponentialRampToValueAtTime(0.008, t0 + start + dur);
        o1.connect(filter);
        o2.connect(filter);
        filter.connect(g);
        g.connect(ctx.destination);
        o1.start(t0 + start);
        o2.start(t0 + start);
        o1.stop(t0 + start + dur + 0.04);
        o2.stop(t0 + start + dur + 0.04);
      };

      const notes: [number, number, number][] = [
        [523.25, 0, 0.2],
        [659.25, 0.16, 0.2],
        [783.99, 0.32, 0.22],
        [1046.5, 0.52, 0.26],
        [1318.51, 0.76, 0.22],
        [1046.5, 0.98, 0.18],
        [1567.98, 1.14, 0.45],
      ];
      for (const [f, s, d] of notes) {
        playBrass(f, s, d);
      }
    } catch (e) {
      console.warn('Victory fanfare failed', e);
    }
  }

  private ensureBgmHowl(src: string): Howl {
    if (!this.bgmHowls[src]) {
      this.bgmHowls[src] = new Howl({
        src: [src],
        html5: true,
        loop: true,
        volume: 0,
        preload: true,
        onloaderror: (_id, err) => {
          console.warn('[Multihero audio] No se pudo cargar BGM:', src, err);
        },
      });
    }
    return this.bgmHowls[src];
  }

  private playLoopingBgm(src: string, kind: BgmKind) {
    const targetVol = this.effectiveBgmVolume(kind);

    if (this.currentBgmSrc === src) {
      if (this.currentBgmKind !== kind) {
        this.currentBgmKind = kind;
      }
      const h = this.bgmHowls[src];
      if (h && !h.playing()) {
        h.volume(targetVol);
        h.play();
      } else {
        this.applyBgmVolume();
      }
      return;
    }

    if (this.currentBgmSrc && this.bgmHowls[this.currentBgmSrc]) {
      const prev = this.bgmHowls[this.currentBgmSrc];
      if (prev.playing()) {
        const v = prev.volume();
        prev.fade(v, 0, 450);
        window.setTimeout(() => prev.pause(), 450);
      }
    }

    this.currentBgmSrc = src;
    this.currentBgmKind = kind;
    const next = this.ensureBgmHowl(src);
    next.volume(0);
    next.play();
    next.fade(0, targetVol, 900);
  }

  public playBattleBgm(mapLevel: number) {
    const world = getMapWorldFromLevel(mapLevel);
    const src = getMapWorldBgmPath(world);
    this.playLoopingBgm(src, 'battle');
  }

  /** Tienda, perfil, tablas, multijugador: misma categoría que música de mapa. */
  public playMenuBgm(mapLevel: number) {
    const world = getMapWorldFromLevel(mapLevel);
    const src = getMapWorldBgmPath(world);
    this.playLoopingBgm(src, 'map');
  }

  public playMapBgmForLevel(mapLevel: number) {
    const world = getMapWorldFromLevel(mapLevel);
    const src = getMapWorldBgmPath(world);
    this.playLoopingBgm(src, 'map');
  }

  public playBGM(track: 'MAP' | 'BATTLE') {
    if (track === 'BATTLE') this.playBattleBgm(1);
    else this.playMenuBgm(1);
  }

  public pauseBGM() {
    if (this.currentBgmSrc && this.bgmHowls[this.currentBgmSrc]) {
      this.bgmHowls[this.currentBgmSrc].pause();
    }
  }

  public toggleMute(): boolean {
    this.setPrefs({ masterMuted: !this.prefs.masterMuted });
    return this.prefs.masterMuted;
  }

  public setMute(muted: boolean) {
    this.setPrefs({ masterMuted: muted });
  }

  public getIsMuted() {
    return this.prefs.masterMuted;
  }
}

export const audio = new GameAudioEngine();
