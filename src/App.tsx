/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Screen, UserState, WinSource, ShopItem } from './types';
import {
  AVATARS,
  HERO_BATTLE_STATS,
  SHOP_ITEMS,
  ACHIEVEMENTS,
  ENEMY_AVATARS,
  MONSTER_NAMES,
  FAST_BATTLE_REWARD_COINS,
  FAST_BATTLE_ENEMY_LEVEL,
} from './constants';
import { cn } from './lib/utils';
import { 
  Map as MapIcon, Swords, ShoppingBag, User, Globe,
  Coins, Zap, ChevronRight, Trophy, Rocket, Users,
  Pause, Play, Edit3, Flame, Lock, ShieldAlert, Star, LayoutGrid, ArrowRight, X, Volume2, VolumeX,
  Settings, Sparkles, Calendar, Backpack, Ban, LogOut
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  User as FirebaseUser,
  getRedirectResult,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
} from 'firebase/auth';
import { get, ref as dbRef, remove as dbRemove, set as dbSet } from 'firebase/database';
import { VictoryTrumpets } from './components/VictoryTrumpets';
import { PlatformClimbScreen } from './components/PlatformClimbScreen';
import { DailyMissionHubScreen } from './components/DailyMissionHubScreen';
import {
  normalizeDailyMissionStorage,
  getDailyMissionBaseCoins,
  getMondayOfWeekLocal,
  dateKeyLocal,
  DAILY_BONUS_AD_REWARD_COINS,
  DAILY_BONUS_AD_MAX_PER_DAY,
  DAILY_MISSION_APPLY_SHOP_COIN_BONUS,
} from './lib/dailyMissionWeek';
import { initRewardedAdsSdk, showRewarded } from './lib/rewardedAds';
import { runVictoryCelebration, launchSafeConfetti } from './lib/victoryCelebration';
import { useTranslation } from 'react-i18next';
import { OnboardingScreen } from './components/OnboardingScreen';
import { LegalDocumentsModal } from './components/LegalDocumentsModal';
import { WelcomeSplash } from './components/WelcomeSplash';
import { MultiplayerScreen } from './components/MultiplayerScreen';
import { PvpBattleScreen } from './components/PvpBattleScreen';
import { PvpTugWarScreen } from './components/PvpTugWarScreen';
import { PvpSprintScreen } from './components/PvpSprintScreen';
import { useMultiplayer, BattleMode } from './hooks/useMultiplayer';
import { generateAdaptiveProblem, Problem } from './lib/engine';
import i18nCore from './lib/i18n';
import { audio, type AudioPrefs } from './lib/audio';
import { getTableRewards } from './lib/tableRewards';
import { getAggregatedShopModifiers } from './lib/shopStats';
import {
  getEquippedBattleConsumables,
  getDamageBoostForBattleConsumable,
  getHealFractionForBattleConsumable,
  isBattleConsumableType,
} from './lib/battleConsumables';
import { computeTableMasteryPercent, recomputeAllTableMastery } from './lib/tableMastery';
import { getBonusStarsForLevel, getStarsForLevel, normalizeBonusStars } from './lib/bonusStars';
import { MathHeroScreen } from './components/MathHeroScreen';
import { MultiplicationHeroDiplomaModal } from './components/MultiplicationHeroDiplomaModal';
import { auth, db, nativeRedirectResolver } from './lib/firebase';

// --- Shared Components ---
const FramedAvatar = ({ src, alt, size = "w-10 h-10", className, equipped = [] }: { src: string, alt: string, size?: string, className?: string, equipped?: any[] }) => {
  return (
    <div className={cn("relative z-10 p-1 bg-gradient-to-br from-[#4A90E2] via-[#9D4EDD] to-[#FFD93D] rounded-[1.2rem] shadow-xl overflow-visible glow-pulse", className)}>
      <div className={cn("bg-surface-container rounded-[1.1rem] overflow-hidden border-2 border-white/30", size)}>
        <img src={src} alt={alt} className="w-full h-full object-cover scale-110" />
      </div>
      {equipped.length > 0 && (
        <div className="absolute -bottom-2 -right-4 flex bg-black/50 p-1.5 space-x-1 rounded-full backdrop-blur-md shadow-[0_2px_8px_rgba(157,78,221,0.5)] border border-[#9D4EDD]/40">
          {equipped.map((item, idx) => (
            <div key={idx} className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#9D4EDD] to-[#4A90E2] rounded-full flex items-center justify-center border-2 border-white/30 z-20 overflow-hidden shadow-lg" title={item?.name}>
              {item?.image.startsWith('http') || item?.image.startsWith('/img') ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover scale-110" />
              ) : (
                <span className="text-[14px] material-symbols-outlined text-[#FFD93D]">{item?.image}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Maticoin = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={cn("inline-block glow-pulse-gold", className)}>
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFE066" />
        <stop offset="50%" stopColor="#FFD93D" />
        <stop offset="100%" stopColor="#E6A800" />
      </linearGradient>
      <linearGradient id="goldInner" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#E6A800" />
        <stop offset="100%" stopColor="#FFE066" />
      </linearGradient>
      <filter id="relief">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#FFD93D" floodOpacity="0.5" />
      </filter>
    </defs>
    <circle cx="50" cy="50" r="45" fill="url(#goldGrad)" filter="url(#relief)" />
    <circle cx="50" cy="50" r="35" fill="url(#goldInner)" />
    <path d="M 30 65 L 30 35 L 50 55 L 70 35 L 70 65" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />
  </svg>
);

const LINK_ACCOUNT_REWARD_COINS = 1000;
const REMOVE_ADS_PRICE_EUR = '3,99 €';

function askMultiplicationChallenge(): boolean {
  const a = 2 + Math.floor(Math.random() * 11);
  const b = 2 + Math.floor(Math.random() * 11);
  const raw = window.prompt(`Resuelve para continuar: ${a} x ${b} = ?`);
  if (raw == null) return false;
  const answer = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(answer) && answer === a * b;
}

const GoogleLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-.8 2.2-1.7 2.9l2.7 2.1c1.6-1.5 2.5-3.7 2.5-6.4 0-.6-.1-1.1-.2-1.6H12z" />
    <path fill="#34A853" d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.7-2.1c-.8.5-1.8.9-3.2.9-2.4 0-4.5-1.7-5.2-3.9L4 15.8C5.6 18.9 8.6 21 12 21z" />
    <path fill="#FBBC05" d="M6.8 13.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7L4 8.2C3.3 9.5 3 10.7 3 12s.3 2.5 1 3.8l2.8-2.1z" />
    <path fill="#4285F4" d="M12 6.4c1.3 0 2.5.5 3.4 1.3L18 5c-1.5-1.4-3.5-2.3-6-2.3-3.4 0-6.4 2-8 5.2l2.8 2.1c.7-2.3 2.8-3.9 5.2-3.9z" />
  </svg>
);

const AppleLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16.8 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.6-1.6-3.1-1.6-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.9.9-3.6 2.2-1.6 2.8-.4 6.9 1.2 9.2.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.7.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6 0 0-2.4-.9-2.4-3.9z" />
    <path d="M14.7 6.6c.7-.8 1.1-1.8 1-2.9-1 .1-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.8-1.4z" />
  </svg>
);

const AuthGateScreen = ({
  accountBusy,
  accountError,
  onSignInGoogle,
  onSignInApple,
  onSignInEmail,
  onContinueGuest,
}: {
  accountBusy: boolean;
  accountError: string | null;
  onSignInGoogle: () => Promise<void>;
  onSignInApple: () => Promise<void>;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onContinueGuest: () => void;
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-[#1E1E2F] flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-gradient-to-br from-[#2A2A45] to-[#222238] rounded-[2rem] p-6 md:p-8 border-2 border-[#6BB5FF]/20 toy-shadow">
        <h2 className="font-headline text-3xl font-black text-white mb-2 text-center">{t('authGateTitle')}</h2>
        <p className="text-[#A0A0BE] font-bold text-sm mb-5 text-center">
          {t('authGateSubtitle')}
        </p>
        {accountError && <p className="text-[#FF6B6B] text-xs font-bold mb-3">{accountError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            disabled={accountBusy}
            onClick={() => void onSignInGoogle()}
            className="px-4 py-3 rounded-xl font-black bg-white disabled:opacity-40 text-[#1A1A30] flex items-center justify-center gap-2 border border-[#D9D9E8]"
          >
            <GoogleLogo />
            <span>{t('authSignInGoogle')}</span>
          </button>
          <button
            type="button"
            disabled={accountBusy}
            onClick={() => void onSignInApple()}
            className="px-4 py-3 rounded-xl font-black bg-black disabled:opacity-40 text-white flex items-center justify-center gap-2 border border-white/20"
          >
            <AppleLogo />
            <span>{t('authSignInApple')}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('authEmailPlaceholder')}
            className="bg-[#1A1A30] border-2 border-white/10 rounded-xl px-3 py-3 text-white"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('authPasswordPlaceholder')}
            className="bg-[#1A1A30] border-2 border-white/10 rounded-xl px-3 py-3 text-white"
          />
        </div>
        <button
          type="button"
          disabled={accountBusy || !email || password.length < 6}
          onClick={() => void onSignInEmail(email.trim(), password)}
          className="mt-3 w-full px-4 py-3 rounded-xl font-black bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] disabled:opacity-40 text-white"
        >
          {t('authSignInEmail')}
        </button>
        <button
          type="button"
          disabled={accountBusy}
          onClick={onContinueGuest}
          className="mt-3 w-full px-4 py-3 rounded-xl font-black bg-[#1A1A30] border border-white/10 disabled:opacity-40 text-[#A0A0BE]"
        >
          {t('authContinueGuest')}
        </button>
      </div>
    </div>
  );
};

// --- Components ---

const TopBar = ({
  user,
  onLanguage,
  onAudioSettings,
  onSavePlayerName,
}: {
  user: UserState;
  onLanguage: () => void;
  onAudioSettings: () => void;
  onSavePlayerName: (name: string) => void;
}) => {
  const { t } = useTranslation();
  const currentAvatar = AVATARS.find(a => a.id === user.selectedAvatar);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [draftName, setDraftName] = useState(user.playerName ?? '');

  useEffect(() => {
    if (nameModalOpen) setDraftName(user.playerName ?? '');
  }, [nameModalOpen, user.playerName]);

  const displayName = (user.playerName?.trim() || t('mathExplorer')).toUpperCase();

  const nameModal =
    nameModalOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[280] flex items-center justify-center bg-black/65 p-4"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="topbar-name-modal-title"
        onClick={() => setNameModalOpen(false)}
      >
        <div
          className="max-h-[min(90dvh,32rem)] w-full max-w-sm overflow-y-auto rounded-[1.75rem] border-2 border-[#9D4EDD]/40 bg-gradient-to-b from-[#2A2A45] to-[#222238] p-6 shadow-[0_0_40px_rgba(157,78,221,0.35)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="topbar-name-modal-title" className="font-headline text-xl font-black text-white">
              {t('changeHeroNameTitle')}
            </h2>
            <button
              type="button"
              onClick={() => {
                audio.playSfx('click');
                setNameModalOpen(false);
              }}
              className="rounded-full p-2 text-[#A0A0BE] hover:bg-white/10 hover:text-white"
              aria-label={t('legalClose')}
            >
              <X size={22} />
            </button>
          </div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#A0A0BE]">
            {t('inputName')}
          </label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={15}
            className="mb-5 w-full rounded-xl border-2 border-white/10 bg-[#1A1A30] px-4 py-3 font-bold text-white outline-none focus:border-[#6BB5FF]/50"
            autoFocus
          />
          <button
            type="button"
            disabled={!draftName.trim()}
            onClick={() => {
              const trimmed = draftName.trim();
              if (!trimmed) return;
              audio.playSfx('click');
              onSavePlayerName(trimmed);
              setNameModalOpen(false);
            }}
            className="w-full rounded-2xl bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] py-3.5 font-black uppercase tracking-wider text-white shadow-[0_6px_0_0_#2A5090] transition-all active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:active:translate-y-0"
          >
            {t('changeHeroNameSave')}
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <header className="fixed top-0 w-full z-50 h-20 bg-gradient-to-r from-[#1E1E2F] via-[#252540] to-[#1E1E2F] backdrop-blur-xl border-b-[3px] border-[#9D4EDD]/30 flex justify-between items-center px-4 md:px-6 shadow-[0_10px_40px_rgba(157,78,221,0.2)]">
      <button
        type="button"
        title={t('changeHeroNameHint')}
        aria-label={t('changeHeroNameHint')}
        onClick={() => {
          audio.playSfx('click');
          setNameModalOpen(true);
        }}
        className="flex min-w-0 max-w-[min(100%,14rem)] sm:max-w-[18rem] items-center gap-3 rounded-xl py-0.5 pl-0.5 pr-2 text-left transition-colors hover:bg-white/5 active:scale-[0.99] md:max-w-[22rem]"
      >
        <FramedAvatar src={currentAvatar?.image || AVATARS[0].image} alt="Avatar" size="w-12 h-12" />
        <div className="ml-1 flex min-w-0 flex-1 flex-col justify-center">
          <h1 className="truncate text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-[#C77DFF] to-[#FFD93D] font-headline tracking-tighter uppercase drop-shadow-lg leading-none">
            Multihero
          </h1>
          <p className="truncate text-[#A0A0BE] font-bold text-xs md:text-sm uppercase tracking-widest mt-0.5">
            {displayName}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-1.5 md:gap-2.5 bg-[#FFD93D]/10 rounded-full pl-3 pr-4 py-1.5 border border-[#FFD93D]/30 shadow-[0_0_12px_rgba(255,217,61,0.15)]">
          <span className="text-[#FFD93D] font-black text-lg md:text-xl drop-shadow-md">{user.coins}</span>
          <Maticoin className="w-5 h-5 md:w-6 md:h-6" />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            title={t('languageSettings')}
            onClick={onLanguage}
            className="w-10 h-10 md:w-12 md:h-12 bg-[#9D4EDD]/20 border-2 border-[#9D4EDD]/30 rounded-full flex items-center justify-center text-[#C77DFF] active:scale-90 transition-all flex-shrink-0 hover:bg-[#9D4EDD]/30 shadow-[0_0_12px_rgba(157,78,221,0.2)]"
          >
            <Globe size={24} />
          </button>
          <button
            type="button"
            title={t('audioSettingsTitle')}
            onClick={onAudioSettings}
            className="w-10 h-10 md:w-12 md:h-12 bg-[#4A90E2]/20 border-2 border-[#4A90E2]/35 rounded-full flex items-center justify-center text-[#6BB5FF] active:scale-90 transition-all flex-shrink-0 hover:bg-[#4A90E2]/30 shadow-[0_0_12px_rgba(74,144,226,0.2)]"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>

      {nameModal}
    </header>
  );
};

const BottomBar = ({
  currentScreen,
  onNavigate,
  multiplayerBadgeCount = 0,
}: {
  currentScreen: Screen;
  onNavigate: (s: Screen) => void;
  multiplayerBadgeCount?: number;
}) => {
  const { t } = useTranslation();
  const tabs: { id: Screen; label: string; icon: any }[] = [
    { id: 'MAP', label: t('mapTab') || 'Map', icon: MapIcon },
    { id: 'TABLES', label: t('tablesTab') || 'Tables', icon: LayoutGrid },
    { id: 'MULTIPLAYER', label: t('multiplayer.screenTitle'), icon: Users },
    { id: 'SHOP', label: t('shopTab') || 'Shop', icon: ShoppingBag },
    { id: 'PROFILE', label: t('profileTab') || 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 w-full z-[150] rounded-t-[2.5rem] h-24 bg-gradient-to-t from-[#1A1A30] to-[#252540] shadow-[0_-4px_30px_rgba(0,0,0,0.4)] border-t-[2px] border-[#9D4EDD]/20 flex justify-around items-center px-4 pb-4">
      {tabs.map((tab) => {
        const isActive = currentScreen === tab.id;
        const Icon = tab.icon;
        const showBadge = tab.id === 'MULTIPLAYER' && multiplayerBadgeCount > 0;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              audio.playSfx('click');
              onNavigate(tab.id);
            }}
            className={cn(
              'flex flex-col items-center justify-center px-4 py-2 rounded-[2rem] transition-all duration-200 ease-out active:scale-90',
              isActive
                ? 'bg-gradient-to-b from-[#4A90E2] to-[#3570B8] text-white shadow-[0_4px_0_0_#2A5090,0_0_20px_rgba(74,144,226,0.4)]'
                : 'text-[#5A5A78] hover:text-[#A0A0BE] hover:bg-white/5'
            )}
          >
            <span className="relative inline-flex">
              <Icon size={24} fill={isActive ? 'currentColor' : 'none'} />
              {showBadge && (
                <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B6B] text-[10px] font-black text-white flex items-center justify-center border-2 border-[#1A1A30]">
                  {multiplayerBadgeCount > 9 ? '9+' : multiplayerBadgeCount}
                </span>
              )}
            </span>
            <span className="font-label font-bold text-[12px] uppercase tracking-wider mt-1">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// --- Screens ---

/** Math Hero 3D cada 5 niveles — rama a la izquierda. */
const BONUS_HERO_EVERY_N = 5;
/** Runner 2D clásico cada 10 niveles — rama a la derecha. */
const BONUS_CLASSIC_RUNNER_EVERY_N = 10;
const BONUS_BRANCH_LEFT_OFFSET_X = -185;
const BONUS_BRANCH_LEFT_CONTROL_X = -100;
const BONUS_BRANCH_RIGHT_OFFSET_X = 185;
const BONUS_BRANCH_RIGHT_CONTROL_X = 100;

const MapScreen = ({
  user,
  onStartLevel,
  onFastBattle,
  onOpenDailyMissionHub,
  onOpenInventory,
  onBuyNoAds,
}: {
  user: UserState;
  onStartLevel: (lvl: number, type: 'BATTLE' | 'RUNNER' | 'MATH_HERO', constraint?: number) => void;
  onFastBattle: () => void;
  onOpenDailyMissionHub: () => void;
  onOpenInventory: () => void;
  onBuyNoAds: () => void;
}) => {
  const { t } = useTranslation();
  const levels = Array.from({length: 100}, (_, i) => i + 1);
  const activeNodeRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(448);
  /** `background-attachment: fixed` rompe el pintado en muchos WebViews Android (rectángulos blancos). */
  const mapBgAttachment: 'fixed' | 'scroll' =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
      ? 'scroll'
      : 'fixed';

  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setTrackWidth(w);
    });
    ro.observe(el);
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 0) setTrackWidth(w0);
    return () => ro.disconnect();
  }, []);

  // Background map logic
  const getMapBackground = (lvl: number) => {
    let lower = Math.floor((lvl - 1) / 10) * 10 + 1;
    let upper = lower + 9;
    return `url('/img/background/map/${lower}-${upper}map.jpg')`;
  }

  // Auto-scroll to active node on mount
  useEffect(() => {
    if (activeNodeRef.current) {
      activeNodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <div className="flex-1 relative overflow-y-auto pb-48 flex flex-col items-center bg-[#1E1E2F]"
         style={{ backgroundImage: getMapBackground(user.currentLevel), backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: mapBgAttachment, transition: 'background-image 0.5s ease' }}>
      <div
        className={cn(
          'fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#1E1E2F]/70 via-[#1E1E2F]/40 to-[#1E1E2F]/70',
          mapBgAttachment === 'fixed' && 'backdrop-blur-[1px]'
        )}
      />

      {/* Batalla rápida + misión diaria: más grandes, separados, brillo + pulso */}
      <div
        className="fixed z-40 flex flex-col items-end gap-7 sm:gap-8"
        style={{
          top: 'max(5.75rem, calc(env(safe-area-inset-top) + 4.5rem))',
          right: 'max(1.1rem, calc(env(safe-area-inset-right) + 1rem))',
        }}
      >
        <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center sm:h-[5rem] sm:w-[5rem]">
          <span className="map-fab-glow-red" aria-hidden />
          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              onFastBattle();
            }}
            className="map-fab-btn-pulse flex h-full w-full items-center justify-center rounded-full border-[3px] border-white/35 bg-gradient-to-br from-[#FF8A8A] via-[#FF6B6B] to-[#D94545] text-white shadow-[0_8px_0_0_#A03030,0_0_28px_rgba(255,107,107,0.65),inset_0_2px_0_rgba(255,255,255,0.35)] transition-[filter,transform] hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_0_#A03030]"
          >
            <Swords size={34} strokeWidth={2.5} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] sm:h-9 sm:w-9" />
          </button>
        </div>
        <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center sm:h-[5rem] sm:w-[5rem]">
          <span className="map-fab-glow-gold" aria-hidden />
          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              onOpenDailyMissionHub();
            }}
            aria-label={t('dailyMission')}
            title={t('dailyMission')}
            className="map-fab-btn-pulse map-fab-btn-pulse--delay flex h-full w-full items-center justify-center rounded-full border-[3px] border-[#FFF8DC]/90 bg-gradient-to-br from-[#FFEB7A] via-[#FFD93D] to-[#E6A800] text-[#5C4200] shadow-[0_8px_0_0_#B88600,0_0_32px_rgba(255,217,61,0.85),inset_0_2px_0_rgba(255,255,255,0.55)] transition-[filter,transform] hover:brightness-105 active:translate-y-1 active:shadow-[0_4px_0_0_#B88600]"
          >
            <Calendar size={32} strokeWidth={2.5} className="drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)] sm:h-9 sm:w-9" />
          </button>
        </div>
      </div>

      {/* Inventario (+ No Ads solo si aún no está comprado) */}
      <div
        className="fixed z-40 flex flex-col items-center gap-7 sm:gap-8"
        style={{
          top: 'max(5.75rem, calc(env(safe-area-inset-top) + 4.5rem))',
          left: 'max(1.1rem, calc(env(safe-area-inset-left) + 1rem))',
        }}
      >
        <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center sm:h-[5rem] sm:w-[5rem]">
          <span className="map-fab-glow-gold" aria-hidden />
          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              onOpenInventory();
            }}
            aria-label={t('inventory', { defaultValue: 'Inventario' })}
            title={t('inventory', { defaultValue: 'Inventario' })}
            className="map-fab-btn-pulse flex h-full w-full items-center justify-center rounded-full border-[3px] border-[#FFF8DC]/90 bg-gradient-to-br from-[#BFA7FF] via-[#9D4EDD] to-[#6f2ab0] text-white shadow-[0_8px_0_0_#5A1F8A,0_0_28px_rgba(157,78,221,0.65),inset_0_2px_0_rgba(255,255,255,0.35)] transition-[filter,transform] hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_0_#5A1F8A]"
          >
            <Backpack size={32} strokeWidth={2.5} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] sm:h-9 sm:w-9" />
          </button>
        </div>
        {!user.adsRemoved && (
          <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center sm:h-[5rem] sm:w-[5rem]">
            <span className="map-fab-glow-red pointer-events-none opacity-80" aria-hidden />
            <button
              type="button"
              onClick={() => {
                audio.playSfx('click');
                onBuyNoAds();
              }}
              aria-label={t('noAdsBuy', { defaultValue: `Comprar sin anuncios (${REMOVE_ADS_PRICE_EUR})` })}
              title={t('noAdsBuy', { defaultValue: `Comprar sin anuncios — ${REMOVE_ADS_PRICE_EUR}` })}
              className="relative flex h-full w-full items-center justify-center rounded-full border-[3px] border-[#FF6B6B]/80 bg-gradient-to-br from-[#3d1520] via-[#2b1020] to-[#1a0a12] text-[#FF9E9E] shadow-[0_8px_0_0_rgba(0,0,0,0.35),inset_0_2px_0_rgba(255,255,255,0.2)] transition-[filter,transform] map-fab-btn-pulse hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_0_rgba(0,0,0,0.35)]"
            >
              <Ban className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={2.5} />
              <span className="pointer-events-none absolute text-[9px] font-black tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-[10px]">
                ADS
              </span>
            </button>
          </div>
        )}
      </div>

      <div
        ref={trackRef}
        className="relative w-full max-w-md flex flex-col-reverse items-center justify-end py-24 mt-6"
      >
        {levels.map((levelIndex, i) => {
          const isHeroBonusNode = levelIndex % BONUS_HERO_EVERY_N === 0;
          const isClassicRunnerNode = levelIndex % BONUS_CLASSIC_RUNNER_EVERY_N === 0;

          const isUnlocked = levelIndex <= user.currentLevel;
          const isCurrent = levelIndex === user.currentLevel;
          const isNextBonusUnlocked = levelIndex <= user.currentLevel;

          // Main vertical serpentine cartoon path - wider & more serpentine
          const offset = Math.sin(i * 0.5) * 120;
          const prevOffset = Math.sin((i - 1) * 0.5) * 120;

          return (
            <div key={levelIndex} className="relative w-full h-64 flex justify-center hover:z-20" style={{ zIndex: 100 - i }}>
              
              {/* Path to previous normal level */}
              {levelIndex > 1 && (() => {
                const pathCx = trackWidth / 2;
                const pathD = `M ${pathCx + offset} 0 C ${pathCx + offset} 120, ${pathCx + prevOffset} 140, ${pathCx + prevOffset} 280`;
                return (
                <svg className="absolute w-full h-64 top-1/2 pointer-events-none z-0" style={{ overflow: 'visible' }}>
                  {/* Glow layer */}
                  {isUnlocked && (
                    <path d={pathD} fill="transparent" stroke="rgba(255,217,61,0.2)" strokeWidth="52" strokeLinecap="round" style={{ filter: 'blur(12px)' }} />
                  )}
                  {/* Outer dark border */}
                  <path d={pathD} fill="transparent" stroke={isUnlocked ? "#8A6400" : "rgba(60,60,80,0.6)"} strokeWidth="36" strokeLinecap="round" />
                  {/* Inner bright path */}
                  <path d={pathD} fill="transparent" stroke={isUnlocked ? "#FFD93D" : "#3A3A58"} strokeWidth="22" strokeLinecap="round" />
                  {/* Center highlight */}
                  <path d={pathD} fill="transparent" stroke={isUnlocked ? "rgba(255,240,150,0.45)" : "transparent"} strokeWidth="8" strokeLinecap="round" />
                  {/* Sparkle dots on unlocked path */}
                  {isUnlocked && (
                    <path d={pathD} fill="transparent" stroke="rgba(255,255,255,0.5)" strokeWidth="4" strokeLinecap="round" strokeDasharray="5 35" style={{ animation: 'dash-flow 2s linear infinite' }} />
                  )}
                </svg>
                );
              })()}

              {/* Rama Math Hero (izquierda) */}
              {isHeroBonusNode && (() => {
                const pathCx = trackWidth / 2;
                const bonusD = `M ${pathCx + offset} 80 Q ${pathCx + offset + BONUS_BRANCH_LEFT_CONTROL_X} 10 ${pathCx + offset + BONUS_BRANCH_LEFT_OFFSET_X} 80`;
                return (
                 <svg className="absolute w-full h-full pointer-events-none z-0 left-0" style={{ overflow: 'visible' }}>
                    {isNextBonusUnlocked && (
                      <path d={bonusD} fill="transparent" stroke="rgba(78,205,196,0.28)" strokeWidth="28" strokeLinecap="round" style={{ filter: 'blur(8px)' }} />
                    )}
                    <path d={bonusD} fill="transparent" stroke={isNextBonusUnlocked ? "#0d5c52" : "rgba(60,60,80,0.4)"} strokeWidth="18" strokeLinecap="round" />
                    <path d={bonusD} fill="transparent" stroke={isNextBonusUnlocked ? "#4ECDC4" : "#3A3A58"} strokeWidth="10" strokeLinecap="round" />
                    <path d={bonusD} fill="transparent" stroke={isNextBonusUnlocked ? "#9ff5ee" : "#3A3A58"} strokeWidth="5" strokeDasharray="10 14" strokeLinecap="round" style={isNextBonusUnlocked ? { animation: 'dash-flow 1s linear infinite' } : {}} />
                 </svg>
                );
              })()}

              {/* Rama runner clásico (derecha) */}
              {isClassicRunnerNode && (() => {
                const pathCx = trackWidth / 2;
                const bonusD = `M ${pathCx + offset} 80 Q ${pathCx + offset + BONUS_BRANCH_RIGHT_CONTROL_X} 10 ${pathCx + offset + BONUS_BRANCH_RIGHT_OFFSET_X} 80`;
                return (
                 <svg className="absolute w-full h-full pointer-events-none z-0 left-0" style={{ overflow: 'visible' }}>
                    {isNextBonusUnlocked && (
                      <path d={bonusD} fill="transparent" stroke="rgba(157,78,221,0.25)" strokeWidth="28" strokeLinecap="round" style={{ filter: 'blur(8px)' }} />
                    )}
                    <path d={bonusD} fill="transparent" stroke={isNextBonusUnlocked ? "#5A1F8A" : "rgba(60,60,80,0.4)"} strokeWidth="18" strokeLinecap="round" />
                    <path d={bonusD} fill="transparent" stroke={isNextBonusUnlocked ? "#9D4EDD" : "#3A3A58"} strokeWidth="10" strokeLinecap="round" />
                    <path d={bonusD} fill="transparent" stroke={isNextBonusUnlocked ? "#C77DFF" : "#3A3A58"} strokeWidth="5" strokeDasharray="10 14" strokeLinecap="round" style={isNextBonusUnlocked ? { animation: 'dash-flow 1s linear infinite' } : {}} />
                 </svg>
                );
              })()}

              {/* Main Battle Level Node */}
              <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ transform: `translateX(${offset}px) translateY(-50%)` }}>
                {isCurrent && (
                  <div className="absolute -top-[6rem] left-1/2 -translate-x-1/2 z-30 floating-character pointer-events-none flex flex-col items-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4A90E2] via-[#9D4EDD] to-[#FFD93D] p-[3px] shadow-[0_0_20px_rgba(74,144,226,0.5)]">
                      <div className="w-full h-full rounded-[13px] overflow-hidden bg-[#1A1A30] flex items-end justify-center">
                        <img src={AVATARS.find(a => a.id === user.selectedAvatar)?.image || AVATARS[0].image} className="w-full h-full max-h-full object-contain object-bottom" alt="Mascot" />
                      </div>
                    </div>
                    <div className="w-8 h-3 bg-[#4A90E2]/30 rounded-full mt-2 blur-md pointer-events-none"></div>
                  </div>
                )}

                {/* Friend Avatars on Node */}
                {user.friends?.filter((f: any) => f.level === levelIndex).map((c: any, idx: number) => (
                   <div key={idx} className="absolute -top-[5.5rem] left-1/2 z-40 mt-1 transition-all duration-1000 ease-in-out hover:scale-110" style={{ transform: `translateX(calc(-50% + ${(idx % 2 === 0 ? -1 : 1) * (30 + idx * 10)}px))` }}>
                      <img src={AVATARS.find(a => a.id === c.avatar)?.image || AVATARS[0].image} className="w-12 h-12 rounded-full border-[3px] border-[#6BB5FF] shadow-[0_0_15px_rgba(107,181,255,0.4)] bg-[#252540] pointer-events-auto squish-physics object-cover" title={c.name} />
                      <div className="absolute -bottom-2 -left-4 -right-4 text-center pointer-events-none">
                         <span className="bg-[#1A1A30] text-[#6BB5FF] text-[9px] font-black px-2 py-0.5 rounded-full border border-white/10 uppercase shadow-lg whitespace-nowrap">{c.name}</span>
                      </div>
                   </div>
                ))}

                {(() => {
                  const colorIdx = levelIndex % 4;
                  // Gradient colors: top-light to bottom-dark for natural sphere look
                  const baseColorClasses = [
                    "from-[#8DE897] via-[#5DBF68] to-[#389642]", // green
                    "from-[#FFE872] via-[#FFD93D] to-[#CCA200]", // gold
                    "from-[#FF9494] via-[#FF6060] to-[#CC3838]", // red
                    "from-[#82BEF5] via-[#4A90E2] to-[#2860AA]"  // blue
                  ];
                  // Inset highlight top + shadow bottom + outer glow
                  const nodeStyles: React.CSSProperties[] = [
                    { boxShadow: 'inset 0 6px 12px rgba(255,255,255,0.4), inset 0 -8px 16px rgba(0,80,30,0.5), 0 8px 16px rgba(0,0,0,0.5), 0 0 18px rgba(107,203,119,0.35)' },
                    { boxShadow: 'inset 0 6px 12px rgba(255,255,255,0.4), inset 0 -8px 16px rgba(120,80,0,0.5), 0 8px 16px rgba(0,0,0,0.5), 0 0 18px rgba(255,217,61,0.35)' },
                    { boxShadow: 'inset 0 6px 12px rgba(255,255,255,0.4), inset 0 -8px 16px rgba(120,0,0,0.5), 0 8px 16px rgba(0,0,0,0.5), 0 0 18px rgba(255,107,107,0.35)' },
                    { boxShadow: 'inset 0 6px 12px rgba(255,255,255,0.4), inset 0 -8px 16px rgba(0,40,100,0.5), 0 8px 16px rgba(0,0,0,0.5), 0 0 18px rgba(74,144,226,0.35)' },
                  ];
                  const currentNodeStyles: React.CSSProperties[] = [
                    { boxShadow: 'inset 0 8px 14px rgba(255,255,255,0.5), inset 0 -10px 18px rgba(0,80,30,0.5), 0 10px 20px rgba(0,0,0,0.6), 0 0 35px rgba(107,203,119,0.6)' },
                    { boxShadow: 'inset 0 8px 14px rgba(255,255,255,0.5), inset 0 -10px 18px rgba(120,80,0,0.5), 0 10px 20px rgba(0,0,0,0.6), 0 0 35px rgba(255,217,61,0.6)' },
                    { boxShadow: 'inset 0 8px 14px rgba(255,255,255,0.5), inset 0 -10px 18px rgba(120,0,0,0.5), 0 10px 20px rgba(0,0,0,0.6), 0 0 35px rgba(255,107,107,0.6)' },
                    { boxShadow: 'inset 0 8px 14px rgba(255,255,255,0.5), inset 0 -10px 18px rgba(0,40,100,0.5), 0 10px 20px rgba(0,0,0,0.6), 0 0 35px rgba(74,144,226,0.6)' },
                  ];
                  const lockedStyle: React.CSSProperties = {
                    boxShadow: 'inset 0 4px 8px rgba(255,255,255,0.08), inset 0 -6px 12px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.5)'
                  };

                  return (
                    <button
                      ref={isCurrent ? activeNodeRef : null}
                      onClick={() => {
                        audio.playSfx('click');
                        onStartLevel(levelIndex, 'BATTLE');
                      }}
                      disabled={!isUnlocked}
                      style={isCurrent ? currentNodeStyles[colorIdx] : isUnlocked ? nodeStyles[colorIdx] : lockedStyle}
                      className={cn(
                        "w-[5.5rem] h-[5.5rem] rounded-full flex flex-col items-center justify-center font-black text-3xl font-headline border-2 squish-physics transition-all duration-300 transform-gpu",
                        isCurrent ? `bg-gradient-to-b ${baseColorClasses[colorIdx]} text-white scale-[1.3] z-20 border-white/20` :
                        isUnlocked ? `bg-gradient-to-b ${baseColorClasses[colorIdx]} text-white z-10 hover:brightness-110 border-white/15` :
                        "bg-gradient-to-b from-[#3A3A58] via-[#2A2A45] to-[#1A1A30] text-[#5A5A78] hover:scale-100 border-white/5 opacity-75"
                      )}
                    >
                      {!isUnlocked && <Lock size={22} className="absolute -top-3 right-0 text-[#5A5A78] bg-[#1A1A30] rounded-full p-1.5 border-2 border-[#3A3A58] shadow-md transform rotate-12" />}
                      <span className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">{levelIndex}</span>
                      <div className="mt-0.5 flex justify-center gap-0.5" aria-hidden>
                        {[1, 2, 3].map((slot) => {
                          const earned = getStarsForLevel(user.levelStars, levelIndex);
                          const lit = earned >= slot;
                          return (
                            <Star
                              key={slot}
                              size={11}
                              className={lit ? 'text-[#FFD93D] drop-shadow-[0_0_6px_rgba(255,217,61,0.7)]' : 'text-white/35'}
                              fill={lit ? 'currentColor' : 'none'}
                            />
                          );
                        })}
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* Nodo Hero Runner (izquierda) */}
              {isHeroBonusNode && (
                 <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ transform: `translateX(${offset + BONUS_BRANCH_LEFT_OFFSET_X}px) translateY(-50%)` }}>
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gradient-to-r from-[#4ECDC4] to-[#2a8a82] text-[#0a2522] font-black text-[10px] uppercase px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(78,205,196,0.55)] border-2 border-[#9ff5ee]/60 animate-pulse z-40 transform rotate-[5deg] max-w-[9.5rem] text-center leading-tight sm:text-xs sm:max-w-none">
                      {t('bonusNodeHeroTitle')}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        audio.playSfx('click');
                        onStartLevel(levelIndex, 'MATH_HERO');
                      }}
                      disabled={!isNextBonusUnlocked}
                      className={cn(
                        "relative h-[5.5rem] w-[5.5rem] flex items-center justify-center squish-physics transition-all duration-300 -rotate-12 z-30",
                        isNextBonusUnlocked ? "text-[#4ECDC4] hover:brightness-110" : "text-[#4a4a6f] opacity-80"
                      )}
                    >
                      <Star
                        size={94}
                        className={cn(
                          "absolute",
                          isNextBonusUnlocked
                            ? "text-[#2fb7ac] drop-shadow-[0_0_14px_rgba(78,205,196,0.55)]"
                            : "text-[#2A2A45]"
                        )}
                        fill="currentColor"
                      />
                      <Rocket size={30} className={isNextBonusUnlocked ? "text-[#FFD93D] drop-shadow-[0_0_8px_rgba(255,217,61,0.85)] shrink-0 z-10" : "text-[#5A5A78] shrink-0 z-10"} />
                    </button>
                 </div>
              )}

              {/* Nodo runner 2D clásico (derecha) */}
              {isClassicRunnerNode && (
                 <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ transform: `translateX(${offset + BONUS_BRANCH_RIGHT_OFFSET_X}px) translateY(-50%)` }}>
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gradient-to-r from-[#9D4EDD] to-[#7B2FBB] text-white font-black text-xs uppercase px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(157,78,221,0.6)] border-2 border-[#C77DFF]/50 animate-pulse z-40 transform rotate-[-5deg]">
                      {t('bonusRunnerMixed')}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        audio.playSfx('click');
                        onStartLevel(levelIndex, 'RUNNER');
                      }}
                      disabled={!isNextBonusUnlocked}
                      className={cn(
                        "min-w-[5.25rem] px-1 pt-1.5 pb-2 rounded-[1.5rem] flex flex-col items-center justify-center gap-1 font-headline border-b-[8px] border-t-2 border-x-2 squish-physics transition-all duration-300 rotate-12 z-30",
                        isNextBonusUnlocked ? "bg-gradient-to-br from-[#C77DFF] to-[#7B2FBB] text-white border-b-[#5A1F8A] border-t-[#C77DFF]/50 border-x-[#9D4EDD] hover:brightness-110 glow-pulse-magic" :
                        "bg-gradient-to-br from-[#2A2A45] to-[#1A1A30] text-[#5A5A78] border-b-[#181828] border-t-[#3A3A58] border-x-[#2A2A45] opacity-80"
                      )}
                    >
                      <Star size={28} className={isNextBonusUnlocked ? "text-[#FFD93D] drop-shadow-[0_0_10px_rgba(255,217,61,0.9)] shrink-0" : "text-[#3A3A58] shrink-0"} fill="currentColor" />
                      <div className="flex justify-center gap-0.5" aria-hidden>
                        {[1, 2, 3].map((slot) => {
                          const earned = getBonusStarsForLevel(user.bonusStars, levelIndex);
                          const lit = earned >= slot;
                          return (
                            <Star
                              key={slot}
                              size={11}
                              className={lit ? 'text-[#FFD93D] drop-shadow-[0_0_6px_rgba(255,217,61,0.7)]' : 'text-[#5A5A78] opacity-55'}
                              fill={lit ? 'currentColor' : 'none'}
                            />
                          );
                        })}
                      </div>
                    </button>
                 </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BattleScreen = ({
  user,
  level,
  battleContext,
  onWin,
  onLose,
  onUpdateHistory,
  onConsumeConsumable,
}: {
  user: UserState;
  level: number;
  /** map = nodo del mapa; fast = batalla rápida aislada (recompensa/dificultad fijas) */
  battleContext: 'map' | 'fast';
  onWin: (coins: number) => void;
  onLose: () => void;
  onUpdateHistory: (k: string, c: boolean, solveAtMapLevel: number) => void;
  onConsumeConsumable: (itemId: string) => boolean;
}) => {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<Problem | null>(() =>
    battleContext === 'fast' ? generateAdaptiveProblem(user, 'BATTLE') : null
  );
  const [combo, setCombo] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hitEffect, setHitEffect] = useState<'player'|'enemy'|null>(null);
  const [battleIntroDismissed, setBattleIntroDismissed] = useState(battleContext === 'fast');
  const [consumableDamageBoostMult, setConsumableDamageBoostMult] = useState(1);
  const consumableDamageBoostTimeoutRef = useRef<number | null>(null);
  const wrongAnswerRevealTimeoutRef = useRef<number | null>(null);
  const [wrongAnswerReveal, setWrongAnswerReveal] = useState<{ picked: number | null } | null>(null);
  const WRONG_ANSWER_PAUSE_MS = 2200;

  const getTimerBase = () => {
    if (battleContext === 'fast') return 15;
    switch (user.difficulty) {
      case 'HARD':
        return 8;
      case 'EASY':
        return 30;
      case 'NORMAL':
      default:
        return 15;
    }
  };

  const [timer, setTimer] = useState(getTimerBase());

  const { hpMult, dmgMult, incomingDamageMult } = getAggregatedShopModifiers(user.equippedItems);

  const heroLevel = AVATARS.find((a) => a.id === user.selectedAvatar)?.unlockLevel || 1;
  const heroMultiplier = 1 + Math.floor((heroLevel - 1) / 10) * 0.15;
  const heroBaseStats = HERO_BATTLE_STATS[user.selectedAvatar] ?? {
    damage: Math.floor(25 * heroMultiplier),
    defense: Math.floor(100 * heroMultiplier),
  };

  const maxPlayerHp = Math.floor(heroBaseStats.defense * hpMult);
  const attackDamage = Math.floor(heroBaseStats.damage * dmgMult * consumableDamageBoostMult);
  const combatEnemyLevel = battleContext === 'fast' ? FAST_BATTLE_ENEMY_LEVEL : level;
  const maxEnemyHp = 100 + combatEnemyLevel * 25;
  
  // Monster images matching 1..100 (same index as map level in normal play)
  const enemyAvatarId = ((level - 1) % 100) + 1;
  const enemyMonsterName = MONSTER_NAMES[enemyAvatarId - 1] || 'Monster';
  const enemyAvatar = `/img/monsters/${enemyAvatarId}-${enemyMonsterName}.png`;

  const getBattleBackground = (lvl: number) => {
    let lower = Math.floor((lvl - 1) / 10) * 10 + 1;
    let upper = lower + 9;
    return `url('/img/background/battle/${lower}-${upper}bat.jpg')`;
  }

  const [enemyHp, setEnemyHp] = useState(maxEnemyHp);
  const [playerHp, setPlayerHp] = useState(maxPlayerHp);
  const [usedBattleConsumables, setUsedBattleConsumables] = useState<Record<string, true>>({});

  const equippedForBattleAvatar = useMemo(
    () =>
      user.equippedItems
        ?.map((id) => SHOP_ITEMS.find((s) => s.id === id))
        .filter((item): item is ShopItem => Boolean(item) && !isBattleConsumableType(item.type)) ?? [],
    [user.equippedItems]
  );

  const battleConsumables = useMemo(
    () =>
      getEquippedBattleConsumables(user.equippedItems).filter((item) => {
        const qty = user.itemInventory?.[item.id] ?? 0;
        return qty > 0;
      }),
    [user.equippedItems, user.itemInventory]
  );
  const hasZappEquipped = battleContext === 'map' && (user.equippedItems || []).includes('pet_zapp');
  const visibleOptions = useMemo(() => {
    const opts = problem?.options ?? [];
    if (!hasZappEquipped || opts.length < 4 || !problem) return opts;
    const wrongOptions = opts.filter((o) => o !== problem.answer);
    if (wrongOptions.length === 0) return opts;
    const seed = `${problem.a}:${problem.b}:${problem.answer}:${opts.join(',')}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash * 31) + seed.charCodeAt(i)) | 0;
    const wrongToHide = wrongOptions[Math.abs(hash) % wrongOptions.length];
    return opts.filter((o) => o !== wrongToHide);
  }, [problem, hasZappEquipped]);

  const initProblem = () => {
    try {
      const next = generateAdaptiveProblem(user, 'BATTLE');
      if (next?.options?.length) {
        setProblem(next);
        setTimer(getTimerBase());
      }
    } catch {
      /* Edge / datos raros: no dejar problem en null */
    }
  };

  const dismissBattleIntro = () => {
    audio.playSfx('click');
    initProblem();
    setBattleIntroDismissed(true);
  };

  const handleAnswerRef = useRef<(choice: number) => void>(() => {});

  const triggerHit = (target: 'player'|'enemy') => {
    setHitEffect(target);
    setTimeout(() => setHitEffect(null), 300);
  }

  const handleAnswer = (choice: number) => {
    if (!problem || wrongAnswerReveal) return;

    const isCorrect = choice === problem.answer;
    const key = `${problem.a}x${problem.b}`;
    const historyLevel = battleContext === 'fast' ? FAST_BATTLE_ENEMY_LEVEL : level;
    onUpdateHistory(key, isCorrect, historyLevel);

    if (isCorrect) {
      if (wrongAnswerRevealTimeoutRef.current !== null) {
        window.clearTimeout(wrongAnswerRevealTimeoutRef.current);
        wrongAnswerRevealTimeoutRef.current = null;
      }
      setWrongAnswerReveal(null);
      audio.playSfx('correct');
      const newCombo = combo + 1;
      setCombo(newCombo);
      const comboBonus =
        Math.floor(attackDamage * (newCombo * 0.08)) + (newCombo >= 2 ? (newCombo - 1) * 4 : 0);
      const totalDamage = attackDamage + comboBonus;
      const newEnemyHp = enemyHp - totalDamage;
      setEnemyHp(newEnemyHp);
      triggerHit('enemy');
      
      if (newEnemyHp <= 0) {
        setTimeout(
          () =>
            onWin(
              battleContext === 'fast'
                ? FAST_BATTLE_REWARD_COINS
                : 50 + newCombo * 5 + level * 5
            ),
          500
        );
      } else {
        requestAnimationFrame(() => initProblem());
      }
    } else {
      audio.playSfx('wrong');
      setCombo(0);
      const newPlayerHp = playerHp - Math.max(1, Math.floor(34 * incomingDamageMult));
      setPlayerHp(newPlayerHp);
      triggerHit('player');

      const picked = choice === -1 ? null : choice;
      if (wrongAnswerRevealTimeoutRef.current !== null) {
        window.clearTimeout(wrongAnswerRevealTimeoutRef.current);
      }
      setWrongAnswerReveal({ picked });
      wrongAnswerRevealTimeoutRef.current = window.setTimeout(() => {
        wrongAnswerRevealTimeoutRef.current = null;
        setWrongAnswerReveal(null);
        if (newPlayerHp <= 0) {
          onLose();
        } else {
          initProblem();
        }
      }, WRONG_ANSWER_PAUSE_MS);
    }
  };

  handleAnswerRef.current = handleAnswer;

  const useBattleConsumable = (item: ShopItem) => {
    if (isPaused || wrongAnswerReveal || !problem || playerHp <= 0 || enemyHp <= 0) return;
    if (usedBattleConsumables[item.id]) return;
    const boost = getDamageBoostForBattleConsumable(item);
    if (boost) {
      const consumed = onConsumeConsumable(item.id);
      if (!consumed) {
        audio.playSfx('click');
        return;
      }
      if (consumableDamageBoostTimeoutRef.current !== null) {
        window.clearTimeout(consumableDamageBoostTimeoutRef.current);
      }
      setConsumableDamageBoostMult(boost.multiplier);
      consumableDamageBoostTimeoutRef.current = window.setTimeout(() => {
        setConsumableDamageBoostMult(1);
        consumableDamageBoostTimeoutRef.current = null;
      }, boost.durationSec * 1000);
      setUsedBattleConsumables((u) => ({ ...u, [item.id]: true }));
      audio.playSfx('correct');
      return;
    }
    if (playerHp >= maxPlayerHp) {
      audio.playSfx('click');
      return;
    }
    const frac = getHealFractionForBattleConsumable(item);
    if (frac <= 0) {
      audio.playSfx('click');
      return;
    }
    const consumed = onConsumeConsumable(item.id);
    if (!consumed) {
      audio.playSfx('click');
      return;
    }
    const heal = Math.max(1, Math.floor(maxPlayerHp * frac));
    setPlayerHp((p) => Math.min(maxPlayerHp, p + heal));
    setUsedBattleConsumables((u) => ({ ...u, [item.id]: true }));
    audio.playSfx('correct');
  };

  useEffect(() => {
    return () => {
      if (consumableDamageBoostTimeoutRef.current !== null) {
        window.clearTimeout(consumableDamageBoostTimeoutRef.current);
      }
      if (wrongAnswerRevealTimeoutRef.current !== null) {
        window.clearTimeout(wrongAnswerRevealTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!battleIntroDismissed || isPaused || wrongAnswerReveal) return;
    if (timer > 0 && enemyHp > 0 && playerHp > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    } else if (timer <= 0 && enemyHp > 0 && playerHp > 0) {
      handleAnswerRef.current(-1);
    }
  }, [timer, enemyHp, playerHp, isPaused, battleIntroDismissed, wrongAnswerReveal]);

  if (battleContext === 'map' && !battleIntroDismissed) {
    const enemyNameUpper = enemyMonsterName.toUpperCase();
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 bg-[#1E1E2F] overflow-y-auto relative min-h-[50vh]"
        style={{
          backgroundImage: getBattleBackground(level),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1E1E2F]/75 via-[#1E1E2F]/55 to-[#1E1E2F]/85" />
        <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-5">
          <div className="text-center w-full px-2 space-y-1">
            <p
              className="font-black text-xs md:text-sm tracking-[0.35em] text-[#FFD93D] drop-shadow-[0_0_12px_rgba(255,217,61,0.45)] uppercase"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
            >
              {t('battleIntroMultiWith')}
            </p>
            <h2
              className="font-headline font-black text-4xl md:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white via-[#E8E8FF] to-[#B8B8D8] uppercase tracking-tighter leading-none drop-shadow-[0_4px_0_rgba(0,0,0,0.35),0_0_40px_rgba(157,78,221,0.35)]"
              style={{ WebkitTextStroke: '1px rgba(255,255,255,0.15)' } as React.CSSProperties}
            >
              {enemyNameUpper}
            </h2>
          </div>
          <div className="flex flex-col items-center gap-3">
            <FramedAvatar src={enemyAvatar} alt={enemyMonsterName} size="w-32 h-32 md:w-40 md:h-40" className="floating-character drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]" />
          </div>
          <div className="relative w-full px-2 pt-3">
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 z-[1] border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[16px] border-b-white"
              aria-hidden
            />
            <div
              className="relative bg-white rounded-[2rem] border-[3px] border-[#1A1A30]/10 px-6 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.06)_inset]"
            >
              <p className="text-center font-headline font-black text-lg md:text-xl text-[#1A1A30] leading-snug">
                {t(`monsterWelcome_${enemyAvatarId}`)}
              </p>
            </div>
          </div>
          <div className="w-full max-w-xs flex flex-col gap-3 mt-1">
            <button
              type="button"
              onClick={dismissBattleIntro}
              className="w-full bg-gradient-to-b from-[#6BCB77] to-[#3D9A52] text-white font-black text-xl py-4 rounded-3xl shadow-[0_8px_0_0_#1E5A30,0_0_24px_rgba(107,203,119,0.35)] active:translate-y-2 active:shadow-none transition-all uppercase tracking-wider border-2 border-white/20"
            >
              {t('playGame')}
            </button>
            <button
              type="button"
              onClick={() => {
                audio.playSfx('click');
                onLose();
              }}
              className="w-full bg-[#2A2A45]/90 backdrop-blur-md text-[#A0A0BE] font-black text-base py-3 rounded-2xl border-2 border-white/10 shadow-[0_4px_0_0_rgba(0,0,0,0.25)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider hover:text-white hover:border-white/20"
            >
              {t('back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const timerBase = Math.max(1, getTimerBase());
  const timerBarPct = Math.min(100, Math.max(0, (timer / timerBase) * 100));

  if (!problem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#1E1E2F] p-8">
        <p className="text-center font-bold text-[#A0A0BE] text-sm">
          {t('multiplayer.connecting', { defaultValue: 'Cargando batalla…' })}
        </p>
        <button
          type="button"
          onClick={() => {
            initProblem();
            setBattleIntroDismissed(true);
          }}
          className="px-6 py-3 rounded-2xl font-black bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] text-white"
        >
          {t('continueAdventure')}
        </button>
      </div>
    );
  }

  const battlePlayerLabel = (user.playerName?.trim() || t('mathExplorer')).toUpperCase();

  return (
    <div
      className={cn(
        'flex-1 flex flex-col items-center justify-between p-4 bg-[#1E1E2F] overflow-y-auto relative transition-all duration-75',
        hitEffect === 'player' && 'ring-2 ring-red-500/60 ring-inset'
      )}
      style={{
        backgroundImage: getBattleBackground(level),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'all 0.3s ease',
      }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#1E1E2F]/50 via-transparent to-[#1E1E2F]/60" />
      {hitEffect === 'player' && (
        <div
          className="absolute inset-0 z-[4] pointer-events-none bg-red-900/35 animate-pulse"
          aria-hidden
        />
      )}

      {battleConsumables.length > 0 && (
        <div
          className="fixed left-2 sm:left-4 top-[38%] -translate-y-1/2 z-[35] flex flex-col gap-3 pointer-events-auto max-h-[min(52vh,28rem)] overflow-y-auto pr-1 py-1 hide-scrollbar"
          role="toolbar"
          aria-label={t('battleConsumablesToolbar')}
        >
          {battleConsumables.map((item) => {
            const used = Boolean(usedBattleConsumables[item.id]);
            const qty = user.itemInventory?.[item.id] ?? 0;
            const fullLife = playerHp >= maxPlayerHp;
            const battleActive = !!problem && playerHp > 0 && enemyHp > 0;
            const unusable =
              isPaused || !battleActive || used;
            return (
              <button
                key={item.id}
                type="button"
                title={item.name}
                disabled={unusable}
                onClick={() => useBattleConsumable(item)}
                className={cn(
                  'relative flex-shrink-0 w-[4.25rem] h-[4.25rem] sm:w-[5rem] sm:h-[5rem] rounded-2xl border-[3px] flex items-center justify-center overflow-hidden transition-all shadow-[0_8px_0_0_rgba(0,0,0,0.35),0_0_18px_rgba(157,78,221,0.25)] active:translate-y-0.5 active:shadow-[0_4px_0_0_rgba(0,0,0,0.35)]',
                  used
                    ? 'border-[#4A4A68] bg-[#2A2A45]/90 opacity-55 grayscale'
                    : fullLife && battleActive && !isPaused
                      ? 'border-[#6BCB77]/45 bg-[#1A1A30]/85 opacity-80'
                      : 'border-[#9D4EDD]/70 bg-gradient-to-br from-[#2A2A45] to-[#1A1A30] hover:brightness-110 hover:border-[#C77DFF]',
                  unusable && !used && 'opacity-50',
                  !unusable && 'cursor-pointer'
                )}
              >
                {item.image.startsWith('http') || item.image.startsWith('/img') ? (
                  <img src={item.image} alt="" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <span className="text-3xl material-symbols-outlined text-[#FFD93D]">{item.image}</span>
                )}
                {used && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-black uppercase tracking-tighter text-white/95">
                    ✓
                  </span>
                )}
                {!used && (
                  <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white">
                    x{qty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isPaused && (
        <div className="absolute inset-0 z-50 bg-[#1E1E2F]/96 flex flex-col items-center justify-center p-6">
          <h2 className="text-5xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] to-[#C77DFF] mb-10 drop-shadow-lg tracking-tighter uppercase">{t('pauseTitle')}</h2>
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button onClick={() => setIsPaused(false)} className="bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] text-white font-black text-2xl py-4 rounded-3xl shadow-[0_8px_0_0_#2A5090,0_0_20px_rgba(74,144,226,0.3)] active:translate-y-2 active:shadow-none transition-all uppercase tracking-wider block text-center">
              {t('resume')}
            </button>
            <button onClick={onLose} className="bg-gradient-to-b from-[#FF9E9E] to-[#FF6B6B] text-white font-black text-2xl py-4 rounded-3xl shadow-[0_8px_0_0_#A03030,0_0_20px_rgba(255,107,107,0.3)] active:translate-y-2 active:shadow-none transition-all uppercase tracking-wider block text-center">
              {t('flee')}
            </button>
          </div>
        </div>
      )}

      {/* Top Section: Health Bars and Avatars */}
      <div className="w-full max-w-4xl grid grid-cols-2 gap-4 mt-6 z-10 pt-16">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full bg-[#1A1A30]/95 rounded-xl h-8 relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-[#6BCB77]/30">
            <div className="bg-gradient-to-r from-[#6BCB77] to-[#4DA85A] h-full rounded-r-lg relative transition-all duration-300 shadow-[0_0_12px_rgba(107,203,119,0.4)]" style={{ width: `${(Math.max(0, playerHp)/maxPlayerHp)*100}%` }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{Math.ceil(playerHp)} / {maxPlayerHp}</div>
          </div>
          <div className={cn("relative flex flex-col items-center transition-all duration-100", hitEffect === 'player' && "translate-x-2 -translate-y-2 animate-pulse brightness-200")}>
            {combo >= 2 && (
              <div className="absolute -top-8 -left-4 bg-gradient-to-r from-[#FFD93D] to-[#E6A800] text-[#3D2E00] px-3 py-1 rounded-full font-black text-xs md:text-sm rotate-[-10deg] shadow-[0_0_15px_rgba(255,217,61,0.5)] z-20 border-2 border-white/30 animate-bounce">
                {combo}-HIT COMBO!
              </div>
            )}
            <span className="mb-1 z-20 max-w-[min(100%,11rem)] md:max-w-[13rem] text-center line-clamp-2 inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-[#0A1F14] bg-gradient-to-r from-[#6BCB77] to-[#4DA85A] border border-white/40 shadow-[0_4px_12px_rgba(107,203,119,0.35)] rotate-[4deg]">
              ★ {battlePlayerLabel}
            </span>
            <FramedAvatar src={AVATARS.find(a => a.id === user.selectedAvatar)?.image || AVATARS[0].image} alt="Hero" size="w-28 h-28 md:w-36 md:h-36" className="floating-character" equipped={equippedForBattleAvatar} />
          </div>
        </div>
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full bg-[#1A1A30]/95 rounded-xl h-8 relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-[#FF6B6B]/30">
            <div className="bg-gradient-to-l from-[#FF6B6B] to-[#D94545] h-full rounded-l-lg absolute right-0 transition-all duration-300 shadow-[0_0_12px_rgba(255,107,107,0.4)]" style={{ width: `${(Math.max(0, enemyHp)/maxEnemyHp)*100}%` }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{Math.ceil(enemyHp)} / {maxEnemyHp}</div>
          </div>
          <div className={cn("relative flex flex-col items-center transition-all duration-100", hitEffect === 'enemy' && "translate-x-2 translate-y-2 animate-pulse brightness-150")}>
            <span className="mb-1 z-20 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-[#1A1A30] bg-gradient-to-r from-[#FFD93D] to-[#FF6B6B] border border-white/40 shadow-[0_4px_12px_rgba(255,107,107,0.35)] rotate-[-4deg]">
              ✦ {enemyMonsterName.toUpperCase()}
            </span>
            <FramedAvatar src={enemyAvatar} alt={enemyMonsterName} size="w-28 h-28 md:w-36 md:h-36" className="floating-character" />
          </div>
        </div>
      </div>

      {/* Middle Section: Math Question */}
      <div className="w-full flex justify-center py-6 mt-2 flex-grow items-center z-10">
          <div className="bg-[#252540]/98 px-10 py-8 rounded-[2.5rem] border-[4px] border-[#4A90E2]/40 shadow-[0_0_30px_rgba(74,144,226,0.2)] flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#9D4EDD]/10 to-transparent rounded-bl-full pointer-events-none"></div>
            <div className="text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-white to-[#FFD93D] font-headline font-black text-6xl md:text-8xl tracking-tighter whitespace-nowrap drop-shadow-md">
              {problem.a} x {problem.b} = ?
            </div>
            <div className="w-full h-5 bg-[#1A1A30] mt-6 rounded-full overflow-hidden border border-white/10 shadow-inner">
              <div className="bg-gradient-to-r from-[#FFD93D] via-[#E6A800] to-[#FF6B6B] h-full transition-all shadow-[0_0_10px_rgba(255,217,61,0.5)]" style={{ width: `${timerBarPct}%` }}></div>
            </div>
          </div>
      </div>

      {/* Bottom Section: Answer Choices */}
      <div className="w-full max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 z-10">
        {visibleOptions.map((opt, i) => {
          const btnStyles = [
            "bg-gradient-to-br from-[#6BB5FF] to-[#4A90E2] shadow-[0_6px_0_0_#2A5090,0_0_15px_rgba(74,144,226,0.3)]",
            "bg-gradient-to-br from-[#FFE066] to-[#FFD93D] text-[#3D2E00] shadow-[0_6px_0_0_#B88600,0_0_15px_rgba(255,217,61,0.3)]",
            "bg-gradient-to-br from-[#FF9E9E] to-[#FF6B6B] shadow-[0_6px_0_0_#A03030,0_0_15px_rgba(255,107,107,0.3)]",
            "bg-gradient-to-br from-[#C77DFF] to-[#9D4EDD] shadow-[0_6px_0_0_#5A1F8A,0_0_15px_rgba(157,78,221,0.3)]"
          ];
          const pickedWrong = wrongAnswerReveal?.picked != null && wrongAnswerReveal.picked === opt;
          const showCorrect = Boolean(wrongAnswerReveal && problem.answer === opt);
          return (
            <button
              key={`${opt}-${i}`}
              onClick={() => handleAnswer(opt)}
              disabled={isPaused || !!wrongAnswerReveal}
              className={cn(
                "aspect-[4/3] md:aspect-square rounded-[2rem] transform transition-all hover:scale-105 active:scale-95 active:translate-y-1 flex items-center justify-center text-5xl font-black font-headline text-white border-2 border-white/20",
                btnStyles[i],
                pickedWrong && 'ring-[5px] ring-red-500 ring-offset-2 ring-offset-[#1E1E2F] z-10 pointer-events-none',
                showCorrect && 'ring-[5px] ring-[#22c55e] ring-offset-2 ring-offset-[#1E1E2F] z-10 pointer-events-none'
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setIsPaused(!isPaused)}
        className="fixed top-24 right-6 z-40 w-12 h-12 bg-[#252540]/95 rounded-full shadow-[0_0_15px_rgba(74,144,226,0.3)] border-2 border-[#4A90E2]/30 flex items-center justify-center squish-physics active:scale-90"
      >
        <Pause className="text-[#6BB5FF]" fill="currentColor" />
      </button>
    </div>
  );
};

const ShopScreen = ({
  user,
  onBuy,
  onOpenInventory,
  onBuyNoAds,
  onClaimDailyBonusCoins,
}: {
  user: UserState,
  onBuy: (item: ShopItem) => void,
  onOpenInventory: () => void,
  onBuyNoAds: () => void,
  onClaimDailyBonusCoins: () => Promise<boolean>,
}) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>('TODO');
  const [bonusBusy, setBonusBusy] = useState(false);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const categories: {id: string, label: string}[] = [
    {id: 'TODO', label: t('catAll')},
    {id: 'ARMOR', label: t('catArmor')},
    {id: 'HELMET', label: t('catHelmet')},
    {id: 'PEN', label: t('catPen')},
    {id: 'POTION', label: t('catPotion')},
    {id: 'HERB', label: t('catHerb')},
    {id: 'PET', label: t('catPet')}
  ];
  
  const filteredItems = activeCategory === 'TODO' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => i.type === activeCategory);
  const todayKey = dateKeyLocal(new Date());
  const dailyBonusCount = user.dailyMissionBonusAds?.dateKey === todayKey ? user.dailyMissionBonusAds.count : 0;
  const dailyBonusCapReached = dailyBonusCount >= DAILY_BONUS_AD_MAX_PER_DAY;
  const nextBonusShopCoins = dailyBonusCapReached
    ? null
    : DAILY_BONUS_AD_REWARD_COINS[Math.min(dailyBonusCount, DAILY_BONUS_AD_REWARD_COINS.length - 1)];
  const remainingBonusToday = dailyBonusCapReached
    ? 0
    : DAILY_BONUS_AD_REWARD_COINS
        .slice(dailyBonusCount, DAILY_BONUS_AD_MAX_PER_DAY)
        .reduce((acc, coins) => acc + coins, 0);

  return (
    <div className="flex-1 p-6 pb-32 overflow-y-auto bg-[#1E1E2F]">
      <section className="mb-12 relative flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-[#2A2A45] to-[#222238] rounded-[2rem] p-8 overflow-hidden toy-shadow border-2 border-[#9D4EDD]/20">
        <div className="relative z-10 w-48 h-48 flex-shrink-0">
          <div className="w-full h-full bg-gradient-to-br from-[#FFD93D] to-[#E6A800] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,217,61,0.3)] border-4 border-[#FFD93D]/30 rotate-3">
            <img src="/img/shop/vendor.jpeg" alt="Shopkeeper" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-[#9D4EDD] to-[#7B2FBB] px-4 py-2 rounded-lg shadow-[0_0_12px_rgba(157,78,221,0.4)] -rotate-6 border border-[#C77DFF]/30">
            <p className="text-sm font-black text-white uppercase">{t('welcome')}</p>
          </div>
        </div>
        <div className="relative z-10 text-center md:text-left">
          <h2 className="text-4xl font-headline font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD93D] to-[#FFE066] leading-tight mb-4 tracking-tight">{t('bazaarTitle')}</h2>
          <p className="text-lg text-[#A0A0BE] max-w-xl">{t('bazaarSubtitle')}</p>
        </div>
      </section>

      <div className="flex bg-[#1A1A30] p-2 rounded-3xl gap-2 w-full overflow-x-auto shadow-inner border border-white/5 hide-scrollbar mb-8">
         {categories.map(cat => (
            <button 
               key={cat.id}
               onClick={() => {
                 audio.playSfx('click');
                 setActiveCategory(cat.id);
               }}
               className={cn(
                  "px-6 py-3 rounded-[1.5rem] font-black text-sm transition-all whitespace-nowrap",
                  activeCategory === cat.id
                     ? "bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] text-white shadow-[0_4px_0_0_#2A5090,0_0_12px_rgba(74,144,226,0.3)]"
                     : "text-[#A0A0BE] hover:bg-white/5 hover:text-white"
               )}
            >
               {cat.label}
            </button>
         ))}
      </div>

      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => {
            audio.playSfx('click');
            onOpenInventory();
          }}
          className="rounded-2xl bg-gradient-to-r from-[#9D4EDD] to-[#6f2ab0] px-4 py-2 font-black text-white shadow-[0_4px_0_0_#5A1F8A]"
        >
          {t('inventory', { defaultValue: 'Ir al inventario' })}
        </button>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {!user.adsRemoved && (
          <article className="rounded-[1.5rem] border-2 border-[#FF6B6B]/35 bg-gradient-to-br from-[#2A2A45] to-[#1f1f36] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#FF9E9E]">{t('premiumLabel')}</p>
                <h3 className="mt-1 font-headline text-2xl font-black text-white">{t('premiumNoAdsTitle')}</h3>
                <p className="mt-2 text-sm text-[#C9C9E8]">{t('premiumNoAdsBody')}</p>
              </div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FF6B6B]/50 bg-[#2b1020]">
                <Ban className="h-11 w-11 text-[#FF6B6B]" strokeWidth={2.5} />
                <span className="absolute text-[10px] font-black tracking-wider text-white">{t('premiumAdsBadge')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onBuyNoAds}
              className="mt-4 w-full rounded-xl bg-gradient-to-b from-[#FF9E9E] to-[#FF6B6B] py-3 text-sm font-black uppercase text-white shadow-[0_4px_0_0_#A03030]"
            >
              {t('premiumBuy')} {REMOVE_ADS_PRICE_EUR}
            </button>
          </article>
        )}

        <article className="rounded-[1.5rem] border-2 border-[#6BB5FF]/35 bg-gradient-to-br from-[#2A2A45] to-[#1f1f36] p-5">
          <p className="text-xs font-black uppercase tracking-widest text-[#9ed2ff]">{t('dailyBonusLabel')}</p>
          <div className="mt-1 flex items-center gap-2">
            <Maticoin className="h-7 w-7" />
            <h3
              className="font-headline text-2xl font-black uppercase tracking-wide text-transparent bg-gradient-to-b from-[#FFF7BF] via-[#FFD93D] to-[#E6A800] bg-clip-text drop-shadow-[0_0_10px_rgba(255,217,61,0.55)] animate-pulse"
              style={{ animationDuration: '2.8s' }}
            >
              {t('dailyMissionBonusTitle')}
            </h3>
          </div>
          <p className="mt-2 text-sm text-[#C9C9E8]">
            {t('dailyMissionAdsToday', { n: dailyBonusCount, max: DAILY_BONUS_AD_MAX_PER_DAY })}
          </p>
          {!dailyBonusCapReached && nextBonusShopCoins !== null && (
            <p className="mt-2 text-sm font-black text-[#FFD93D]">
              {t('shopNextBonus', { coins: nextBonusShopCoins })}
            </p>
          )}
          {!dailyBonusCapReached && (
            <p className="mt-1 text-xs text-[#9ed2ff]">
              {t('shopRemainingBonusToday', { coins: remainingBonusToday })}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              setBonusModalOpen(true);
            }}
            className="mt-4 w-full rounded-xl border-2 border-[#6BB5FF]/50 bg-[#1b2a44]/70 py-2.5 text-xs font-black uppercase tracking-wide text-[#CFE7FF] shadow-[0_4px_0_0_#20395e]"
          >
            {t('shopViewRewards')}
          </button>
          <button
            type="button"
            disabled={bonusBusy || dailyBonusCapReached}
            onClick={async () => {
              audio.playSfx('click');
              setBonusBusy(true);
              try {
                await onClaimDailyBonusCoins();
              } finally {
                setBonusBusy(false);
              }
            }}
            className="mt-4 w-full rounded-xl bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] py-3 text-sm font-black uppercase text-white shadow-[0_4px_0_0_#2A5090] disabled:opacity-40"
          >
            {dailyBonusCapReached
              ? t('shopLimitReached')
              : bonusBusy
                ? '...'
                : user.adsRemoved
                  ? t('dailyMissionBonusSolve')
                  : t('dailyMissionBonusWatch')}
          </button>
        </article>
      </section>

      {bonusModalOpen && (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] border-2 border-[#6BB5FF]/45 bg-gradient-to-b from-[#2b3558] to-[#1f2542] p-6 shadow-[0_16px_0_0_rgba(0,0,0,0.35)] sm:max-w-lg sm:p-7">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#FFD93D]/50 bg-[#FFD93D]/10 px-3 py-1 shadow-[0_0_20px_rgba(255,217,61,0.35)]">
                <Maticoin className="h-6 w-6" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#FFE58A]">{t('dailyBonusLabel')}</span>
              </div>
              <h3
                className="font-headline text-3xl font-black uppercase tracking-wide text-transparent bg-gradient-to-b from-[#FFF7BF] via-[#FFD93D] to-[#E6A800] bg-clip-text drop-shadow-[0_0_12px_rgba(255,217,61,0.6)] animate-pulse sm:text-4xl"
                style={{ animationDuration: '2.8s' }}
              >
                {t('dailyMissionBonusTitle')}
              </h3>
            </div>
            <p className="mt-2 text-center text-sm text-[#CFE7FF]">
              {t('dailyMissionAdsToday', { n: dailyBonusCount, max: DAILY_BONUS_AD_MAX_PER_DAY })}
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {DAILY_BONUS_AD_REWARD_COINS.map((coins, idx) => {
                const unlocked = idx < dailyBonusCount;
                const isNext = idx === dailyBonusCount && !dailyBonusCapReached;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-center",
                      unlocked
                        ? "border-emerald-300/70 bg-emerald-500/20"
                        : isNext
                          ? "border-[#FFD93D]/70 bg-[#FFD93D]/15"
                          : "border-white/15 bg-white/5"
                    )}
                  >
                    <p className="text-[10px] font-black uppercase text-white/75">#{idx + 1}</p>
                    <p className="mt-1 font-headline text-sm font-black text-[#FFE58A]">+{coins}</p>
                  </div>
                );
              })}
            </div>
            {!dailyBonusCapReached && (
              <p className="mt-4 text-center font-bold text-[#FFD93D]">
                {t('shopNextAndRemainingBonus', { next: nextBonusShopCoins, remaining: remainingBonusToday })}
              </p>
            )}
            {dailyBonusCapReached && (
              <p className="mt-4 text-center font-bold text-[#A0A0BE]">{t('shopDailyLimitCompleted')}</p>
            )}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={bonusBusy || dailyBonusCapReached}
                onClick={async () => {
                  audio.playSfx('click');
                  setBonusBusy(true);
                  try {
                    await onClaimDailyBonusCoins();
                  } finally {
                    setBonusBusy(false);
                  }
                }}
                className="rounded-xl bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] py-3 text-sm font-black uppercase text-white shadow-[0_4px_0_0_#2A5090] disabled:opacity-40"
              >
                {dailyBonusCapReached
                  ? t('shopLimitReached')
                  : bonusBusy
                    ? '...'
                    : user.adsRemoved
                      ? t('dailyMissionBonusSolve')
                      : t('dailyMissionBonusWatch')}
              </button>
              <button
                type="button"
                onClick={() => {
                  audio.playSfx('click');
                  setBonusModalOpen(false);
                }}
                className="rounded-xl border-2 border-white/20 bg-white/5 py-3 text-sm font-black uppercase text-white/90"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          // Guard initialization just in case state was corrupted
          const unlocked = user.unlockedItems || [];
          
          const isConsumable = item.type === 'POTION' || item.type === 'HERB';
          const ownedQty = (user.itemInventory?.[item.id] ?? 0) || (unlocked.includes(item.id) ? 1 : 0);
          const isUnlocked = isConsumable ? ownedQty > 0 : unlocked.includes(item.id);
          const levelOk = user.currentLevel >= item.unlockLevel;

          return (
            <article key={item.id} className="bg-gradient-to-b from-[#2A2A45] to-[#222238] rounded-[1.5rem] p-5 toy-shadow border-2 border-white/5 flex flex-col gap-4 group transition-all hover:border-[#4A90E2]/30">
              <div className="relative w-full aspect-square bg-[#1A1A30] rounded-[2rem] overflow-hidden flex items-center justify-center border-2 border-white/10 shadow-inner">
                {isConsumable && ownedQty > 0 && (
                  <span className="absolute left-3 top-3 z-20 rounded-full border-2 border-white/30 bg-gradient-to-r from-[#6BCB77] to-[#4DA85A] px-2.5 py-1 text-xs font-black text-white shadow-[0_0_10px_rgba(107,203,119,0.5)]">
                    x{ownedQty}
                  </span>
                )}
                {item.rarity && item.rarity !== 'BASIC' && <span className={cn("absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest z-10 text-white", item.rarity === 'LEGENDARY' ? 'bg-gradient-to-r from-[#FFD93D] to-[#E6A800] text-[#3D2E00]' : item.rarity === 'EPIC' ? 'bg-gradient-to-r from-[#C77DFF] to-[#9D4EDD]' : 'bg-gradient-to-r from-[#6BB5FF] to-[#4A90E2]')}>{t(`rarity${item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1).toLowerCase()}` as any)}</span>}
                {item.image.startsWith('http') || item.image.startsWith('/') ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-[#9D4EDD]/30 to-[#4A90E2]/30 rounded-full flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                    <span className="text-[#FFD93D] font-black text-4xl material-symbols-outlined">{item.image}</span>
                  </div>
                )}
                {!levelOk && (
                  <div className="absolute inset-0 bg-[#1E1E2F]/75 flex flex-col items-center justify-center z-20 rounded-[2rem] backdrop-blur-[2px]">
                    <Lock className="text-[#FF6B6B] w-10 h-10 mb-1" />
                    <span className="text-white font-black text-xs uppercase tracking-wide px-2 text-center">
                      {t('unlockAtLevel', { level: item.unlockLevel, defaultValue: `Map Lv. ${item.unlockLevel}` })}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xl font-headline font-black text-white leading-tight">{t(`name_${item.id}`, { defaultValue: item.name })}</h3>
                <p className="text-sm text-[#A0A0BE] mt-2 leading-tight">{t(`desc_${item.id}`, { defaultValue: item.description })}</p>
                {item.skills && item.skills.length > 0 && (
                  <ul className="mt-3 text-sm font-bold space-y-1">
                    {item.skills.map((skill, index) => {
                       const translatedSkill = (t as any)(`skill_${item.id}_${index}`, { defaultValue: skill });
                       const isPassive = translatedSkill.toLowerCase().includes('pasiva') || translatedSkill.toLowerCase().includes('bonus') || translatedSkill.toLowerCase().includes('passive') || translatedSkill.toLowerCase().includes('passif');
                       return (
                         <li key={index} className={cn("flex items-start gap-1.5", isPassive ? "text-[#FFD93D]" : "text-[#6BB5FF]")}>
                           <Zap size={16} className={cn("mt-0.5 shrink-0", isPassive ? "fill-[#FFD93D] text-[#FFD93D]" : "fill-[#6BB5FF] text-[#6BB5FF]")} />
                           <span>{translatedSkill}</span>
                         </li>
                       );
                    })}
                  </ul>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 font-black text-[#FFD93D] text-xl">
                  {isUnlocked ? (
                    <div className="flex items-center gap-2">
                      <User size={24} className="text-[#6BCB77]" />
                      {isConsumable && <span className="text-sm text-white">x{ownedQty}</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">{item.price} <Maticoin className="w-5 h-5"/></div>
                  )}
                </div>
                <button
                  onClick={() => {
                    audio.playSfx('click');
                    onBuy(item);
                  }}
                  disabled={user.coins < item.price || !levelOk || (!isConsumable && isUnlocked)}
                  className={cn(
                    "px-6 py-3 rounded-xl font-black transition-all",
                    user.coins >= item.price && levelOk && (isConsumable || !isUnlocked)
                      ? "bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] text-white shadow-[0_4px_0_0_#2A5090,0_0_10px_rgba(74,144,226,0.3)]"
                      : "bg-[#3A3A58] text-[#5A5A78] cursor-not-allowed"
                  )}
                >
                  {isConsumable ? t('buy') : isUnlocked ? t('selected') : t('buy')}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

const InventoryScreen = ({ user, onBack, onEquip }: { user: UserState; onBack: () => void; onEquip: (id: string) => void }) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<'ALL' | ShopItem['type']>('ALL');
  const [doorsOpen, setDoorsOpen] = useState(false);
  const categories: { id: 'ALL' | ShopItem['type']; label: string }[] = [
    { id: 'ALL', label: t('inventoryAll', { defaultValue: t('catAll') }) },
    { id: 'ARMOR', label: t('catArmor') },
    { id: 'HELMET', label: t('catHelmet') },
    { id: 'PEN', label: t('catPen') },
    { id: 'POTION', label: t('catPotion') },
    { id: 'HERB', label: t('catHerb') },
    { id: 'PET', label: t('catPet') },
  ];
  const owned = useMemo(() => {
    const inv = user.itemInventory || {};
    const baseOwned = SHOP_ITEMS.filter((item) => {
      const isConsumable = item.type === 'POTION' || item.type === 'HERB';
      const qty = (inv[item.id] ?? 0) || ((user.unlockedItems || []).includes(item.id) ? 1 : 0);
      return isConsumable ? qty > 0 : (user.unlockedItems || []).includes(item.id);
    });
    if (activeCategory === 'ALL') return baseOwned;
    return baseOwned.filter((item) => item.type === activeCategory);
  }, [user.itemInventory, user.unlockedItems, activeCategory]);

  useEffect(() => {
    const id = window.setTimeout(() => setDoorsOpen(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  const shelfRows = useMemo(() => {
    const rows: ShopItem[][] = [];
    for (let i = 0; i < owned.length; i += 4) rows.push(owned.slice(i, i + 4));
    return rows;
  }, [owned]);

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#1f2a3f_0%,#121a2b_45%,#0b1020_100%)] p-6 pb-32">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-3xl font-headline font-black text-[#f9e9c6] drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">{t('inventoryTitle', { defaultValue: 'Armario del Heroe' })}</h2>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/20 bg-[#2A2A45]/90 px-4 py-2 font-black text-white backdrop-blur-sm"
          >
            {t('inventoryBackMap', { defaultValue: 'Volver al mapa' })}
          </button>
        </div>
        <p className="mb-5 text-sm text-[#d7c9b0]">
          {t('inventorySubtitle', { defaultValue: 'Tus objetos estan organizados en estanterias. Desde aqui equipas todo lo que ya compraste.' })}
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                audio.playSfx('click');
                setActiveCategory(cat.id);
              }}
              className={cn(
                'rounded-xl border px-4 py-2 text-sm font-black transition-all',
                activeCategory === cat.id
                  ? 'border-[#ffe08a] bg-gradient-to-b from-[#7a4a1d] to-[#5a3212] text-[#ffe9b6] shadow-[0_4px_0_0_#3b1f0c]'
                  : 'border-white/15 bg-[#2A2A45]/70 text-[#d1c2aa] hover:border-[#caa56a]'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative [perspective:1600px]">
          <div className="absolute inset-0 rounded-[2.2rem] border border-[#8fb9d4]/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] backdrop-blur-[1px]" />
          <div className="pointer-events-none absolute inset-[6px] rounded-[1.95rem] bg-[repeating-linear-gradient(135deg,rgba(170,215,245,0.06)_0px,rgba(170,215,245,0.06)_2px,rgba(20,40,60,0)_2px,rgba(20,40,60,0)_10px)]" />
          <div className="pointer-events-none absolute -left-2 top-3 bottom-3 w-6 rounded-l-2xl bg-gradient-to-b from-[#425f78] via-[#2c4359] to-[#1c2d3f] shadow-[inset_-2px_0_8px_rgba(170,210,235,0.22),inset_2px_0_10px_rgba(0,0,0,0.4)]" />
          <div className="pointer-events-none absolute -right-2 top-3 bottom-3 w-6 rounded-r-2xl bg-gradient-to-b from-[#3f5a73] via-[#2a4056] to-[#1a2a3a] shadow-[inset_2px_0_8px_rgba(170,210,235,0.18),inset_-2px_0_10px_rgba(0,0,0,0.45)]" />
          <div className="pointer-events-none absolute left-5 right-5 -top-2 h-5 rounded-t-2xl bg-gradient-to-r from-[#6f8ea7] via-[#86a6bf] to-[#6f8ea7] shadow-[0_6px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(220,245,255,0.45)]" />

          <div className="relative rounded-[2rem] border-2 border-[#6f95b4]/45 bg-[linear-gradient(180deg,#1e3247_0%,#142638_55%,#111f2f_100%)] p-4 shadow-[0_20px_35px_rgba(0,0,0,0.5)] [transform:rotateX(1.8deg)] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(167,219,255,0.2)_0%,rgba(167,219,255,0)_45%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(130,175,205,0.06)_0px,rgba(130,175,205,0.06)_1px,transparent_1px,transparent_14px)]" />

            <div className="space-y-5">
              {shelfRows.map((row, rowIdx) => (
                <div key={rowIdx} className="relative pb-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                    {row.map((item) => {
                      const qty = (user.itemInventory?.[item.id] ?? 0) || ((user.unlockedItems || []).includes(item.id) ? 1 : 0);
                      const isEquipped = (user.equippedItems || []).includes(item.id);
                      const isConsumable = item.type === 'POTION' || item.type === 'HERB';
                      return (
                        <article
                          key={item.id}
                          className="relative rounded-xl border border-[#9ac0db]/40 bg-gradient-to-b from-[#e8f3fb] to-[#d6e6f2] p-2 shadow-[0_8px_14px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5"
                        >
                          <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg border border-[#7ea4c0]/55 bg-[#cfe1ee]">
                            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            {isConsumable && (
                              <span className="absolute right-1.5 top-1.5 rounded-full bg-[#0f1a2b]/85 px-1.5 py-0.5 text-[10px] font-black text-white shadow-md">
                                x{qty}
                              </span>
                            )}
                            {isEquipped && (
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-gradient-to-r from-[#6BCB77] to-[#4DA85A] px-1.5 py-0.5 text-[10px] font-black text-white shadow-md">
                                E
                              </span>
                            )}
                          </div>
                          <h3 className="truncate text-[11px] font-black text-[#1c2f42]">{t(`name_${item.id}`, { defaultValue: item.name })}</h3>
                          <button
                            type="button"
                            onClick={() => onEquip(item.id)}
                            disabled={isConsumable && qty <= 0}
                            className={cn(
                              'mt-2 w-full rounded-md px-2 py-1.5 text-[11px] font-black',
                              isEquipped
                                ? 'bg-gradient-to-b from-[#b34a4a] to-[#8b2f2f] text-white shadow-[0_2px_0_0_#5f1e1e]'
                                : 'bg-gradient-to-b from-[#5fa9f2] to-[#3f7bc0] text-white shadow-[0_2px_0_0_#2c5688]'
                            )}
                          >
                            {isEquipped ? t('unequip', { defaultValue: 'Quitar' }) : t('equip', { defaultValue: 'Equipar' })}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  <div className="pointer-events-none absolute left-2 right-2 bottom-0 h-2.5 rounded-md bg-gradient-to-r from-[#4d6a83] via-[#6f93b0] to-[#4d6a83] shadow-[0_3px_7px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(220,245,255,0.4)]" />
                  <div className="pointer-events-none absolute left-2 right-2 -bottom-1 h-1 rounded-b-md bg-gradient-to-r from-[#223447] via-[#2e4760] to-[#223447]" />
                </div>
              ))}
            </div>
          </div>

          {/* Sliding doors animation */}
          <div
            className={cn(
              'pointer-events-none absolute left-1 top-1 bottom-1 w-[calc(50%-2px)] rounded-l-[1.9rem] border-r border-[#9ac0db]/35 bg-[linear-gradient(180deg,rgba(63,95,122,0.94)_0%,rgba(34,56,76,0.95)_60%,rgba(24,41,58,0.97)_100%)] transition-transform duration-500 ease-out overflow-hidden',
              doorsOpen ? '-translate-x-[102%]' : 'translate-x-0'
            )}
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(180,220,245,0.08)_0px,rgba(180,220,245,0.08)_2px,transparent_2px,transparent_12px)]" />
            <div className="absolute left-2 right-2 top-4 h-3 rounded-md border border-[#95b8d1]/35 bg-gradient-to-b from-[#456783] to-[#2a4258]" />
            <div className="absolute left-2 right-2 bottom-4 h-3 rounded-md border border-[#95b8d1]/35 bg-gradient-to-b from-[#456783] to-[#2a4258]" />
            <div className="absolute right-3 top-1/2 h-16 w-2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#a9c9de] to-[#5f7e95] shadow-[0_0_8px_rgba(170,220,255,0.45)]" />
            {[8, 28, 48, 68, 88].map((n) => (
              <div key={`l-rivet-t-${n}`} className="absolute left-2 h-1.5 w-1.5 rounded-full bg-[#c6d8e6] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.45)]" style={{ top: `${n}%` }} />
            ))}
            {[12, 32, 52, 72, 92].map((n) => (
              <div key={`l-rivet-b-${n}`} className="absolute right-2 h-1.5 w-1.5 rounded-full bg-[#c6d8e6] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.45)]" style={{ top: `${n}%` }} />
            ))}
          </div>
          <div
            className={cn(
              'pointer-events-none absolute right-1 top-1 bottom-1 w-[calc(50%-2px)] rounded-r-[1.9rem] border-l border-[#9ac0db]/35 bg-[linear-gradient(180deg,rgba(63,95,122,0.94)_0%,rgba(34,56,76,0.95)_60%,rgba(24,41,58,0.97)_100%)] transition-transform duration-500 ease-out overflow-hidden',
              doorsOpen ? 'translate-x-[102%]' : 'translate-x-0'
            )}
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(180,220,245,0.08)_0px,rgba(180,220,245,0.08)_2px,transparent_2px,transparent_12px)]" />
            <div className="absolute left-2 right-2 top-4 h-3 rounded-md border border-[#95b8d1]/35 bg-gradient-to-b from-[#456783] to-[#2a4258]" />
            <div className="absolute left-2 right-2 bottom-4 h-3 rounded-md border border-[#95b8d1]/35 bg-gradient-to-b from-[#456783] to-[#2a4258]" />
            <div className="absolute left-3 top-1/2 h-16 w-2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#a9c9de] to-[#5f7e95] shadow-[0_0_8px_rgba(170,220,255,0.45)]" />
            {[8, 28, 48, 68, 88].map((n) => (
              <div key={`r-rivet-t-${n}`} className="absolute left-2 h-1.5 w-1.5 rounded-full bg-[#c6d8e6] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.45)]" style={{ top: `${n}%` }} />
            ))}
            {[12, 32, 52, 72, 92].map((n) => (
              <div key={`r-rivet-b-${n}`} className="absolute right-2 h-1.5 w-1.5 rounded-full bg-[#c6d8e6] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.45)]" style={{ top: `${n}%` }} />
            ))}
          </div>
        </div>
      </div>
      {owned.length === 0 && (
        <p className="mt-10 text-center text-[#d7c9b0]">{t('inventoryEmpty', { defaultValue: 'No hay objetos en esta balda todavia.' })}</p>
      )}
    </div>
  );
};

const ProfileScreen = ({
  user,
  onSelectAvatar,
  onUpdateSettings,
  accountUser,
  accountBusy,
  accountError,
  onLinkGoogle,
  onLinkApple,
  onLinkEmail,
  onSignInGoogle,
  onSignInApple,
  onSignInEmail,
  onSignOut,
  onResetProgress,
}: {
  user: UserState;
  onSelectAvatar: () => void;
  onUpdateSettings: (u: Partial<UserState>) => void;
  accountUser: FirebaseUser | null;
  accountBusy: boolean;
  accountError: string | null;
  onLinkGoogle: () => Promise<void>;
  onLinkApple: () => Promise<void>;
  onLinkEmail: (email: string, password: string) => Promise<void>;
  onSignInGoogle: () => Promise<void>;
  onSignInApple: () => Promise<void>;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onResetProgress: () => void;
}) => {
  const { t } = useTranslation();
  const [legalOpen, setLegalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const providers = accountUser?.providerData?.map((p) => p.providerId).filter(Boolean) || [];
  const linked = providers.length > 0 && !(providers.length === 1 && providers[0] === 'firebase');
  const isAnonymous = !!accountUser?.isAnonymous && !linked;
  return (
    <div className="flex-1 p-6 pb-32 overflow-y-auto space-y-8 bg-[#1E1E2F]">
      <LegalDocumentsModal open={legalOpen} onClose={() => setLegalOpen(false)} />
      <section className="relative bg-gradient-to-br from-[#2A2A45] to-[#222238] rounded-[2rem] p-6 md:p-8 overflow-hidden toy-shadow border-2 border-[#4A90E2]/20">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A90E2]/5 to-[#9D4EDD]/5 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group mx-auto md:mx-0">
            <FramedAvatar src={AVATARS.find(a => a.id === user.selectedAvatar)?.image || AVATARS[0].image} alt="Avatar" size="w-32 h-32" className="-rotate-2 group-hover:rotate-0 transition-transform duration-300" />
            <button
              onClick={onSelectAvatar}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer rounded-[1.2rem] z-20 backdrop-blur-sm"
            >
              <Edit3 size={32} />
            </button>
            <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-[#FFD93D] to-[#E6A800] text-[#3D2E00] font-headline font-black px-5 py-2 rounded-full text-xl shadow-[0_0_15px_rgba(255,217,61,0.4)] border-2 border-white/20 rotate-6 z-30">
              LVL {user.currentLevel}
            </div>
          </div>
          <div className="text-center md:text-left flex-1 mt-4 md:mt-0">
            <h2 className="font-headline text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] to-[#C77DFF] tracking-tight mb-2 uppercase">{user.playerName || t('mathExplorer')}</h2>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
              <div className="bg-[#1A1A30] px-4 py-2 rounded-xl flex items-center gap-2 shadow-inner border border-[#FFD93D]/20">
                <Zap size={20} className="text-[#FFD93D]" fill="currentColor" />
                <span className="text-white font-black uppercase tracking-wider">{user.solvedCount} {t('solved')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Difficulty Selector exactly in Profile */}
      <section className="bg-gradient-to-b from-[#2A2A45] to-[#222238] rounded-[2rem] p-6 md:p-8 toy-shadow flex flex-col lg:flex-row items-center justify-between gap-6 border-2 border-[#FF6B6B]/20">
         <div>
            <h3 className="font-headline text-3xl font-black text-white flex items-center gap-3"><Flame size={32} className="text-[#FF6B6B]" fill="currentColor"/> {t('difficulty')}</h3>
            <p className="text-[#A0A0BE] font-bold max-w-sm mt-2 hidden lg:block">{t('adjustDifficulty')}</p>
         </div>
         <div className="flex bg-[#1A1A30] p-2 rounded-3xl gap-2 w-full max-w-md overflow-x-auto shadow-inner border border-white/5">
            {['EASY', 'NORMAL', 'HARD'].map(diff => {
               const diffColors: Record<string, string> = {
                 'EASY': "bg-gradient-to-b from-[#6BCB77] to-[#4DA85A] shadow-[0_4px_0_0_#3A8A45]",
                 'NORMAL': "bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] shadow-[0_4px_0_0_#2A5090]",
                 'HARD': "bg-gradient-to-b from-[#FF6B6B] to-[#D94545] shadow-[0_4px_0_0_#A03030]"
               };
               return (
                 <button
                    key={diff}
                    onClick={() => {
                      audio.playSfx('click');
                      onUpdateSettings({ difficulty: diff as 'EASY'|'NORMAL'|'HARD' });
                    }}
                    className={cn(
                       "flex-1 px-4 py-4 rounded-[1.5rem] font-black text-sm transition-all whitespace-nowrap",
                       (user.difficulty || 'NORMAL') === diff
                          ? `${diffColors[diff]} text-white`
                          : "text-[#A0A0BE] hover:bg-white/5 hover:text-white"
                    )}
                 >
                    {t(diff.toLowerCase())}
                 </button>
               );
            })}
         </div>
      </section>

      <section className="bg-gradient-to-b from-[#2A2A45] to-[#222238] rounded-[2rem] p-6 md:p-8 toy-shadow border-2 border-[#6BCB77]/20">
          <h3 className="font-headline text-3xl font-black text-white mb-8">{t('tableMastery')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(tabId => {
              const perc = computeTableMasteryPercent(user.problemHistory, tabId, user.currentLevel);
              return (
              <div key={tabId} className="space-y-2">
                <div className="flex justify-between font-headline font-bold text-sm px-1">
                  <span className="uppercase text-[#A0A0BE] tracking-wider">{t('tableOf', { number: tabId })}</span>
                  <span className="text-[#6BCB77] font-black">{perc}%</span>
                </div>
                <div className="h-5 bg-[#1A1A30] rounded-full overflow-hidden shadow-inner p-1 border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-[#6BCB77] to-[#4A90E2] rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(107,203,119,0.4)]"
                    style={{ width: `${perc}%` }}
                  ></div>
                </div>
              </div>
            )})}
          </div>
      </section>

      <section className="bg-gradient-to-b from-[#2A2A45] to-[#222238] rounded-[2rem] p-6 md:p-8 toy-shadow border-2 border-[#FFD93D]/25">
        <h3 className="font-headline text-2xl font-black text-white mb-2">{t('profileCloudTitle')}</h3>
        <p className="text-[#A0A0BE] font-bold text-sm mb-4">
          {isAnonymous
            ? t('profileCloudGuestMode')
            : t('profileCloudLinkedMode')}
        </p>
        <p className="text-[#FFD93D] font-black text-sm mb-4">
          {t('profileLinkReward', { coins: LINK_ACCOUNT_REWARD_COINS })}
        </p>
        <div className="bg-[#1A1A30] rounded-xl border border-white/10 p-3 mb-4">
          <p className="text-xs text-[#A0A0BE] font-bold">{t('profileUid')}: {accountUser?.uid || '—'}</p>
          <p className="text-xs text-[#A0A0BE] font-bold mt-1">
            {t('profileProviders')}: {providers.join(', ') || t('profileGuest')}
          </p>
        </div>
        {accountError && <p className="text-[#FF6B6B] text-xs font-bold mb-3">{accountError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            disabled={accountBusy || linked}
            onClick={() => void onLinkGoogle()}
            className="px-4 py-3 rounded-xl font-black bg-white disabled:opacity-40 text-[#1A1A30] flex items-center justify-center gap-2 border border-[#D9D9E8]"
          >
            <GoogleLogo />
            <span>{t('profileLinkGoogle')}</span>
          </button>
          <button
            type="button"
            disabled={accountBusy || linked}
            onClick={() => void onLinkApple()}
            className="px-4 py-3 rounded-xl font-black bg-black disabled:opacity-40 text-white flex items-center justify-center gap-2 border border-white/20"
          >
            <AppleLogo />
            <span>{t('profileLinkApple')}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('authEmailPlaceholder')}
            className="bg-[#1A1A30] border-2 border-white/10 rounded-xl px-3 py-3 text-white"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('authPasswordPlaceholder')}
            className="bg-[#1A1A30] border-2 border-white/10 rounded-xl px-3 py-3 text-white"
          />
        </div>
        <button
          type="button"
          disabled={accountBusy || linked || !email || password.length < 6}
          onClick={() => void onLinkEmail(email.trim(), password)}
          className="mt-3 w-full px-4 py-3 rounded-xl font-black bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] disabled:opacity-40 text-white"
        >
          {t('profileLinkEmail')}
        </button>
        {linked && (
          <button
            type="button"
            disabled={accountBusy}
            onClick={() => {
              if (window.confirm(t('profileSignOutConfirm'))) void onSignOut();
            }}
            className="mt-4 w-full px-4 py-3 rounded-xl font-black bg-[#1A1A30] border-2 border-white/15 text-[#A0A0BE] disabled:opacity-40 flex items-center justify-center gap-2 hover:border-[#FF6B6B]/50 hover:text-[#FF6B6B] transition-colors"
          >
            <LogOut size={20} />
            <span>{t('profileSignOut')}</span>
          </button>
        )}
      </section>

      <section className="bg-gradient-to-b from-[#2A2A45] to-[#222238] rounded-[2rem] p-6 md:p-8 toy-shadow border-2 border-[#6BB5FF]/25">
        <h3 className="font-headline text-2xl font-black text-white mb-2">{t('profileRecoverTitle')}</h3>
        <p className="text-[#A0A0BE] font-bold text-sm mb-4">
          {t('profileRecoverBody')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            disabled={accountBusy}
            onClick={() => void onSignInGoogle()}
            className="px-4 py-3 rounded-xl font-black bg-white disabled:opacity-40 text-[#1A1A30] flex items-center justify-center gap-2 border border-[#D9D9E8]"
          >
            <GoogleLogo />
            <span>{t('authSignInGoogle')}</span>
          </button>
          <button
            type="button"
            disabled={accountBusy}
            onClick={() => void onSignInApple()}
            className="px-4 py-3 rounded-xl font-black bg-black disabled:opacity-40 text-white flex items-center justify-center gap-2 border border-white/20"
          >
            <AppleLogo />
            <span>{t('authSignInApple')}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder={t('authEmailPlaceholder')}
            className="bg-[#1A1A30] border-2 border-white/10 rounded-xl px-3 py-3 text-white"
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder={t('authPasswordPlaceholder')}
            className="bg-[#1A1A30] border-2 border-white/10 rounded-xl px-3 py-3 text-white"
          />
        </div>
        <button
          type="button"
          disabled={accountBusy || !loginEmail || loginPassword.length < 6}
          onClick={() => void onSignInEmail(loginEmail.trim(), loginPassword)}
          className="mt-3 w-full px-4 py-3 rounded-xl font-black bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] disabled:opacity-40 text-white"
        >
          {t('authSignInEmail')}
        </button>
      </section>

      {/* Danger Zone */}
      <section className="bg-gradient-to-b from-[#2A2A45] to-[#222238] rounded-[2rem] p-6 md:p-8 toy-shadow border-2 border-[#FF6B6B]/30">
         <h3 className="font-headline text-2xl font-black text-[#FF6B6B] flex items-center gap-2 mb-2"><ShieldAlert size={28}/> {t('dangerZone')}</h3>
         <p className="text-[#A0A0BE] font-bold text-sm mb-4">{t('dangerDesc')}</p>
         <button onClick={() => {
            if (window.confirm(t('resetConfirm'))) {
              onResetProgress();
            }
         }} className="w-full bg-[#FF6B6B]/10 text-[#FF6B6B] font-black px-6 py-4 rounded-2xl hover:bg-[#FF6B6B] hover:text-white transition-colors border-2 border-[#FF6B6B]/30 shadow-sm hover:shadow-[0_0_20px_rgba(255,107,107,0.3)]">
           {t('resetProgress')}
         </button>
      </section>

      <div className="text-center pb-2">
        <button
          type="button"
          onClick={() => {
            audio.playSfx('click');
            setLegalOpen(true);
          }}
          className="text-sm font-bold text-[#6BB5FF] hover:text-[#93c5fd] underline underline-offset-2 decoration-[#6BB5FF]/40 transition-colors"
        >
          {t('profileLegalLink')}
        </button>
      </div>
    </div>
  );
};

const SettingsScreen = ({ user, onUpdate, onBack }: { user: UserState, onUpdate: (u: Partial<UserState>) => void, onBack: () => void }) => {
  const { t, i18n } = useTranslation();
  
  const langs: { id: UserState['language'], flagUrl: string }[] = [
    { id: 'Spanish', flagUrl: 'https://cdn-icons-png.flaticon.com/512/323/323365.png' },
    { id: 'Catalan', flagUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 6"><rect width="9" height="6" fill="%23FFCC00"/><g fill="%23CC0000"><rect y="0.66" width="9" height="0.66"/><rect y="2.00" width="9" height="0.66"/><rect y="3.33" width="9" height="0.66"/><rect y="4.66" width="9" height="0.66"/></g></svg>' }, 
    { id: 'English', flagUrl: 'https://cdn-icons-png.flaticon.com/512/330/330425.png' },
    { id: 'French', flagUrl: 'https://cdn-icons-png.flaticon.com/512/330/330490.png' },
    { id: 'Portuguese', flagUrl: '/flags/portugal.png' },
    { id: 'German', flagUrl: 'https://cdn-icons-png.flaticon.com/512/197/197571.png' },
    { id: 'Dutch', flagUrl: '/flags/netherlands.png' },
    { id: 'Russian', flagUrl: 'https://cdn-icons-png.flaticon.com/512/197/197408.png' },
  ];

  return (
    <div className="flex-1 map-mesh p-6 flex flex-col items-center overflow-y-auto bg-[#1E1E2F]">
      <div className="w-full max-w-md bg-gradient-to-b from-[#2A2A45] to-[#222238] rounded-[2rem] border-2 border-[#9D4EDD]/20 toy-shadow p-6 mt-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4A90E2] via-[#9D4EDD] to-[#FFD93D]"></div>
        <h2 className="text-3xl font-black text-center mb-8 font-headline text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] to-[#C77DFF] tracking-tight">{t('languageSettings')}</h2>
        <div className="space-y-4">
          {langs.map(l => (
            <label key={l.id} className="group cursor-pointer block squish-physics">
              <input
                type="radio"
                name="lang"
                className="hidden peer"
                checked={user.language === l.id}
                onChange={() => {
                  audio.playSfx('click');
                  onUpdate({ language: l.id });
                  i18n.changeLanguage(l.id);
                }}
              />
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-white/10 bg-[#1A1A30] peer-checked:border-[#FFD93D]/50 peer-checked:bg-[#FFD93D]/10 transition-all">
                <div className="flex items-center gap-4">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[#3a3a55] to-[#1e1e32] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                    <img
                      src={l.flagUrl}
                      alt={l.id}
                      className="block h-full w-full origin-center scale-[1.18] object-contain object-center"
                    />
                  </div>
                  <span className="font-black text-xl text-white">{l.id}</span>
                </div>
                <div className="w-8 h-8 rounded-full border-4 border-[#3A3A58] bg-[#1A1A30] flex items-center justify-center peer-checked:border-[#FFD93D] flex-shrink-0">
                  <div className="w-4 h-4 rounded-full bg-[#FFD93D] opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                </div>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={() => {
            audio.playSfx('click');
            onBack();
          }}
          className="mt-10 w-full bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] text-white font-black text-2xl py-5 rounded-2xl shadow-[0_6px_0_0_#2A5090,0_0_20px_rgba(74,144,226,0.3)] font-headline uppercase tracking-wider block text-center active:translate-y-1 active:shadow-[0_2px_0_0_#2A5090] transition-all"
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

/** Interruptor cápsula: la bolita va con left/right para no salirse del carril */
const AudioKidSwitch = ({
  active,
  disabled,
  onClick,
  variant,
  ariaLabel,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant: 'danger' | 'play';
  ariaLabel: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'relative h-10 w-[4.25rem] shrink-0 rounded-full border-2 p-1 transition-colors',
      'border-b-[5px] active:border-b-2 active:translate-y-[3px]',
      variant === 'danger' &&
        (active
          ? 'border-[#ff8b8b] bg-gradient-to-b from-[#ff9a9a] to-[#e54545] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]'
          : 'border-white/25 bg-gradient-to-b from-[#3a3d5c] to-[#252540] shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]'),
      variant === 'play' &&
        (active
          ? 'border-[#4ecf5f] bg-gradient-to-b from-[#8aed98] to-[#34b846] shadow-[inset_0_-3px_0_rgba(0,0,0,0.1)]'
          : 'border-white/15 bg-gradient-to-b from-[#3a3d5c] to-[#252540] shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]'),
      disabled && 'pointer-events-none opacity-40'
    )}
  >
    <span
      className={cn(
        'pointer-events-none absolute top-1/2 size-[1.625rem] -translate-y-1/2 rounded-full border-2 border-white/60 bg-white shadow-[0_3px_0_rgba(0,0,0,0.15)] transition-all duration-200 ease-out',
        active ? 'right-1 left-auto' : 'left-1 right-auto'
      )}
    />
  </button>
);

const AudioSettingsScreen = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const [, setRev] = useState(0);
  useEffect(() => audio.subscribe(() => setRev((n) => n + 1)), []);
  const prefs = audio.getPrefs();

  const update = (partial: Partial<AudioPrefs>) => {
    audio.playSfx('click');
    audio.setPrefs(partial);
  };

  const rowCard = (
    label: string,
    icon: React.ReactNode,
    accent: string,
    on: boolean,
    onToggle: () => void,
    volKey: 'mapVol' | 'battleVol' | 'sfxVol'
  ) => {
    const switchActive = on && !prefs.masterMuted;
    return (
      <div
        className={cn(
          'rounded-[1.75rem] border-4 border-white/25 p-4 shadow-[0_8px_0_rgba(0,0,0,0.2)] transition-transform',
          accent
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-4 border-white/30 bg-white/15 text-white shadow-inner">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-playful text-lg font-bold leading-tight text-white drop-shadow-sm sm:text-xl">{label}</p>
          </div>
          <AudioKidSwitch
            ariaLabel={label}
            active={switchActive}
            disabled={prefs.masterMuted}
            variant="play"
            onClick={onToggle}
          />
        </div>
        <div className="mt-4 pl-1">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs[volKey] * 100)}
            disabled={prefs.masterMuted}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              audio.setPrefs({ [volKey]: v });
            }}
            className="audio-kids-range"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#1a1b32] map-mesh px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-[#9d4edd]/25 blur-3xl" />
        <div className="absolute -right-16 bottom-32 h-56 w-56 rounded-full bg-[#4a90e2]/20 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-40 w-40 rounded-full bg-[#ffd93d]/10 blur-2xl" />
      </div>

      <div className="relative mx-auto mt-4 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-2 inline-flex rotate-[-3deg] items-center gap-2 rounded-full border-4 border-[#ffd93d]/50 bg-gradient-to-r from-[#ffd93d]/30 via-[#ff9ecd]/25 to-[#6bb5ff]/30 px-5 py-2 shadow-[0_6px_0_rgba(184,134,0,0.45)]">
            <Sparkles className="size-7 text-[#ffd93d] drop-shadow" strokeWidth={2.5} />
            <h2 className="font-playful text-2xl font-bold tracking-wide text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)] sm:text-3xl">
              {t('audioSettingsTitle')}
            </h2>
            <Sparkles className="size-7 text-[#6bb5ff] drop-shadow" strokeWidth={2.5} />
          </div>
          <p className="font-playful mt-2 max-w-xs text-sm font-medium text-[#c8c8e8]">{t('audioSettingsHint')}</p>
        </div>

        <div className="mb-6 rounded-[1.75rem] border-4 border-[#ff7b7b]/40 bg-gradient-to-br from-[#ff8f8f]/25 to-[#d94545]/20 p-4 shadow-[0_10px_0_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-4 border-white/35 bg-white/20">
              <VolumeX className="size-8 text-white drop-shadow" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-playful text-lg font-bold text-white sm:text-xl">{t('audioMuteAll')}</p>
              <p className="font-playful text-xs font-medium text-white/80">{t('audioMuteAllHint')}</p>
            </div>
            <AudioKidSwitch
              ariaLabel={t('audioMuteAll')}
              active={prefs.masterMuted}
              variant="danger"
              onClick={() => update({ masterMuted: !prefs.masterMuted })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {rowCard(
            t('audioMapMusic'),
            <MapIcon className="size-8" strokeWidth={2.5} />,
            'bg-gradient-to-br from-[#4a7fd4]/50 to-[#252b55]/90',
            prefs.mapMusicOn,
            () => update({ mapMusicOn: !prefs.mapMusicOn }),
            'mapVol'
          )}
          {rowCard(
            t('audioBattleMusic'),
            <Swords className="size-8" strokeWidth={2.5} />,
            'bg-gradient-to-br from-[#e85d7a]/45 to-[#3d2244]/90',
            prefs.battleMusicOn,
            () => update({ battleMusicOn: !prefs.battleMusicOn }),
            'battleVol'
          )}
          {rowCard(
            t('audioSfx'),
            <Volume2 className="size-8" strokeWidth={2.5} />,
            'bg-gradient-to-br from-[#e6b020]/40 to-[#3d3520]/90',
            prefs.sfxOn,
            () => update({ sfxOn: !prefs.sfxOn }),
            'sfxVol'
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            audio.playSfx('click');
            onBack();
          }}
          className="font-playful mt-8 flex w-full items-center justify-center gap-2 rounded-[1.5rem] border-4 border-[#3570b8] bg-gradient-to-b from-[#7ec0ff] to-[#4a90e2] py-4 text-xl font-bold uppercase tracking-wide text-white shadow-[0_8px_0_#2a5090,0_12px_24px_rgba(74,144,226,0.35)] transition-all active:translate-y-1 active:shadow-[0_4px_0_#2a5090]"
        >
          <ChevronRight className="size-7 rotate-180" strokeWidth={3} />
          {t('back')}
        </button>
      </div>
    </div>
  );
};

const VictoryScreen = ({ coins, onContinue }: { coins: number, onContinue: () => void }) => {
  const { t } = useTranslation();
  useEffect(() => {
    runVictoryCelebration();
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#1E1E2F] relative overflow-visible z-50">
      <VictoryTrumpets />
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,217,61,0.15)_0%,transparent_50%)] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(157,78,221,0.1)_0%,transparent_50%)] pointer-events-none z-0"></div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-8 floating-character">
          <Trophy size={120} className="text-[#FFD93D] drop-shadow-[0_0_30px_rgba(255,217,61,0.6)]" fill="currentColor" />
        </div>
        <h1 className="font-headline font-black text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-[#FFD93D] via-[#FFE066] to-[#FFD93D] drop-shadow-sm -rotate-2 uppercase tracking-tighter mb-2 shimmer-text">{t('victory')}</h1>
        <p className="font-headline font-bold text-[#A0A0BE] uppercase tracking-widest text-sm mb-12">{t('levelCompleted')}</p>

        <div className="w-full max-w-md grid grid-cols-1 gap-4 mb-12">
          <div className="bg-gradient-to-br from-[#2A2A45] to-[#222238] rounded-xl p-4 flex items-center justify-center gap-3 toy-shadow border-2 border-[#FFD93D]/20">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FFD93D]/10 rounded-lg flex items-center justify-center">
              <Maticoin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-[#A0A0BE] font-bold uppercase text-center">{t('received')}</p>
              <p className="font-headline font-extrabold text-2xl text-[#FFD93D] flex items-center gap-2 justify-center">+{coins} <Maticoin className="w-6 h-6" /></p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            audio.playSfx('click');
            onContinue();
          }}
          className="w-full max-w-sm bg-gradient-to-b from-[#FFE066] to-[#FFD93D] rounded-2xl p-1 shadow-[0_8px_0_0_#B88600,0_0_25px_rgba(255,217,61,0.3)] group active:shadow-none active:translate-y-2 transition-all"
        >
          <div className="bg-gradient-to-b from-[#FFE066] to-[#FFD93D] rounded-[1.3rem] py-5 px-4 md:px-8 flex items-center justify-center gap-4">
            <span className="font-headline font-black text-xl md:text-2xl text-[#3D2E00] uppercase tracking-tight">{t('continueAdventure')}</span>
            <ChevronRight className="text-[#3D2E00]" size={28} strokeWidth={3} />
          </div>
        </button>
      </div>
    </div>
  );
};

const AvatarSelectionScreen = ({ user, onSelect }: { user: UserState, onSelect: (id: string) => void }) => {
  const { t } = useTranslation();
  return (
    <div className="flex-1 p-6 pb-32 overflow-y-auto bg-[#1E1E2F]">
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-4xl md:text-6xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-[#C77DFF] to-[#FFD93D] uppercase tracking-tighter -rotate-1 drop-shadow-sm">
          {t('chooseHero')}
        </h1>
        <p className="text-[#A0A0BE] font-bold text-lg">{t('selectAvatarDesc')}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {AVATARS.map(avatar => {
          const isSelected = user.selectedAvatar === avatar.id;
          const isLocked = avatar.unlockLevel && user.currentLevel < avatar.unlockLevel;

          return (
            <button
              key={avatar.id}
              onClick={() => {
                if (isLocked) return;
                audio.playSfx('click');
                onSelect(avatar.id);
              }}
              disabled={isLocked}
              className={cn(
                "group relative flex flex-col items-center p-4 rounded-[2rem] transition-all squish-physics",
                isSelected ? "bg-gradient-to-br from-[#4A90E2]/20 to-[#9D4EDD]/20 ring-2 ring-[#4A90E2] rotate-2 border-[#4A90E2] border-2 shadow-[0_0_20px_rgba(74,144,226,0.3)]" : "bg-gradient-to-b from-[#2A2A45] to-[#222238] border-2 border-white/10 hover:scale-105 hover:border-[#9D4EDD]/30 toy-shadow",
                isLocked ? "opacity-50 grayscale filter hover:scale-100 cursor-not-allowed" : ""
              )}
            >
              {isSelected && <div className="absolute -top-4 -right-2 bg-gradient-to-r from-[#FFD93D] to-[#E6A800] text-[#3D2E00] font-black px-3 py-1 rounded-full text-xs shadow-[0_0_10px_rgba(255,217,61,0.4)] z-10">{t('selected')}</div>}
              {isLocked && (
                <div className="absolute inset-0 bg-[#1E1E2F]/60 rounded-[1.8rem] flex items-center justify-center z-20 backdrop-blur-[1px]">
                  <div className="bg-[#1A1A30] p-3 rounded-full shadow-lg text-[#FF6B6B]">
                    <Lock size={32} />
                  </div>
                  <div className="absolute top-4 bg-gradient-to-r from-[#FF6B6B] to-[#D94545] text-white font-black px-4 py-1 rounded-full text-sm shadow-[0_0_10px_rgba(255,107,107,0.4)] border-2 border-white/20 rotate-12">
                     LVL {avatar.unlockLevel}
                  </div>
                </div>
              )}
              <div className="aspect-square w-full rounded-2xl bg-[#1A1A30] overflow-hidden mb-3 border border-white/5">
                <img src={avatar.image} alt={avatar.name} className="w-full h-full object-cover px-2 pt-2 scale-110 group-hover:scale-125 transition-transform duration-500" />
              </div>
              <span className={cn("font-black font-headline text-lg tracking-tight", isSelected ? "text-[#6BB5FF]" : "text-white")}>
                {avatar.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const RunnerScreen = ({ user, level, tableConstraint, onWin, onLose, onUpdateHistory }: { user: UserState, level: number, tableConstraint?: number, onWin: (coins: number) => void, onLose: () => void, onUpdateHistory: (k: string, c: boolean, solveAtMapLevel: number) => void }) => {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [internalCurrent, setInternalCurrent] = useState(0);
  const winTarget = 15;
  const runnerProgressMult = getAggregatedShopModifiers(user.equippedItems).runnerProgressMult;

  /** Rivales siempre Yelo (monstruo del nivel 1), como en la carrera del minijuego. */
  const monsterRaceImg = `/img/monsters/1-${MONSTER_NAMES[0]}.png`;

  const getTimerBase = () => {
    switch(user.difficulty) {
      case 'HARD': return 2.5; // Runner speed multiplier goes up
      case 'EASY': return 0.8;
      case 'NORMAL':
      default: return 1.5;
    }
  };

  const initProblem = () => {
    setProblem(generateAdaptiveProblem(user, 'RUNNER', tableConstraint, level));
  };

  useEffect(() => {
    initProblem();
  }, [user, tableConstraint, level]);

  const handleGateRef = useRef<(choice: number) => void>(() => {});

  const handleGate = (choice: number) => {
    if(!problem) return;
    const isCorrect = choice === problem.answer;
    const key = `${problem.a}x${problem.b}`;
    onUpdateHistory(key, isCorrect, level);

    if (isCorrect) {
      audio.playSfx('correct');
      setProgress(0);
      const next = internalCurrent + 1;
      setInternalCurrent(next);
      if (next >= winTarget) {
        const baseReward = 100 + Math.floor(level * 8);
        onWin(baseReward);
      } else {
        initProblem();
      }
    } else {
      audio.playSfx('wrong');
      onLose();
    }
  };

  handleGateRef.current = handleGate;

  useEffect(() => {
    if (isPaused || !problem) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleGateRef.current(-1);
          return 0;
        }
        return prev + getTimerBase() * runnerProgressMult;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPaused, problem, runnerProgressMult]);

  if(!problem) return null;

  return (
    <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#1E1E2F] via-[#2A1A3A] to-[#1E1E2F] overflow-y-auto">
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none">
        <Rocket size={400} className="text-[#9D4EDD] animate-pulse" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(157,78,221,0.15)_0%,transparent_60%)] pointer-events-none"></div>

      {isPaused && (
        <div className="absolute inset-0 z-50 bg-[#1E1E2F]/90 backdrop-blur-md flex flex-col items-center justify-center p-6">
          <h2 className="text-5xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-r from-[#C77DFF] to-[#FFD93D] mb-10 drop-shadow-lg tracking-tighter animate-pulse uppercase">{t('pauseTitle')}</h2>
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button onClick={() => setIsPaused(false)} className="bg-gradient-to-b from-[#C77DFF] to-[#9D4EDD] text-white font-black text-2xl py-4 rounded-3xl shadow-[0_8px_0_0_#5A1F8A,0_0_20px_rgba(157,78,221,0.3)] active:translate-y-2 active:shadow-none transition-all uppercase tracking-wider block text-center">
              {t('resume')}
            </button>
            <button onClick={onLose} className="bg-[#2A2A45] text-white font-black text-2xl py-4 rounded-3xl shadow-[0_8px_0_0_#1A1A30] active:translate-y-2 active:shadow-none transition-all uppercase tracking-wider block text-center border-2 border-white/10">
              {t('quitRun')}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col items-center justify-between p-6 pb-24">
        <div className="w-full bg-[#252540]/95 backdrop-blur-xl rounded-[2rem] p-4 md:p-6 shadow-[0_0_30px_rgba(157,78,221,0.2)] -rotate-1 border-2 border-[#9D4EDD]/40">
          <div className="flex justify-between items-center mb-2">
            <span className="font-label font-extrabold text-[10px] text-[#C77DFF] uppercase tracking-widest text-center w-full block">
              {tableConstraint != null ? t('bonusStage', { number: tableConstraint }) : t('bonusRunnerMixed')}
            </span>
          </div>
          <h2 className="font-headline text-5xl md:text-6xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-[#C77DFF] via-white to-[#FFD93D] tracking-tighter drop-shadow-sm">{problem.a} x {problem.b} = ?</h2>
        </div>

        <div className="flex-1 w-full flex flex-col items-center justify-center gap-12 mt-10">
          <div className="flex justify-around w-full max-w-lg gap-4">
            {problem.gates?.map((gate, i) => (
              <button 
                key={i}
                onClick={() => handleGate(gate)}
                className={cn(
                  "w-24 md:w-28 h-32 md:h-36 rounded-t-full border-t-8 border-x-4 border-white/20 flex items-center justify-center transition-all squish-physics z-20 shadow-[0_12px_24px_rgba(0,0,0,0.5)]",
                   "bg-gradient-to-b from-[#C77DFF] to-[#7B2FBB] hover:scale-110 shadow-[0_0_20px_rgba(157,78,221,0.4),0_12px_24px_rgba(0,0,0,0.5)]"
                )}
              >
                <span className="font-headline text-4xl md:text-5xl font-black text-white drop-shadow-sm">{gate}</span>
              </button>
            ))}
          </div>
          
          <div className="relative w-full max-w-lg h-32 md:h-40 z-10 -mt-10 bg-[#1A1A30]/80 backdrop-blur-sm rounded-[2rem] border-2 border-[#9D4EDD]/20 p-2 overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,0.6),0_0_20px_rgba(157,78,221,0.1)] flex flex-col justify-center gap-2">

            {/* Monster Track */}
            <div className="relative w-full h-12 flex items-center border-b border-[#9D4EDD]/10 border-dashed">
               <div className="absolute left-0 transition-all duration-[100ms] ease-linear" style={{ left: `${progress * 0.8}%` }}>
                 <img src={monsterRaceImg} alt="Monster" className="w-12 h-12 object-cover rounded-full border-2 border-[#FF6B6B] rotate-[-10deg] animate-pulse drop-shadow-[0_0_10px_rgba(255,107,107,0.8)]" />
               </div>
            </div>

            {/* Player Track */}
            <div className="relative w-full h-12 flex items-center">
               <div className="absolute left-0 transition-all duration-300 ease-out" style={{ left: `${(internalCurrent / winTarget) * 85}%` }}>
                 <img src={AVATARS.find(a => a.id === user.selectedAvatar)?.image || AVATARS[0].image} alt="Hero" className="w-14 h-14 object-cover rounded-full border-[3px] border-[#4A90E2] rotate-[5deg] z-10 drop-shadow-[0_0_10px_rgba(74,144,226,0.6)]" />
               </div>
            </div>

            {/* Finish Line Indicator */}
            <div className="absolute right-[5%] top-0 bottom-0 w-2 flex flex-col opacity-60">
               {[...Array(8)].map((_, i) => <div key={i} className={cn("w-full h-full", i % 2 === 0 ? "bg-[#FFD93D]" : "bg-[#1A1A30]")} />)}
            </div>

          </div>
        </div>

        <div className="w-full max-w-md space-y-4 relative z-30 bg-[#9D4EDD]/10 backdrop-blur-md p-4 rounded-3xl mt-4 border border-[#9D4EDD]/20">
          <div className="flex justify-between items-center px-2">
            <span className="text-[#C77DFF] font-black text-sm uppercase tracking-widest">{t('warpSpeed')}</span>
            <span className="text-white font-black text-xs">{internalCurrent}/{winTarget}</span>
          </div>
          <div className="relative h-8 w-full bg-[#1A1A30] rounded-full p-1 shadow-inner overflow-hidden border border-white/10">
            <div className="h-full bg-gradient-to-r from-[#9D4EDD] to-[#FFD93D] rounded-full shadow-[0_0_10px_rgba(157,78,221,0.5)] transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsPaused(!isPaused)}
        className="fixed top-20 right-6 z-40 w-12 h-12 bg-[#252540]/90 backdrop-blur-md rounded-full shadow-[0_0_12px_rgba(157,78,221,0.3)] border-2 border-[#9D4EDD]/30 flex items-center justify-center squish-physics"
      >
        {isPaused ? <Play className="text-[#C77DFF]" /> : <Pause className="text-[#C77DFF]" />}
      </button>
    </div>
  );
};

/**
 * Soft accent stripes — each card gets a unique slot at shuffle (no pair hints).
 * Full card surface stays calm; only a left stripe + tiny dot add playful variety.
 */
const TABLES_CARD_ACCENTS = [
  'rgba(244, 168, 198, 0.9)',
  'rgba(125, 211, 252, 0.85)',
  'rgba(196, 181, 253, 0.9)',
  'rgba(253, 224, 171, 0.95)',
  'rgba(167, 243, 208, 0.9)',
  'rgba(251, 191, 207, 0.9)',
  'rgba(165, 211, 255, 0.9)',
  'rgba(254, 215, 170, 0.95)',
  'rgba(186, 230, 253, 0.9)',
  'rgba(233, 213, 255, 0.9)',
  'rgba(153, 231, 196, 0.88)',
  'rgba(252, 211, 232, 0.9)',
  'rgba(147, 197, 253, 0.88)',
  'rgba(254, 249, 195, 0.95)',
  'rgba(209, 250, 229, 0.9)',
  'rgba(251, 207, 232, 0.9)',
  'rgba(165, 243, 252, 0.85)',
  'rgba(216, 180, 254, 0.88)',
  'rgba(253, 230, 138, 0.9)',
  'rgba(190, 242, 100, 0.75)',
] as const;

const TABLES_MATCH_CONFETTI = ['#4A90E2', '#FFD93D', '#6BCB77', '#9D4EDD', '#FF6B9D', '#4ECDC4', '#FFFFFF'] as const;

function shuffleDecorIndices(): number[] {
  const idx = [...Array(TABLES_CARD_ACCENTS.length)].map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function getTableCardIdFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const node = el.closest('[data-table-card-id]');
  return node?.getAttribute('data-table-card-id') ?? null;
}

const TablesMinigame = ({ table, reward, onWin, onBack }: { table: number; reward: number; onWin: (coins: number) => void; onBack: () => void }) => {
  const { t } = useTranslation();
  const [muteUi, setMuteUi] = useState(() => audio.getIsMuted());
  useEffect(() => audio.subscribe(() => setMuteUi(audio.getIsMuted())), []);

  type Card = {
    id: string;
    type: 'op' | 'res';
    value: string;
    numValue: number;
    isMatched: boolean;
    /** Unique decoration slot 0–19; unrelated to the correct math pair */
    decorIndex: number;
  };
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mismatched, setMismatched] = useState<string[]>([]);
  const [won, setWon] = useState(false);
  const [matchPopIds, setMatchPopIds] = useState<string[]>([]);
  const [dragState, setDragState] = useState<null | { id: string; x: number; y: number; label: string }>(null);
  const [dropHover, setDropHover] = useState<string | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const decorPool = shuffleDecorIndices();
    let slot = 0;
    const fullItems: Card[] = [];
    for (let i = 1; i <= 10; i++) {
      fullItems.push({
        id: `op_${i}`,
        type: 'op',
        value: `${table} x ${i}`,
        numValue: table * i,
        isMatched: false,
        decorIndex: decorPool[slot++],
      });
      fullItems.push({
        id: `res_${i}`,
        type: 'res',
        value: `${table * i}`,
        numValue: table * i,
        isMatched: false,
        decorIndex: decorPool[slot++],
      });
    }
    fullItems.sort(() => Math.random() - 0.5);
    setCards(fullItems);
  }, [table]);

  const pairCards = useCallback(
    (id1: string, id2: string) => {
      const c1 = cardsRef.current.find((c) => c.id === id1);
      const c2 = cardsRef.current.find((c) => c.id === id2);
      if (!c1 || !c2 || c1.isMatched || c2.isMatched || id1 === id2) return;

      if (c1.numValue === c2.numValue && c1.type !== c2.type) {
        audio.playSfx('correct');
        launchSafeConfetti({ pieces: 22, originX: 0.5, originY: 0.55 });
        setMatchPopIds([id1, id2]);
        setTimeout(() => {
          setCards((prev) => prev.map((c) => (c.id === id1 || c.id === id2 ? { ...c, isMatched: true } : c)));
          setSelected([]);
          setMismatched([]);
          setMatchPopIds([]);
        }, 560);
      } else {
        audio.playSfx('wrong');
        setMismatched([id1, id2]);
        setTimeout(() => {
          setMismatched([]);
          setSelected([]);
        }, 680);
      }
    },
    []
  );

  const handleTapSelect = (id: string) => {
    const sel = selectedRef.current;
    if (sel.length >= 2) return;
    const c = cardsRef.current.find((x) => x.id === id);
    if (c?.isMatched) return;
    if (sel.length === 1 && sel[0] === id) {
      audio.playSfx('click');
      setSelected([]);
      return;
    }
    audio.playSfx('click');
    if (sel.length === 0) {
      setSelected([id]);
      return;
    }
    const a = sel[0];
    setSelected([a, id]);
    pairCards(a, id);
  };

  const pointerCleanupRef = useRef<(() => void) | null>(null);

  const handleCardPointerDown = (e: React.PointerEvent, id: string) => {
    const c = cardsRef.current.find((x) => x.id === id);
    if (c?.isMatched) return;
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragActive = false;

    const onMove = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist > 14) {
        if (!dragActive) {
          dragActive = true;
          setSelected([]);
          const card = cardsRef.current.find((x) => x.id === id);
          if (card) {
            setDragState({ id, x: ev.clientX, y: ev.clientY, label: card.value });
          }
          document.body.style.touchAction = 'none';
        } else {
          setDragState((prev) => (prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null));
        }
        const under = getTableCardIdFromPoint(ev.clientX, ev.clientY);
        setDropHover(under && under !== id ? under : null);
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.touchAction = '';
      pointerCleanupRef.current = null;
      setDropHover(null);
      setDragState(null);

      if (dragActive) {
        const target = getTableCardIdFromPoint(ev.clientX, ev.clientY);
        if (target && target !== id) pairCards(id, target);
      } else {
        handleTapSelect(id);
      }
    };

    pointerCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.touchAction = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  useEffect(() => {
    return () => {
      pointerCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.isMatched) && !won) {
      setWon(true);
      runVictoryCelebration();
      setTimeout(() => {
        onWin(reward);
        onBack();
      }, 2000);
    }
  }, [cards, won, onWin, onBack, reward]);

  const dragCard = dragState ? cards.find((c) => c.id === dragState.id) : undefined;
  const dragAccent = dragCard ? TABLES_CARD_ACCENTS[dragCard.decorIndex] : TABLES_CARD_ACCENTS[0];

  return (
    <div className="relative flex-1 overflow-y-auto flex flex-col p-4 md:p-6 pb-32 min-h-0 bg-[radial-gradient(ellipse_at_top,#464684_0%,#2f2f4f_42%,#1f1f32_100%)]">
      {won && <VictoryTrumpets className="fixed inset-0 z-[120]" />}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,rgba(130,160,255,0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_80%_100%,rgba(255,200,100,0.06),transparent_50%)]" />
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[#9D4EDD]/15 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-[#4A90E2]/15 blur-3xl" />
        <div className="tables-starfield-layer" />
      </div>

      <div className="relative z-20 flex justify-between items-center mb-4 pt-4">
        <button
          onClick={() => {
            audio.playSfx('click');
            onBack();
          }}
          className="p-3 bg-[#2A2A45]/90 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.25)] hover:bg-[#3A3A58] transition-colors border border-white/15"
        >
          <ChevronRight className="rotate-180 text-[#6BB5FF] border-none" size={28} />
        </button>
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2 bg-[#2A2A45] px-4 py-2 rounded-full border border-white/10 shadow-inner">
            <span className="text-[#A0A0BE] font-black tracking-widest uppercase text-xs sm:text-sm">{t('mission')}</span>
            <h2 className="text-xl sm:text-2xl font-black font-headline text-white">{t('table')} {table}</h2>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1A1A30]/90 border border-[#FFD93D]/35 rounded-full px-3 py-1 shadow-inner">
            <Maticoin className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[#FFD93D] font-black text-sm sm:text-base">+{reward}</span>
          </div>
        </div>
      </div>

      <p className="relative z-10 text-center text-sm md:text-base text-[#d1d1eb] font-semibold mb-4 px-3 py-2 max-w-md mx-auto leading-snug rounded-2xl border border-white/10 bg-[#1f1f36]/60 backdrop-blur-sm">
        {t('tablesMatchHint')}
      </p>

      <div className="relative z-10 flex-1 rounded-3xl p-[2px] bg-gradient-to-br from-[#8b5cf6]/45 via-[#4A90E2]/35 to-[#FFD93D]/30 shadow-[0_12px_36px_rgba(0,0,0,0.25)]">
        <div className="h-full rounded-[calc(1.5rem-2px)] p-3 md:p-5 bg-[#34344d]/95 border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_8px_32px_rgba(0,0,0,0.12)]">
        <div className="grid grid-cols-4 md:grid-cols-5 gap-3 md:gap-3.5">
          {cards.map((c) => {
            const isSel = selected.includes(c.id);
            const isErr = mismatched.includes(c.id);
            const accent = TABLES_CARD_ACCENTS[c.decorIndex];
            const isDragging = dragState?.id === c.id;
            const isDrop = dropHover === c.id && dragState && dragState.id !== c.id;
            const popping = matchPopIds.includes(c.id);
            const selGlow =
              c.type === 'op'
                ? '0 0 0 3px rgba(255,255,255,0.92), 0 0 26px rgba(147,197,253,0.75), 0 0 44px rgba(96,165,250,0.45)'
                : '0 0 0 3px rgba(255,255,255,0.92), 0 0 26px rgba(250,204,21,0.7), 0 0 44px rgba(251,191,36,0.4)';

            return (
              <button
                key={c.id}
                type="button"
                data-table-card-id={c.id}
                disabled={c.isMatched}
                aria-pressed={isSel}
                onPointerDown={(e) => handleCardPointerDown(e, c.id)}
                style={
                  !c.isMatched && !isErr
                    ? {
                        borderLeft: `4px solid ${accent}`,
                        boxShadow: isSel
                          ? `0 4px 0 0 rgba(0,0,0,0.35), ${selGlow}`
                          : '0 4px 0 0 rgba(0,0,0,0.35), 0 2px 12px rgba(0,0,0,0.2)',
                      }
                    : undefined
                }
                className={cn(
                  'relative h-14 md:h-20 lg:h-24 rounded-xl md:rounded-2xl flex flex-col items-center justify-center font-black text-lg md:text-2xl lg:text-3xl transition-[transform,box-shadow] duration-200 border select-none touch-manipulation',
                  c.type === 'op' ? 'border-[#93b4ff]/45' : 'border-[#fde047]/55',
                  !c.isMatched &&
                    c.type === 'op' &&
                    ((!isSel && !popping) || popping) &&
                    !isErr &&
                    'bg-gradient-to-b from-[#556fa3] to-[#384c78]',
                  !c.isMatched && c.type === 'op' && isErr && 'bg-gradient-to-b from-[#556fa3] to-[#384c78]',
                  !c.isMatched &&
                    c.type === 'res' &&
                    ((!isSel && !popping) || popping) &&
                    !isErr &&
                    'bg-gradient-to-b from-[#f4d03f] via-[#d4a017] to-[#a16207]',
                  !c.isMatched && c.type === 'res' && isErr && 'bg-gradient-to-b from-[#f4d03f] via-[#d4a017] to-[#a16207]',
                  c.isMatched && 'opacity-0 scale-50 pointer-events-none',
                  popping && 'tables-match-pop z-20',
                  !c.isMatched && !isErr && !isSel && c.type === 'op' && 'text-[#f4f7ff] tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] hover:brightness-[1.05] hover:-translate-y-0.5 active:scale-[0.98]',
                  !c.isMatched && !isErr && !isSel && c.type === 'res' && 'text-[#292018] tabular-nums drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] hover:brightness-[1.03] hover:-translate-y-0.5 active:scale-[0.98]',
                  (isErr || popping) && 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]',
                  isErr && 'tables-card-wiggle z-30 shadow-[0_4px_0_0_rgba(0,0,0,0.3)]',
                  isSel &&
                    !isErr &&
                    c.type === 'op' &&
                    'z-30 scale-[1.07] ring-[3px] ring-white ring-offset-[3px] ring-offset-[#252536] bg-gradient-to-b from-[#6d8fd0] to-[#4a6499]',
                  isSel &&
                    !isErr &&
                    c.type === 'res' &&
                    'z-30 scale-[1.07] ring-[3px] ring-white ring-offset-[3px] ring-offset-[#252536] bg-gradient-to-b from-[#fde047] via-[#f0b429] to-[#b45309]',
                  isDragging && 'opacity-40 scale-95',
                  isDrop && 'ring-2 ring-[#22c55e] ring-offset-2 ring-offset-[#36364c] scale-[1.03] z-40 shadow-[0_0_18px_rgba(34,197,94,0.4)]'
                )}
              >
                {popping && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[inherit] z-[4] tables-success-green-overlay"
                    aria-hidden
                  />
                )}
                {isErr && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[inherit] z-[4] tables-fail-red-overlay"
                    aria-hidden
                  />
                )}
                {!c.isMatched && !isErr && !popping && (
                  <span
                    className="pointer-events-none absolute top-2 right-2 h-1.5 w-1.5 rounded-full opacity-70 z-[2]"
                    style={{ background: accent }}
                    aria-hidden
                  />
                )}
                {!c.isMatched && !isErr && c.type === 'op' && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.12] z-[1] bg-[radial-gradient(circle_at_45%_0%,rgba(255,255,255,0.55),transparent_55%)]"
                    aria-hidden
                  />
                )}
                {!c.isMatched && !isErr && c.type === 'res' && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.35] z-[1] bg-[radial-gradient(circle_at_38%_10%,rgba(255,250,220,0.75),transparent_58%)]"
                    aria-hidden
                  />
                )}
                <span className="relative z-[6] leading-tight px-1.5 text-center tracking-tight">{c.value}</span>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {dragState && dragCard && (
        <div
          className={cn(
            'fixed z-[1000] pointer-events-none flex items-center justify-center min-w-[4.5rem] min-h-[3.25rem] md:min-w-[6rem] md:min-h-[4.5rem] px-3 rounded-xl md:rounded-2xl font-black text-lg md:text-2xl border shadow-[0_12px_28px_rgba(0,0,0,0.5)]',
            dragCard.type === 'op' && 'text-[#f4f7ff] border-[#93b4ff]/50 bg-gradient-to-b from-[#556fa3] to-[#384c78]',
            dragCard.type === 'res' && 'text-[#292018] border-[#fde047]/60 bg-gradient-to-b from-[#f4d03f] via-[#d4a017] to-[#a16207]'
          )}
          style={{
            left: dragState.x,
            top: dragState.y,
            transform: 'translate(-50%, -50%) rotate(-2deg) scale(1.02)',
            borderLeft: `4px solid ${dragAccent}`,
          }}
        >
          {dragState.label}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          audio.toggleMute();
          audio.playSfx('click');
        }}
        className="fixed bottom-24 right-4 z-[999] w-12 h-12 bg-[#1A1A30]/80 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)] active:scale-90 transition-all text-[#A0A0BE]"
      >
        {muteUi ? <VolumeX size={24} /> : <Volume2 size={24} />}
      </button>
    </div>
  );
};

const TablesScreen = ({ user, onWin }: { user: UserState; onWin: (coins: number) => void }) => {
   const { t } = useTranslation();
   const [activeTable, setActiveTable] = useState<number | null>(null);
   const [isPlaying, setIsPlaying] = useState(false);
   const rewardByTable = useMemo(() => getTableRewards(user), [user.problemHistory]);

   if (activeTable && isPlaying) {
      const tableReward = rewardByTable[activeTable] ?? 10;
      return (
        <TablesMinigame
          table={activeTable}
          reward={tableReward}
          onWin={onWin}
          onBack={() => { setActiveTable(null); setIsPlaying(false); }}
        />
      );
   }

   if (activeTable && !isPlaying) {
      const previewReward = rewardByTable[activeTable] ?? 10;
      return (
         <div className="flex-1 overflow-y-auto flex flex-col p-6 bg-[radial-gradient(ellipse_at_top,#3d3d69_0%,#282844_48%,#1e1e2f_100%)] pb-32 items-center relative">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-16 left-10 w-56 h-56 rounded-full bg-[#9D4EDD]/18 blur-3xl" />
              <div className="absolute bottom-8 right-6 w-64 h-64 rounded-full bg-[#4A90E2]/15 blur-3xl" />
              <div className="tables-starfield-layer" />
            </div>
            <button onClick={() => { audio.playSfx('click'); setActiveTable(null); }} className="relative z-10 self-start p-3 bg-[#2A2A45]/85 rounded-2xl shadow-[0_8px_18px_rgba(0,0,0,0.3)] mb-6 flex items-center gap-2 text-[#9ecbff] font-bold border border-white/15 hover:bg-[#36365a] transition-colors"><ChevronRight className="rotate-180" size={24}/> {t('back')}</button>
            <h2 className="relative z-10 text-3xl md:text-4xl text-center font-headline font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-[#C77DFF] to-[#FFD93D] uppercase mb-4">{t('reviewTable', { number: activeTable })}</h2>
            <div className="relative z-10 mb-6 flex items-center gap-2 bg-[#FFD93D]/15 border-2 border-[#FFD93D]/35 rounded-2xl px-5 py-3 shadow-[0_0_20px_rgba(255,217,61,0.12)]">
               <Maticoin className="w-8 h-8" />
               <span className="text-[#FFD93D] font-black text-lg md:text-xl">{t('tablePrize', { coins: previewReward, defaultValue: `Reward if you win: ${previewReward}` })}</span>
            </div>
            <div className="relative z-10 w-full max-w-sm mb-8 rounded-[2rem] p-[2px] bg-gradient-to-br from-[#4A90E2]/70 via-[#9D4EDD]/70 to-[#FFD93D]/60 shadow-[0_20px_32px_rgba(0,0,0,0.3)]">
              <div className="bg-gradient-to-b from-[#2A2A45] to-[#222238] p-6 rounded-[calc(2rem-2px)] border border-white/10 toy-shadow">
               <ul className="space-y-3 font-black text-2xl text-center text-white">
                  {[...Array(10)].map((_, i) => (
                    <li key={i} className="bg-[#1A1A30] rounded-xl py-2 px-6 flex justify-between border border-white/5 tables-row-glow">
                       <span>{activeTable} x {i+1}</span>
                       <span className="text-[#FFD93D]">=</span>
                       <span className="text-[#6BCB77]">{activeTable * (i+1)}</span>
                    </li>
                  ))}
               </ul>
              </div>
            </div>
            <button onClick={() => { audio.playSfx('click'); setIsPlaying(true); }} className="relative z-10 bg-gradient-to-b from-[#FFE066] via-[#FFD93D] to-[#f6c72e] text-[#3D2E00] font-black text-3xl px-12 py-4 rounded-3xl shadow-[0_8px_0_0_#B88600,0_0_20px_rgba(255,217,61,0.3)] active:translate-y-2 active:shadow-none hover:brightness-110 squish-physics flex items-center gap-3">
               {t('playGame')} <Play fill="currentColor" size={32} />
            </button>
         </div>
      );
   }

   return (
      <div className="flex-1 overflow-y-auto flex flex-col p-6 bg-[radial-gradient(ellipse_at_top,#444479_0%,#2a2a45_45%,#1E1E2F_100%)] pb-32 items-center relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 left-1/3 w-72 h-72 rounded-full bg-[#9D4EDD]/16 blur-3xl" />
          <div className="absolute top-24 -left-16 w-56 h-56 rounded-full bg-[#4A90E2]/15 blur-3xl" />
          <div className="absolute -bottom-10 right-0 w-64 h-64 rounded-full bg-[#FFD93D]/10 blur-3xl" />
          <div className="tables-starfield-layer" />
        </div>
        <h1 className="relative z-10 text-4xl md:text-5xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-[#C77DFF] to-[#FFD93D] uppercase tracking-tighter mb-3 mt-4 drop-shadow-sm text-center">{t('yourTables')}</h1>
        <div className="relative z-10 mb-8 w-full max-w-3xl rounded-3xl border border-white/15 bg-[#23233b]/60 backdrop-blur-md px-5 py-4 text-center shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
          <div className="flex items-center justify-center gap-2 text-[#e8e8ff]">
            <Sparkles size={18} className="text-[#FFD93D]" />
            <span className="font-black tracking-wide">{t('chooseTableTitle', { defaultValue: 'Choose your table and play to win Maticoins' })}</span>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-4xl">
           {[...Array(10)].map((_, i) => {
              const table = 1 + i;
              const prize = rewardByTable[table] ?? 10;

              const colorClasses = [
                 "from-[#5A5A78] to-[#3A3A58] border-[#5A5A78]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3)]",
                 "from-[#6BCB77] to-[#4DA85A] border-[#6BCB77]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(107,203,119,0.3)]",
                 "from-[#FFD93D] to-[#E6A800] border-[#FFD93D]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(255,217,61,0.3)]",
                 "from-[#FF6B6B] to-[#D94545] border-[#FF6B6B]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(255,107,107,0.3)]",
                 "from-[#4A90E2] to-[#3570B8] border-[#4A90E2]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(74,144,226,0.3)]",
                 "from-[#C77DFF] to-[#9D4EDD] border-[#9D4EDD]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(157,78,221,0.3)]",
                 "from-[#6BCB77] to-[#4A90E2] border-[#6BCB77]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(107,203,119,0.3)]",
                 "from-[#4A90E2] to-[#9D4EDD] border-[#4A90E2]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(74,144,226,0.3)]",
                 "from-[#FFD93D] to-[#FF6B6B] border-[#FFD93D]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(255,217,61,0.3)]",
                 "from-[#FF6B6B] to-[#9D4EDD] border-[#FF6B6B]/30 shadow-[0_8px_0_0_rgba(0,0,0,0.3),0_0_15px_rgba(255,107,107,0.3)]",
              ];
              const color = colorClasses[i];

              return (
                 <button key={table} onClick={() => { audio.playSfx('click'); setActiveTable(table); }} className={cn("aspect-[1/1] bg-gradient-to-br rounded-[2.6rem] p-4 flex flex-col items-center justify-center squish-physics border-[3px] group relative overflow-hidden tables-tile-float", color)}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(255,255,255,0.28)_0%,transparent_45%)] pointer-events-none opacity-90 transition-opacity" />
                    <div className="absolute inset-x-5 bottom-3 h-2 rounded-full bg-black/30 blur-md pointer-events-none opacity-70 group-hover:opacity-85 transition-opacity" />
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none">
                      <div className="text-xs md:text-sm px-3 py-1 rounded-full border border-white/25 bg-[#1A1A30]/70 text-white/90 font-black tracking-widest uppercase">
                        {t('table')}
                      </div>
                      <div className="flex items-center gap-1 bg-[#1A1A30]/95 border-2 border-[#FFD93D]/45 rounded-full px-2.5 py-0.5 shadow-lg">
                        <Maticoin className="w-5 h-5 md:w-6 md:h-6" />
                        <span className="text-[#FFD93D] font-black text-xs md:text-sm tabular-nums">+{prize}</span>
                      </div>
                    </div>
                    <span className="text-white font-black text-6xl md:text-7xl font-headline group-hover:scale-125 transition-transform drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)] mt-8 tables-neon-number">{table}</span>
                 </button>
              )
           })}
        </div>
      </div>
   );
}

// --- Main App ---

const NewHeroesOverlay = ({ heroes, onClose }: { heroes: any[], onClose: () => void }) => {
   const { t } = useTranslation();
   useEffect(() => {
     runVictoryCelebration();
   }, []);
   return (
      <div className="fixed inset-0 z-[200] bg-[#1E1E2F]/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
         <VictoryTrumpets className="z-[1]" />
         <h1 className="relative z-10 text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD93D] via-[#C77DFF] to-[#6BB5FF] mb-12 text-center drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] uppercase animate-pulse">{t('newHeroesUnlocked')}</h1>
         <div className="relative z-10 flex flex-wrap justify-center gap-6 mb-12">
            {heroes.map((h, i) => (
               <div key={h.id} className="bg-gradient-to-br from-[#4A90E2] to-[#9D4EDD] p-2 rounded-[2rem] shadow-[0_0_30px_rgba(157,78,221,0.5)] floating-character relative" style={{ animationDelay: `${i * 0.2}s` }}>
                  <img src={h.image} className="w-32 h-32 md:w-48 md:h-48 rounded-[1.5rem] object-cover" />
                  <p className="text-center text-white font-black mt-2 text-xl">{h.name}</p>
               </div>
            ))}
         </div>
         <button onClick={onClose} className="relative z-10 bg-gradient-to-r from-[#FFD93D] to-[#FFE066] text-[#3D2E00] font-black px-10 py-4 rounded-full text-2xl active:scale-95 transition-all shadow-[0_6px_0_0_#B88600,0_0_25px_rgba(255,217,61,0.4)]">{t('continueAdventure')}</button>
      </div>
   );
}

export default function App() {
  const { t } = useTranslation();
  const [splashDone, setSplashDone] = useState(false);
  const [screen, setScreen] = useState<Screen>('MAP');
  const screenRef = useRef<Screen>('MAP');
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  const [activeLevelMap, setActiveLevelMap] = useState(1);
  /** map = batalla desde un nodo; fast = botón batalla rápida / pestaña (no avanza mapa) */
  const [battleContext, setBattleContext] = useState<'map' | 'fast'>('map');
  const [activeTableConstraint, setActiveTableConstraint] = useState<number | undefined>(undefined);
  const [unlockedHeroesTrigger, setUnlockedHeroesTrigger] = useState<string[] | null>(null);
  const [activePvpOpponent, setActivePvpOpponent] = useState<string | null>(null);
  const [activePvpBattleId, setActivePvpBattleId] = useState<string | null>(null);
  const [pendingPvPChallenge, setPendingPvPChallenge] = useState<{ hostId: string; battleId: string } | null>(null);
  const [waitingPvpAccept, setWaitingPvpAccept] = useState<string | null>(null);
  const [activeBattleMode, setActiveBattleMode] = useState<BattleMode>('RPG');
  const [lastVictoryCoins, setLastVictoryCoins] = useState(0);
  const [showLevel100Diploma, setShowLevel100Diploma] = useState(false);
  const [pvpRejectNotice, setPvpRejectNotice] = useState(false);
  /** Tras completar misión diaria con premio: oferta de doblar con anuncio antes de sumar maticoins. */
  const [pendingDailyDouble, setPendingDailyDouble] = useState<
    { baseCoins: number; bonusCoins: number } | null
  >(null);
  const [dailyDoubleBusy, setDailyDoubleBusy] = useState(false);
  const [accountUser, setAccountUser] = useState<FirebaseUser | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const skipAutoAnonymousRef = useRef(false);
  const syncedUidRef = useRef<string | null>(null);
  /** Nivel del mapa del combate/runner activo (ref sincronizada al iniciar; evita claves erróneas en bonusStars). */
  const mapLevelForGameRef = useRef(1);
  const platformClimbRunRef = useRef<{ runKind: 'daily' | 'practice'; dailyBase: number }>({
    runKind: 'daily',
    dailyBase: 0,
  });

  const initialUser: UserState = {
    level: 1,
    currentLevel: 1,
    xp: 0,
    coins: 0,
    energy: 50,
    streak: 0,
    solvedCount: 0,
    selectedAvatar: 'hero1',
    language: 'Spanish',
    difficulty: 'NORMAL',
    unlockedItems: [],
    equippedItems: [],
    itemInventory: {},
    mastery: { 1: 0, 2: 0, 3: 0, 4:0, 5: 0, 6:0, 7: 0, 8: 0, 9:0, 10: 0 },
    dailyMissionRewardedDates: {},
    problemHistory: {},
    levelStars: {},
    bonusStars: {},
    bonusHeroStars: {},
    adsRemoved: false,
    diplomaLevel100Awarded: false,
    authPromptShown: false,
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('previewDiploma') === '1') {
      setShowLevel100Diploma(true);
    }
  }, []);

  // Safe load from LocalStorage
  const [user, setUser] = useState<UserState>(() => {
    try {
      const saved = localStorage.getItem('mathQuestV2');
      if (saved) {
        const parsed = JSON.parse(saved);
        delete (parsed as { dailyMission?: unknown }).dailyMission;
        delete (parsed as { peerId?: unknown }).peerId;
        parsed.unlockedItems = parsed.unlockedItems || [];
        parsed.equippedItems = parsed.equippedItems || [];
        parsed.itemInventory = parsed.itemInventory || {};
        const merged = { ...initialUser, ...parsed } as UserState;
        const inv = { ...(merged.itemInventory || {}) };
        for (const id of merged.unlockedItems || []) {
          if (!inv[id] || inv[id] < 1) inv[id] = 1;
        }
        merged.itemInventory = inv;
        if (merged.selectedAvatar === 'astro_kevin') {
          merged.selectedAvatar = 'hero1';
        }
        merged.bonusStars = normalizeBonusStars(parsed.bonusStars);
        merged.levelStars = normalizeBonusStars(parsed.levelStars);
        merged.bonusHeroStars = normalizeBonusStars(parsed.bonusHeroStars);
        merged.problemHistory = merged.problemHistory || {};
        if (merged.authPromptShown === undefined) {
          merged.authPromptShown = !!merged.hasAcceptedTerms;
        }
        merged.mastery = recomputeAllTableMastery(merged.problemHistory, merged.currentLevel ?? 1);
        return normalizeDailyMissionStorage(merged, new Date());
      }
    } catch (e) {
      console.error("Failed to parse user save", e);
    }
    return normalizeDailyMissionStorage(initialUser, new Date());
  });

  useEffect(() => {
    void getRedirectResult(auth, nativeRedirectResolver).catch(() => {
      /* sin redirect pendiente o flujo cancelado */
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        if (skipAutoAnonymousRef.current) return;
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          setAccountError(err?.message || t('authErrorGuestSignIn'));
        }
        return;
      }
      setAccountUser(u);
      setAccountError(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (screen !== 'AUTH_GATE') return;
    if (!user.hasAcceptedTerms) return;
    if (!user.authPromptShown) return;
    setScreen('MAP');
  }, [screen, user.hasAcceptedTerms, user.authPromptShown]);

  useEffect(() => {
    const uid = accountUser?.uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await get(dbRef(db, `profiles/${uid}`));
        if (cancelled) return;
        const raw = snapshot.val() as (UserState & { peerId?: unknown }) | null;
        if (raw) {
          const { peerId: _legacyPeer, ...remote } = raw;
          setUser((prev) => {
            const gameplay: Screen[] = [
              'BATTLE',
              'RUNNER',
              'MATH_HERO',
              'PLATFORM_CLIMB',
              'PVP_BATTLE',
              'PVP_TUG',
              'PVP_SPRINT',
            ];
            if (gameplay.includes(screenRef.current)) {
              return prev;
            }
            const localTs = prev.updatedAt || 0;
            const remoteTs = remote.updatedAt || 0;
            if (remoteTs < localTs) return prev;
            const normalizedRemote = normalizeDailyMissionStorage(remote, new Date()) as UserState;
            normalizedRemote.problemHistory = normalizedRemote.problemHistory || {};
            normalizedRemote.bonusStars = normalizeBonusStars(normalizedRemote.bonusStars);
            normalizedRemote.levelStars = normalizeBonusStars(normalizedRemote.levelStars);
            normalizedRemote.bonusHeroStars = normalizeBonusStars(normalizedRemote.bonusHeroStars);
            normalizedRemote.mastery = recomputeAllTableMastery(
              normalizedRemote.problemHistory,
              normalizedRemote.currentLevel ?? 1
            );
            return normalizedRemote;
          });
        } else {
          await dbSet(dbRef(db, `profiles/${uid}`), { ...user, updatedAt: Date.now() });
        }
        syncedUidRef.current = uid;
      } catch (err: any) {
        setAccountError(err?.message || t('authErrorCloudSync'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountUser?.uid]);

  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const enriched = { ...user, updatedAt: Date.now() };
    localStorage.setItem('mathQuestV2', JSON.stringify(enriched));

    const uid = accountUser?.uid;
    if (!uid || syncedUidRef.current !== uid) return;

    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);

    const gameplay: Screen[] = [
      'BATTLE', 'RUNNER', 'MATH_HERO', 'PLATFORM_CLIMB',
      'PVP_BATTLE', 'PVP_TUG', 'PVP_SPRINT',
    ];
    const delay = gameplay.includes(screenRef.current) ? 5_000 : 800;

    cloudSaveTimerRef.current = setTimeout(() => {
      const { friends, friendRequestsIncoming, friendRequestsOutgoing, ...profileData } = enriched;
      dbSet(dbRef(db, `profiles/${uid}`), profileData).catch(() => {});
    }, delay);

    return () => {
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    };
  }, [user, accountUser?.uid]);

  useEffect(() => {
    if (!splashDone) return;
    void initRewardedAdsSdk();
  }, [splashDone]);

  // Make sure i18n is synced
  useEffect(() => {
    if(user.language) {
      i18nCore.changeLanguage(user.language);
    }
  }, [user.language]);

  // BGM: batalla (mismo mp3 por mundo que el mapa) / mapa / menú (tienda, perfil, tablas…)
  useEffect(() => {
    if (!splashDone) return;
    const battleScreens: Screen[] = ['BATTLE', 'RUNNER', 'MATH_HERO', 'PLATFORM_CLIMB', 'VICTORY', 'PVP_BATTLE', 'PVP_TUG', 'PVP_SPRINT'];
    const pvpScreens: Screen[] = ['PVP_BATTLE', 'PVP_TUG', 'PVP_SPRINT'];
    if (battleScreens.includes(screen)) {
      const lvl = pvpScreens.includes(screen) ? user.currentLevel : activeLevelMap;
      audio.playBattleBgm(lvl);
    } else if (screen === 'MAP') {
      audio.playMapBgmForLevel(user.currentLevel);
    } else {
      audio.playMenuBgm(user.currentLevel);
    }
  }, [screen, user.currentLevel, activeLevelMap, splashDone]);

  const handleUpdateUser = useCallback((updates: Partial<UserState> | ((prev: UserState) => Partial<UserState>)) => {
    setUser((prev) => {
      const evaluated = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...evaluated };
    });
  }, []);

  const {
    friendCode: multiplayerFriendCode,
    friendCodeStatus,
    connections,
    connectToFriend,
    refreshFriendConnections,
    errorCode: connectionErrorCode,
    isReady,
    kidConnectionHint,
    retryMultiplayerConnection,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelOutgoingFriendRequest,
    removeFriend,
    inviteBattle,
    acceptBattleInvite,
    rejectBattleInvite,
    leavePvpBattle,
  } = useMultiplayer(
    accountUser?.uid,
    user,
    handleUpdateUser,
    (event) => {
      if (event.type === 'INVITE') {
        setPendingPvPChallenge({ hostId: event.hostId, battleId: event.battleId });
        setActiveBattleMode(event.mode);
      } else if (event.type === 'ACCEPT') {
        setWaitingPvpAccept(null);
        setActivePvpOpponent(event.opponentId);
        setActivePvpBattleId(event.battleId);
        setActiveBattleMode(event.mode);
        if (event.mode === 'RPG') setScreen('PVP_BATTLE');
        else if (event.mode === 'TUG') setScreen('PVP_TUG');
        else if (event.mode === 'SPRINT') setScreen('PVP_SPRINT');
      } else if (event.type === 'REJECT') {
        setWaitingPvpAccept(null);
        setPvpRejectNotice(true);
      }
    }
  );

  useEffect(() => {
    if (!pvpRejectNotice) return;
    const timer = window.setTimeout(() => setPvpRejectNotice(false), 4200);
    return () => clearTimeout(timer);
  }, [pvpRejectNotice]);

  const incomingFriendRequestCount = user.friendRequestsIncoming?.length ?? 0;

  const handleAcceptFriendRequest = (fromId: string) => {
    acceptFriendRequest(fromId);
  };

  const handleRejectFriendRequest = (fromId: string) => {
    rejectFriendRequest(fromId);
  };

  const handleCancelOutgoingFriendRequest = (toId: string) => {
    cancelOutgoingFriendRequest(toId);
  };

  const startFastBattle = () => {
    setBattleContext('fast');
    const visualLevel = Math.floor(Math.random() * 100) + 1;
    mapLevelForGameRef.current = visualLevel;
    setActiveLevelMap(visualLevel);
    setActiveTableConstraint(undefined);
    setScreen('BATTLE');
  };

  const openDailyMissionHub = () => {
    setUser((prev) => normalizeDailyMissionStorage(prev, new Date()));
    setScreen('DAILY_MISSION_HUB');
  };

  const startDailyClimbFromHub = () => {
    const now = new Date();
    setUser((prev) => {
      const u = normalizeDailyMissionStorage(prev, now);
      const todayKey = dateKeyLocal(now);
      const mon = getMondayOfWeekLocal(now);
      const rewarded = u.dailyMissionRewardedDates || {};
      const base = rewarded[todayKey] ? 0 : getDailyMissionBaseCoins(mon, todayKey, rewarded);
      platformClimbRunRef.current = { runKind: 'daily', dailyBase: base };
      mapLevelForGameRef.current = u.currentLevel;
      window.setTimeout(() => {
        setActiveLevelMap(u.currentLevel);
        setScreen('PLATFORM_CLIMB');
      }, 0);
      return u;
    });
  };

  const startPracticeClimbFromHub = () => {
    const now = new Date();
    setUser((prev) => {
      const u = normalizeDailyMissionStorage(prev, now);
      platformClimbRunRef.current = { runKind: 'practice', dailyBase: 0 };
      mapLevelForGameRef.current = u.currentLevel;
      window.setTimeout(() => {
        setActiveLevelMap(u.currentLevel);
        setScreen('PLATFORM_CLIMB');
      }, 0);
      return u;
    });
  };

  const finalizeDailyMissionPayout = (adDoubled: boolean) => {
    const pending = pendingDailyDouble;
    if (!pending) return;
    /**
     * El "doble" del anuncio/multiplicación se aplica al premio disponible:
     *  - Si la misión del día aún paga (baseCoins > 0), duplica el premio por la misión.
     *  - Si la misión ya estaba cobrada (baseCoins = 0), duplica las MatiCoins recolectadas,
     *    para que el jugador pueda seguir usando el vídeo bonus aunque ya haya cobrado hoy.
     */
    const missionBase = adDoubled && pending.baseCoins > 0 ? pending.baseCoins * 2 : pending.baseCoins;
    const bonusTotal =
      adDoubled && pending.baseCoins <= 0 ? pending.bonusCoins * 2 : pending.bonusCoins;
    const totalBase = missionBase + bonusTotal;
    const now = new Date();
    const todayKey = dateKeyLocal(now);
    const normalized = normalizeDailyMissionStorage(user, now);
    const mods = DAILY_MISSION_APPLY_SHOP_COIN_BONUS
      ? getAggregatedShopModifiers(normalized.equippedItems)
      : { coinRewardBonusPercent: 0 };
    const finalCoins = Math.max(0, Math.floor(totalBase * (1 + (mods.coinRewardBonusPercent ?? 0) / 100)));
    setUser((prev) => {
      const u = normalizeDailyMissionStorage(prev, now);
      return {
        ...u,
        coins: u.coins + finalCoins,
        energy: u.energy + 10,
        dailyMissionRewardedDates: { ...u.dailyMissionRewardedDates, [todayKey]: true },
      };
    });
    setLastVictoryCoins(finalCoins);
    setPendingDailyDouble(null);
    setScreen('VICTORY');
  };

  const completeRewardGate = async (): Promise<boolean> => {
    if (user.adsRemoved) return askMultiplicationChallenge();
    const r = await showRewarded();
    return r === 'completed';
  };

  const handleBonusAdFromHub = async (): Promise<boolean> => {
    const okGate = await completeRewardGate();
    if (!okGate) return false;
    const now = new Date();
    const todayKey = dateKeyLocal(now);
    let granted = false;
    setUser((prev) => {
      const u = normalizeDailyMissionStorage(prev, now);
      const bonus = u.dailyMissionBonusAds || { dateKey: todayKey, count: 0 };
      const count = bonus.dateKey === todayKey ? bonus.count : 0;
      if (count >= DAILY_BONUS_AD_MAX_PER_DAY) return u;
      const rawCoins = DAILY_BONUS_AD_REWARD_COINS[count];
      const mods = DAILY_MISSION_APPLY_SHOP_COIN_BONUS
        ? getAggregatedShopModifiers(u.equippedItems)
        : { coinRewardBonusPercent: 0 };
      const finalCoins = Math.max(0, Math.floor(rawCoins * (1 + (mods.coinRewardBonusPercent ?? 0) / 100)));
      granted = true;
      return {
        ...u,
        coins: u.coins + finalCoins,
        dailyMissionBonusAds: { dateKey: todayKey, count: count + 1 },
      };
    });
    return granted;
  };

  const handleRunnerDoubleReward = async (): Promise<boolean> => {
    return completeRewardGate();
  };

  /** Stub: sin modal; con Billing real aquí se lanza el flujo de compra y solo entonces se pone adsRemoved. */
  const handleBuyNoAds = () => {
    setUser((prev) => (prev.adsRemoved ? prev : { ...prev, adsRemoved: true }));
  };

  const handlePlatformStructuredComplete = (p: {
    runKind: 'daily' | 'practice';
    baseCoins: number;
    bonusCoins: number;
  }) => {
    if (p.runKind === 'practice') {
      setScreen('DAILY_MISSION_HUB');
      return;
    }
    if (p.baseCoins <= 0 && p.bonusCoins <= 0) {
      setScreen('DAILY_MISSION_HUB');
      return;
    }
    setPendingDailyDouble({ baseCoins: p.baseCoins, bonusCoins: p.bonusCoins });
    setScreen('DAILY_MISSION_HUB');
  };

  /**
   * Game over: al agotar las vidas no se entrega la recompensa base de la misión,
   * pero sí se acreditan las MatiCoins que el jugador hubiera recogido durante la partida.
   */
  const handlePlatformGameOver = (p: { runKind: 'daily' | 'practice'; bonusCoins: number }) => {
    if (p.bonusCoins > 0) {
      setUser((prev) => ({ ...prev, coins: prev.coins + p.bonusCoins }));
    }
    setScreen('DAILY_MISSION_HUB');
  };

  const handleNavigate = (s: Screen) => {
    if (s === 'BATTLE') {
      startFastBattle();
    } else {
      setScreen(s);
    }
  };

  const handleStartLevel = (levelIndex: number, type: 'BATTLE' | 'RUNNER' | 'MATH_HERO', constraint?: number) => {
    if (type === 'BATTLE') {
      setBattleContext('map');
    }
    mapLevelForGameRef.current = levelIndex;
    setActiveLevelMap(levelIndex);
    setActiveTableConstraint(constraint);
    setScreen(type === 'MATH_HERO' ? 'MATH_HERO' : type);
  };

  const handleUpdateHistory = (key: string, isCorrect: boolean, solveAtMapLevel: number) => {
    setUser(prev => {
      const lvl = Math.max(1, Math.min(100, solveAtMapLevel || prev.currentLevel));
      const safeProblemHistory = prev.problemHistory || {};
      const base = safeProblemHistory[key] || { correct: 0, incorrect: 0 };
      const hist = { ...base };
      if (isCorrect) {
        hist.correct++;
        hist.levelSumCorrect = (hist.levelSumCorrect || 0) + lvl;
      } else {
        hist.incorrect++;
      }

      const problemHistory = {
        ...safeProblemHistory,
        [key]: hist,
      };

      return {
        ...prev,
        solvedCount: isCorrect ? prev.solvedCount + 1 : prev.solvedCount,
        mastery: recomputeAllTableMastery(problemHistory, prev.currentLevel),
        problemHistory,
      };
    });
  };

  const handleWin = (rewardBase: number, source: WinSource) => {
    let shouldOpenDiploma = false;
    setUser(prev => {
      const mods = getAggregatedShopModifiers(prev.equippedItems);
      const finalCoins = Math.max(0, Math.floor(rewardBase * (1 + mods.coinRewardBonusPercent / 100)));
      setLastVictoryCoins(finalCoins);

      let next: UserState = {
        ...prev,
        coins: prev.coins + finalCoins,
        energy: prev.energy + 10,
      };

      if (source === 'MAP_BATTLE') {
        const stars: 1 | 2 | 3 = prev.difficulty === 'EASY' ? 1 : prev.difficulty === 'HARD' ? 3 : 2;
        const mapNodeLevel = mapLevelForGameRef.current;
        const prevStars = getStarsForLevel(prev.levelStars, mapNodeLevel);
        const newLevel = activeLevelMap >= prev.currentLevel && prev.currentLevel < 100 ? prev.currentLevel + 1 : prev.currentLevel;
        const reachedLevel100Now = prev.currentLevel < 100 && newLevel >= 100 && !prev.diplomaLevel100Awarded;
        next.currentLevel = newLevel;
        next.levelStars = {
          ...(prev.levelStars || {}),
          [mapNodeLevel]: Math.max(prevStars, stars) as 1 | 2 | 3,
        };
        if (reachedLevel100Now) {
          next.diplomaLevel100Awarded = true;
          shouldOpenDiploma = true;
        }
        if (Math.floor(newLevel / 10) > Math.floor(prev.currentLevel / 10)) {
          const newlyUnlocked = AVATARS.filter(
            (a) => a.unlockLevel && a.unlockLevel <= newLevel && a.unlockLevel > prev.currentLevel
          );
          if (newlyUnlocked.length > 0) {
            setUnlockedHeroesTrigger(newlyUnlocked.map((a) => a.id));
          }
        }
      } else if (source === 'BONUS_RUNNER') {
        const stars: 1 | 2 | 3 = prev.difficulty === 'EASY' ? 1 : prev.difficulty === 'HARD' ? 3 : 2;
        const bonusNodeLevel = mapLevelForGameRef.current;
        next.bonusStars = { ...(prev.bonusStars || {}), [bonusNodeLevel]: stars };
      } else if (source === 'BONUS_MATH_HERO') {
        // Hero Runner: coins-based, no stars
      }

      return next;
    });
    if (shouldOpenDiploma) {
      setShowLevel100Diploma(true);
    }
    setScreen('VICTORY');
  };

  const handleBuy = (item: ShopItem) => {
    if (user.currentLevel < item.unlockLevel) return;
    if (user.coins < item.price) return;
    const isConsumable = item.type === 'POTION' || item.type === 'HERB';
    setUser(prev => {
      const unlocked = prev.unlockedItems || [];
      const inv = { ...(prev.itemInventory || {}) };
      if (isConsumable) {
        inv[item.id] = (inv[item.id] || 0) + 1;
        return {
          ...prev,
          coins: Math.max(0, prev.coins - item.price),
          itemInventory: inv,
          unlockedItems: unlocked.includes(item.id) ? unlocked : [...unlocked, item.id],
        };
      }
      if (unlocked.includes(item.id)) return prev;
      inv[item.id] = Math.max(1, inv[item.id] || 0);
      return {
        ...prev,
        coins: Math.max(0, prev.coins - item.price),
        itemInventory: inv,
        unlockedItems: [...unlocked, item.id],
      };
    });
  };

  const handleEquipToggle = (id: string) => {
    setUser(prev => {
      const eq = prev.equippedItems || [];
      const inv = prev.itemInventory || {};
      const itemToEquip = SHOP_ITEMS.find(i => i.id === id);
      if (!itemToEquip) return prev;
      const ownedQty = inv[id] ?? ((prev.unlockedItems || []).includes(id) ? 1 : 0);
      if (ownedQty <= 0) return prev;
      if (eq.includes(id)) {
        return { ...prev, equippedItems: eq.filter(i => i !== id) };
      } else {
        const newEq = eq.filter((equippedId) => {
          const equippedItem = SHOP_ITEMS.find((i) => i.id === equippedId);
          if (!equippedItem) return true;
          // Consumibles compiten por su tipo entre sí igual que el equipo normal.
          return equippedItem.type !== itemToEquip.type;
        });
        return { ...prev, equippedItems: [...newEq, id] };
      }
    });
  };

  const handleConsumeConsumable = (itemId: string): boolean => {
    let consumed = false;
    setUser(prev => {
      const inv = { ...(prev.itemInventory || {}) };
      const qty = inv[itemId] || 0;
      if (qty <= 0) return prev;
      consumed = true;
      inv[itemId] = qty - 1;
      const nextEquipped = inv[itemId] <= 0 ? (prev.equippedItems || []).filter((id) => id !== itemId) : (prev.equippedItems || []);
      return {
        ...prev,
        itemInventory: inv,
        equippedItems: nextEquipped,
      };
    });
    return consumed;
  };

  const updateUserSettings = (updates: Partial<UserState>) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  const linkGoogleAccount = useCallback(async () => {
    if (!auth.currentUser) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const hadLinkedProvider = auth.currentUser.providerData.some((p) => p.providerId && p.providerId !== 'firebase');
      if (Capacitor.isNativePlatform()) {
        // Flujo nativo: obtener credencial Google vía Play Services y vincular con el usuario actual del SDK Web.
        const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error('Google credential sin idToken');
        const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
        await linkWithCredential(auth.currentUser, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await linkWithPopup(auth.currentUser, provider);
      }
      if (!hadLinkedProvider) {
        setUser((prev) => ({ ...prev, coins: prev.coins + LINK_ACCOUNT_REWARD_COINS }));
      }
    } catch (err: any) {
      setAccountError(err?.message || t('authErrorLinkGoogle'));
    } finally {
      setAccountBusy(false);
    }
  }, []);

  const linkAppleAccount = useCallback(async () => {
    if (!auth.currentUser) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const hadLinkedProvider = auth.currentUser.providerData.some((p) => p.providerId && p.providerId !== 'firebase');
      if (Capacitor.isNativePlatform()) {
        // Flujo nativo: Sign in with Apple (iOS) o fallback web (Android). Vinculamos con el usuario actual.
        const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error('Apple credential sin idToken');
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken,
          rawNonce: (result.credential as unknown as { nonce?: string }).nonce,
        });
        await linkWithCredential(auth.currentUser, credential);
      } else {
        const provider = new OAuthProvider('apple.com');
        await linkWithPopup(auth.currentUser, provider);
      }
      if (!hadLinkedProvider) {
        setUser((prev) => ({ ...prev, coins: prev.coins + LINK_ACCOUNT_REWARD_COINS }));
      }
    } catch (err: any) {
      setAccountError(err?.message || t('authErrorLinkApple'));
    } finally {
      setAccountBusy(false);
    }
  }, []);

  const linkEmailAccount = useCallback(async (email: string, password: string) => {
    if (!auth.currentUser) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const hadLinkedProvider = auth.currentUser.providerData.some((p) => p.providerId && p.providerId !== 'firebase');
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(auth.currentUser, credential);
      if (!hadLinkedProvider) {
        setUser((prev) => ({ ...prev, coins: prev.coins + LINK_ACCOUNT_REWARD_COINS }));
      }
    } catch (err: any) {
      setAccountError(err?.message || t('authErrorLinkEmail'));
    } finally {
      setAccountBusy(false);
    }
  }, []);

  const signInGoogleAccount = useCallback(async () => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        skipAutoAnonymousRef.current = true;
        await current.delete();
      }
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error('Google credential sin idToken');
        const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
        await signInWithCredential(auth, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      setUser((prev) => ({ ...prev, authPromptShown: true }));
      setScreen('MAP');
    } catch (err: any) {
      setAccountError(err?.message || t('authErrorSignInGoogle'));
    } finally {
      skipAutoAnonymousRef.current = false;
      setAccountBusy(false);
    }
  }, []);

  const signInAppleAccount = useCallback(async () => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        skipAutoAnonymousRef.current = true;
        await current.delete();
      }
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error('Apple credential sin idToken');
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken,
          rawNonce: (result.credential as unknown as { nonce?: string }).nonce,
        });
        await signInWithCredential(auth, credential);
      } else {
        const provider = new OAuthProvider('apple.com');
        await signInWithPopup(auth, provider);
      }
      setUser((prev) => ({ ...prev, authPromptShown: true }));
      setScreen('MAP');
    } catch (err: any) {
      setAccountError(err?.message || t('authErrorSignInApple'));
    } finally {
      skipAutoAnonymousRef.current = false;
      setAccountBusy(false);
    }
  }, []);

  const signInEmailAccount = useCallback(async (email: string, password: string) => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        const credential = EmailAuthProvider.credential(email, password);
        try {
          await linkWithCredential(current, credential);
          setUser((prev) => ({ ...prev, authPromptShown: true }));
          setScreen('MAP');
          return;
        } catch (linkErr: any) {
          // Si el email ya existe, hacemos login normal con esa cuenta.
          // Mantiene comportamiento esperado para usuarios ya registrados.
          if (String(linkErr?.code || '').includes('email-already-in-use')) {
            skipAutoAnonymousRef.current = true;
            await current.delete();
          } else {
            throw linkErr;
          }
        }
      }
      await signInWithEmailAndPassword(auth, email, password);
      setUser((prev) => ({ ...prev, authPromptShown: true }));
      setScreen('MAP');
    } catch (err: any) {
      setAccountError(err?.message || t('authErrorSignInEmail'));
    } finally {
      skipAutoAnonymousRef.current = false;
      setAccountBusy(false);
    }
  }, []);

  const signOutAccount = useCallback(async () => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await FirebaseAuthentication.signOut();
        } catch {
          /* capa nativa ya sin sesión */
        }
      }
      await signOut(auth);
    } catch (err: any) {
      setAccountError(err?.message || t('authErrorSignOut'));
    } finally {
      setAccountBusy(false);
    }
  }, [t]);

  const resetProgressEverywhere = useCallback(async () => {
    try {
      if (accountUser?.uid) {
        await dbRemove(dbRef(db, `profiles/${accountUser.uid}`));
      }
    } catch {
      /* ignore cloud cleanup errors on reset */
    }
    localStorage.removeItem('mathQuestV2');
    window.location.reload();
  }, [accountUser?.uid]);

  if (!splashDone) {
    return <WelcomeSplash onComplete={() => setSplashDone(true)} />;
  }

  if (user.hasAcceptedTerms === undefined || user.hasAcceptedTerms === false) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-[#1E1E2F]">
        <OnboardingScreen 
          user={user} 
          onComplete={(playerName) => {
            const updated = { ...user, hasAcceptedTerms: true, playerName, authPromptShown: false };
            setUser(updated);
            localStorage.setItem('mathQuestV2', JSON.stringify(updated));
            setScreen('AUTH_GATE');
          }} 
        />
      </div>
    );
  }

  if (screen === 'AUTH_GATE') {
    return (
      <AuthGateScreen
        accountBusy={accountBusy}
        accountError={accountError}
        onSignInGoogle={signInGoogleAccount}
        onSignInApple={signInAppleAccount}
        onSignInEmail={signInEmailAccount}
        onContinueGuest={() => {
          setUser((prev) => ({ ...prev, authPromptShown: true }));
          setScreen('MAP');
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        'h-screen flex flex-col bg-[#1E1E2F]',
        screen === 'VICTORY' ||
          screen === 'PVP_BATTLE' ||
          screen === 'PVP_TUG' ||
          screen === 'PVP_SPRINT'
          ? 'overflow-visible'
          : 'overflow-hidden'
      )}
    >
      {screen !== 'RUNNER' && screen !== 'MATH_HERO' && screen !== 'BATTLE' && screen !== 'PLATFORM_CLIMB' && screen !== 'VICTORY' && screen !== 'SETTINGS' && screen !== 'AUDIO_SETTINGS' && screen !== 'PVP_BATTLE' && screen !== 'PVP_TUG' && screen !== 'PVP_SPRINT' && (
        <TopBar
          user={user}
          onLanguage={() => {
            audio.playSfx('click');
            setScreen('SETTINGS');
          }}
          onAudioSettings={() => {
            audio.playSfx('click');
            setScreen('AUDIO_SETTINGS');
          }}
          onSavePlayerName={(name) => {
            setUser((prev) => ({ ...prev, playerName: name }));
          }}
        />
      )}
      
      <main
        className={cn(
          'flex-1 flex flex-col relative',
          screen === 'VICTORY' ||
            screen === 'PVP_BATTLE' ||
            screen === 'PVP_TUG' ||
            screen === 'PVP_SPRINT'
            ? 'overflow-visible'
            : 'overflow-hidden',
          screen !== 'RUNNER' && screen !== 'MATH_HERO' && screen !== 'BATTLE' && screen !== 'PLATFORM_CLIMB' && screen !== 'VICTORY' && screen !== 'SETTINGS' && screen !== 'AUDIO_SETTINGS'
            ? 'pt-16'
            : ''
        )}
      >
        {screen === 'MAP' && (
          <MapScreen
            user={user}
            onStartLevel={handleStartLevel}
            onFastBattle={startFastBattle}
            onOpenDailyMissionHub={openDailyMissionHub}
            onOpenInventory={() => setScreen('INVENTORY')}
            onBuyNoAds={handleBuyNoAds}
          />
        )}
        {screen === 'DAILY_MISSION_HUB' && (
          <DailyMissionHubScreen
            user={user}
            onBack={() => {
              audio.playSfx('click');
              setScreen('MAP');
            }}
            onPlayDaily={() => {
              audio.playSfx('click');
              startDailyClimbFromHub();
            }}
            onPractice={() => {
              audio.playSfx('click');
              startPracticeClimbFromHub();
            }}
            onWatchBonusAd={handleBonusAdFromHub}
            adsRemoved={!!user.adsRemoved}
          />
        )}
        {screen === 'BATTLE' && (
          <BattleScreen
            level={activeLevelMap}
            battleContext={battleContext}
            user={user}
            onWin={(c) => handleWin(c, battleContext === 'fast' ? 'FAST_BATTLE' : 'MAP_BATTLE')}
            onLose={() => setScreen('MAP')}
            onUpdateHistory={handleUpdateHistory}
            onConsumeConsumable={handleConsumeConsumable}
          />
        )}
        {screen === 'TABLES' && <TablesScreen user={user} onWin={(c) => handleWin(c, 'TABLES')} />}
        {screen === 'SHOP' && (
          <ShopScreen
            user={user}
            onBuy={handleBuy}
            onOpenInventory={() => setScreen('INVENTORY')}
            onBuyNoAds={handleBuyNoAds}
            onClaimDailyBonusCoins={handleBonusAdFromHub}
          />
        )}
        {screen === 'INVENTORY' && <InventoryScreen user={user} onBack={() => setScreen('MAP')} onEquip={handleEquipToggle} />}
        {screen === 'PROFILE' && (
          <ProfileScreen
            user={user}
            onSelectAvatar={() => setScreen('AVATAR_SELECTION')}
            onUpdateSettings={updateUserSettings}
            accountUser={accountUser}
            accountBusy={accountBusy}
            accountError={accountError}
            onLinkGoogle={linkGoogleAccount}
            onLinkApple={linkAppleAccount}
            onLinkEmail={linkEmailAccount}
            onSignInGoogle={signInGoogleAccount}
            onSignInApple={signInAppleAccount}
            onSignInEmail={signInEmailAccount}
            onSignOut={signOutAccount}
            onResetProgress={resetProgressEverywhere}
          />
        )}
        {screen === 'SETTINGS' && <SettingsScreen user={user} onUpdate={updateUserSettings} onBack={() => setScreen('MAP')} />}
        {screen === 'AUDIO_SETTINGS' && <AudioSettingsScreen onBack={() => setScreen('MAP')} />}
        {screen === 'AVATAR_SELECTION' && <AvatarSelectionScreen user={user} onSelect={(id) => { updateUserSettings({ selectedAvatar: id }); setScreen('PROFILE'); }} />}
        {screen === 'RUNNER' && (
          <RunnerScreen
            level={activeLevelMap}
            tableConstraint={activeTableConstraint}
            user={user}
            onWin={(c) => handleWin(c, 'BONUS_RUNNER')}
            onLose={() => setScreen('MAP')}
            onUpdateHistory={handleUpdateHistory}
          />
        )}
        {screen === 'MATH_HERO' && (
          <MathHeroScreen
            user={user}
            mapLevel={activeLevelMap}
            onWin={(c) => handleWin(c, 'BONUS_MATH_HERO')}
            onLose={() => setScreen('MAP')}
            onUpdateHistory={handleUpdateHistory}
            onSaveScore={(level, score) => {
              setUser(prev => {
                const existing = prev.heroRunnerScores?.[level] ?? [];
                const updated = [...existing, score].sort((a, b) => b - a).slice(0, 5);
                return { ...prev, heroRunnerScores: { ...(prev.heroRunnerScores || {}), [level]: updated } };
              });
            }}
            onRequestDoubleReward={handleRunnerDoubleReward}
            adsRemoved={!!user.adsRemoved}
          />
        )}
        {screen === 'PLATFORM_CLIMB' && (
          <PlatformClimbScreen
            user={user}
            mapLevel={user.currentLevel}
            runKind={platformClimbRunRef.current.runKind}
            dailyBaseCoinsOnWin={platformClimbRunRef.current.dailyBase}
            onStructuredComplete={handlePlatformStructuredComplete}
            onGameOver={handlePlatformGameOver}
            onExit={() => {
              audio.playSfx('click');
              setScreen('DAILY_MISSION_HUB');
            }}
            onUpdateHistory={handleUpdateHistory}
          />
        )}
        {screen === 'VICTORY' && <VictoryScreen coins={lastVictoryCoins} onContinue={() => setScreen('MAP')} />}
        {screen === 'MULTIPLAYER' && (
          <MultiplayerScreen
            user={user}
            myFriendCode={multiplayerFriendCode}
            friendCodeStatus={friendCodeStatus}
            connections={connections}
            connectToFriend={connectToFriend}
            onRefreshConnections={refreshFriendConnections}
            onRetryConnection={retryMultiplayerConnection}
            kidConnectionHint={kidConnectionHint}
            errorCode={connectionErrorCode}
            isReady={isReady}
            waitingAccept={waitingPvpAccept}
            onRemoveFriend={(fid) => {
              removeFriend(fid);
            }}
            onAcceptFriendRequest={handleAcceptFriendRequest}
            onRejectFriendRequest={handleRejectFriendRequest}
            onCancelOutgoingFriendRequest={handleCancelOutgoingFriendRequest}
            onBattleFriend={async (fid, mode) => {
              setWaitingPvpAccept(fid);
              const battleId = await inviteBattle(fid, mode);
              if (!battleId) setWaitingPvpAccept(null);
            }}
          />
        )}
        {screen === 'PVP_BATTLE' && (
           <PvpBattleScreen
             user={user}
             uid={accountUser?.uid ?? ''}
             opponentId={activePvpOpponent}
             battleId={activePvpBattleId}
             onQuit={() => {
               void leavePvpBattle(activePvpBattleId);
               setActivePvpBattleId(null);
               setActivePvpOpponent(null);
               setScreen('MULTIPLAYER');
             }}
           />
        )}
        {screen === 'PVP_TUG' && (
           <PvpTugWarScreen
             user={user}
             uid={accountUser?.uid ?? ''}
             opponentId={activePvpOpponent}
             battleId={activePvpBattleId}
             onQuit={() => {
               void leavePvpBattle(activePvpBattleId);
               setActivePvpBattleId(null);
               setActivePvpOpponent(null);
               setScreen('MULTIPLAYER');
             }}
           />
        )}
        {screen === 'PVP_SPRINT' && (
           <PvpSprintScreen
             user={user}
             uid={accountUser?.uid ?? ''}
             opponentId={activePvpOpponent}
             battleId={activePvpBattleId}
             onQuit={() => {
               void leavePvpBattle(activePvpBattleId);
               setActivePvpBattleId(null);
               setActivePvpOpponent(null);
               setScreen('MULTIPLAYER');
             }}
           />
        )}
      </main>

      {/* Bottom Navigation */}
      {screen !== 'RUNNER' &&
        screen !== 'MATH_HERO' &&
        screen !== 'BATTLE' &&
        screen !== 'PLATFORM_CLIMB' &&
        screen !== 'DAILY_MISSION_HUB' &&
        screen !== 'VICTORY' &&
        screen !== 'SETTINGS' &&
        screen !== 'AUDIO_SETTINGS' &&
        screen !== 'PVP_BATTLE' &&
        screen !== 'PVP_TUG' &&
        screen !== 'PVP_SPRINT' && (
        <BottomBar currentScreen={screen} onNavigate={handleNavigate} multiplayerBadgeCount={incomingFriendRequestCount} />
      )}

      {pendingDailyDouble && screen === 'DAILY_MISSION_HUB' && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#FFD93D]/30 bg-[#252540] p-6 shadow-2xl">
            <h2 className="text-center font-headline text-2xl font-black uppercase text-white">{t('dailyDoubleTitle')}</h2>
            <p className="mt-3 text-center text-base text-[#A0A0BE]">
              {t('dailyDoubleBody', { coins: pendingDailyDouble.baseCoins + pendingDailyDouble.bonusCoins })}
            </p>

            {/* Desglose: recompensa por la misión vs MatiCoins recolectadas */}
            <div className="mt-4 rounded-2xl border border-[#FFD93D]/30 bg-[#1A1A30]/80 p-3 text-[#D4D4F5]">
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
                  {t('dailyRewardSplit', { defaultValue: 'Premio por la misión' })}
                </span>
                <span className="font-headline text-base font-black tabular-nums text-amber-300">
                  {pendingDailyDouble.baseCoins}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="relative inline-flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 text-[10px] font-black text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">M</span>
                  {t('dailyRewardBonusCoins', { defaultValue: 'MatiCoins recolectadas' })}
                </span>
                <span className="font-headline text-base font-black tabular-nums text-amber-300">
                  {pendingDailyDouble.bonusCoins}
                </span>
              </div>
              <div className="mt-1 h-px w-full bg-white/10" />
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs font-black uppercase tracking-wider text-white/80">
                  {t('dailyRewardTotal', { defaultValue: 'Total' })}
                </span>
                <span className="font-headline text-xl font-black tabular-nums text-amber-200 drop-shadow">
                  {pendingDailyDouble.baseCoins + pendingDailyDouble.bonusCoins}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={
                  dailyDoubleBusy ||
                  pendingDailyDouble.baseCoins + pendingDailyDouble.bonusCoins <= 0
                }
                onClick={async () => {
                  audio.playSfx('click');
                  setDailyDoubleBusy(true);
                  try {
                    const ok = await completeRewardGate();
                    finalizeDailyMissionPayout(ok);
                  } finally {
                    setDailyDoubleBusy(false);
                  }
                }}
                className="rounded-2xl bg-gradient-to-b from-[#FFD93D] to-[#E6A800] py-4 font-headline text-lg font-black uppercase text-[#3D2E00] shadow-[0_8px_0_#B88600] disabled:opacity-50"
              >
                {dailyDoubleBusy
                  ? '…'
                  : user.adsRemoved
                    ? t('solveMultiplicationToDouble', { defaultValue: 'Resolver multiplicación para doblar' })
                    : t('dailyDoubleWatch')}
              </button>
              <button
                type="button"
                disabled={dailyDoubleBusy}
                onClick={() => {
                  audio.playSfx('click');
                  finalizeDailyMissionPayout(false);
                }}
                className="rounded-2xl border-2 border-white/20 py-3.5 font-bold text-[#A0A0BE]"
              >
                {t('dailyDoubleSkip')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showLevel100Diploma && (
        <MultiplicationHeroDiplomaModal
          initialName={user.playerName}
          onClose={() => setShowLevel100Diploma(false)}
        />
      )}

      {pvpRejectNotice && (
        <div className="fixed bottom-28 left-1/2 z-[180] -translate-x-1/2 max-w-sm w-[calc(100%-2rem)] px-4 py-3 rounded-2xl bg-[#1A1A30] border-2 border-[#FF6B6B]/50 text-white text-center font-bold text-sm shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {t('multiplayer.rejectedDuelBanner')}
        </div>
      )}

      {unlockedHeroesTrigger && (
         <NewHeroesOverlay 
            heroes={unlockedHeroesTrigger.map(id => AVATARS.find(a => a.id === id)).filter(Boolean)} 
            onClose={() => setUnlockedHeroesTrigger(null)} 
         />
      )}

      {/* PVP Challenge Overlay */}
      {pendingPvPChallenge && (() => {
         const challenger = user.friends?.find(f => f.id === pendingPvPChallenge.hostId);
         const avatarSrc = AVATARS.find(a => a.id === challenger?.avatar)?.image || AVATARS[0].image;
         const modeLabel = activeBattleMode === 'RPG' ? t('multiplayer.modes.rpg') : activeBattleMode === 'TUG' ? t('multiplayer.modes.tug') : t('multiplayer.modes.sprint');
         
         return (
         <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1A1A30] rounded-[2rem] p-8 max-w-md w-full border-2 border-[#FF6B6B] shadow-[0_0_40px_rgba(255,107,107,0.3)] text-center relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-t from-[#FF6B6B]/10 to-transparent pointer-events-none"></div>
               
               <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 bg-[#FF6B6B] animate-ping rounded-full opacity-30"></div>
                  <img src={avatarSrc} className="w-24 h-24 object-cover rounded-full border-4 border-[#FF6B6B] shadow-[0_0_20px_rgba(255,107,107,0.6)] relative z-10" />
                  <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-[#1A1A30] rounded-full border-2 border-[#FF6B6B] flex items-center justify-center z-20 shadow-md">
                     <Swords size={20} className="text-[#FF6B6B]" />
                  </div>
               </div>

               <h2 className="text-3xl font-black text-white font-headline tracking-widest mb-1">{t('multiplayer.pvpDuel')}</h2>
               <div className="bg-[#FF6B6B]/20 border border-[#FF6B6B]/40 px-3 py-1 rounded-md inline-block mb-4">
                  <span className="text-[#FFD93D] font-black text-xs uppercase tracking-widest">{modeLabel}</span>
               </div>
               
               <p className="text-[#A0A0BE] font-bold mb-8">
                 <span className="text-[#6BB5FF] text-lg">{challenger?.name || t('multiplayer.anAlly')}</span> {t('multiplayer.callingBattle')}
               </p>
               <div className="flex gap-4">
                  <button 
                     onClick={async () => {
                        await rejectBattleInvite(pendingPvPChallenge.battleId);
                        setPendingPvPChallenge(null);
                     }}
                     className="flex-1 bg-white/5 border border-white/10 py-3 rounded-xl text-white font-bold hover:bg-white/10 active:scale-95 transition-all"
                  >
                     {t('multiplayer.decline')}
                  </button>
                  <button 
                     onClick={async () => {
                        await acceptBattleInvite(pendingPvPChallenge.battleId);
                        setActivePvpOpponent(pendingPvPChallenge.hostId);
                        setActivePvpBattleId(pendingPvPChallenge.battleId);
                        setPendingPvPChallenge(null);
                        
                        if (activeBattleMode === 'RPG') setScreen('PVP_BATTLE');
                        else if (activeBattleMode === 'TUG') setScreen('PVP_TUG');
                        else if (activeBattleMode === 'SPRINT') setScreen('PVP_SPRINT');
                     }}
                     className="flex-1 bg-gradient-to-t from-[#FF6B6B] to-[#D94545] py-3 rounded-xl text-white font-black hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_0_0_#A03030]"
                  >
                     {t('multiplayer.accept')}
                  </button>
               </div>
            </div>
         </div>
      );})()}
    </div>
  );
}
