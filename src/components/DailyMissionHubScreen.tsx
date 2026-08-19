import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, CalendarDays, Coins, Gamepad2, Sparkles, Star, Tv } from 'lucide-react';
import { audio } from '../lib/audio';
import { cn } from '../lib/utils';
import type { UserState } from '../types';
import {
  DAILY_BONUS_AD_MAX_PER_DAY,
  DAILY_BONUS_AD_REWARD_COINS,
  dateKeyLocal,
  getMondayOfWeekLocal,
  listWeekDayKeysFromMonday,
  getDailyMissionBaseCoins,
  isBonusAdCapReached,
} from '../lib/dailyMissionWeek';

type Props = {
  user: UserState;
  onBack: () => void;
  onPlayDaily: () => void;
  onPractice: () => void;
  onWatchBonusAd: () => Promise<boolean>;
  adsRemoved: boolean;
};

const DAY_INDEX_KEYS = [
  'dailyMissionDayMon',
  'dailyMissionDayTue',
  'dailyMissionDayWed',
  'dailyMissionDayThu',
  'dailyMissionDayFri',
  'dailyMissionDaySat',
  'dailyMissionDaySun',
] as const;

/** Tarjetas semana tipo “caramelos” para niños 8–10 */
const DAY_CANDY_STYLES = [
  'from-fuchsia-400/50 via-pink-400/35 to-rose-500/30 border-fuchsia-300/55',
  'from-sky-400/50 via-cyan-300/35 to-blue-500/30 border-sky-300/55',
  'from-lime-400/45 via-emerald-300/35 to-teal-500/30 border-lime-300/50',
  'from-amber-300/55 via-yellow-300/40 to-orange-400/35 border-amber-200/60',
  'from-violet-400/50 via-purple-400/35 to-indigo-500/30 border-violet-300/55',
  'from-orange-400/50 via-amber-400/35 to-red-400/25 border-orange-300/55',
  'from-teal-400/50 via-emerald-400/35 to-cyan-500/30 border-teal-300/55',
] as const;

export function DailyMissionHubScreen({ user, onBack, onPlayDaily, onPractice, onWatchBonusAd, adsRemoved }: Props) {
  const { t } = useTranslation();
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);

  const now = new Date();
  const monday = getMondayOfWeekLocal(now);
  const weekKeys = listWeekDayKeysFromMonday(monday);
  const todayKey = dateKeyLocal(now);
  const rewarded = user.dailyMissionRewardedDates || {};
  const bonus = user.dailyMissionBonusAds;
  const bonusCount = bonus?.dateKey === todayKey ? bonus.count : 0;
  const bonusCap = isBonusAdCapReached(bonusCount);
  const nextBonusBase =
    bonusCount >= DAILY_BONUS_AD_MAX_PER_DAY
      ? null
      : DAILY_BONUS_AD_REWARD_COINS[Math.min(bonusCount, DAILY_BONUS_AD_REWARD_COINS.length - 1)];
  const todayAlreadyRewarded = !!rewarded[todayKey];
  const nextDailyBase = getDailyMissionBaseCoins(monday, todayKey, rewarded);

  const handleBonusWatch = async (): Promise<boolean> => {
    if (bonusBusy || bonusCap) return false;
    setBonusBusy(true);
    try {
      return await onWatchBonusAd();
    } finally {
      setBonusBusy(false);
    }
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-gradient-to-b from-[#2d1f4e] via-[#1E1E2F] to-[#162238] px-5 pb-36 pt-6 sm:px-7 sm:pb-40 sm:pt-8">
      {/* Capa decorativa */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#FFD93D]/25 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-[#9D4EDD]/30 blur-3xl" />
        <div className="absolute bottom-20 left-1/4 h-56 w-56 rounded-full bg-[#4A90E2]/25 blur-3xl" />
        <div className="absolute right-8 top-32 text-[#FFD93D]/40">
          <Star className="size-10 fill-[#FFD93D]/50" strokeWidth={0} />
        </div>
        <div className="absolute left-10 top-48 text-[#C77DFF]/35">
          <Sparkles className="size-8" />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col gap-8 sm:max-w-xl sm:gap-10">
        {/* Cabecera: vertical, centrada; un solo “missió diària” en el cartel grande */}
        <header className="relative w-full px-1">
          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              onBack();
            }}
            className="absolute left-0 top-1 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border-4 border-white/25 bg-gradient-to-br from-[#4A90E2] to-[#3570B8] shadow-[0_5px_0_0_#2A5090] transition active:translate-y-0.5 active:shadow-none sm:h-14 sm:w-14"
            aria-label={t('back')}
          >
            <ChevronLeft className="text-white" size={26} strokeWidth={2.5} />
          </button>
          <div className="mx-auto flex w-full max-w-sm flex-col items-center px-2 pt-1 text-center sm:max-w-md">
            <div className="mt-1 inline-flex rotate-[-1deg] flex-col items-center gap-3 rounded-[1.75rem] border-4 border-[#FFE566]/90 bg-gradient-to-b from-[#3d2d5c]/95 via-[#2a1f45] to-[#1a1528] px-7 py-5 shadow-[0_10px_0_0_rgba(0,0,0,0.35),0_0_40px_rgba(255,217,61,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] sm:px-10 sm:py-7">
              <CalendarDays
                className="size-16 shrink-0 text-[#FFD93D] drop-shadow-[0_2px_8px_rgba(255,217,61,0.55)] sm:size-20"
                strokeWidth={2.25}
              />
              <span className="font-headline max-w-[16rem] bg-gradient-to-b from-[#FFF9C4] via-[#FFD93D] to-[#E6A800] bg-clip-text text-2xl font-black uppercase leading-tight tracking-wide text-transparent drop-shadow-[0_2px_0_rgba(0,0,0,0.45)] sm:max-w-none sm:text-3xl">
                {t('dailyMission')}
              </span>
            </div>
            <p className="mt-6 max-w-md px-2 text-base font-semibold leading-relaxed text-white/92 sm:text-lg">
              {t('dailyMissionHubSubtitle')}
            </p>
          </div>
        </header>

        {/* Calendario semanal */}
        <section className="rounded-[1.75rem] border-4 border-white/20 bg-gradient-to-br from-[#3d3570]/90 via-[#2A2A55]/95 to-[#252045]/95 p-5 shadow-[0_12px_0_0_rgba(0,0,0,0.2),0_0_40px_rgba(157,78,221,0.25)] sm:p-7">
          <div className="mb-5 flex items-center justify-center gap-2">
            <Sparkles className="size-6 text-[#FFD93D]" />
            <p className="font-headline text-center text-lg font-black uppercase tracking-wide text-white drop-shadow-sm">
              {t('dailyMissionWeekLabel')}
            </p>
            <Sparkles className="size-6 text-[#C77DFF]" />
          </div>
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {weekKeys.map((key, i) => {
              const isToday = key === todayKey;
              const done = !!rewarded[key];
              const candy = DAY_CANDY_STYLES[i % DAY_CANDY_STYLES.length];
              return (
                <div
                  key={key}
                  className={cn(
                    'flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border-4 bg-gradient-to-b px-0.5 py-3 text-center shadow-inner transition-transform sm:min-h-[6.25rem] sm:py-4',
                    candy,
                    isToday && 'ring-4 ring-[#6BB5FF] ring-offset-2 ring-offset-[#1E1E2F] scale-[1.02] shadow-[0_0_20px_rgba(107,181,255,0.5)]',
                    done && !isToday && 'ring-2 ring-emerald-400/70'
                  )}
                >
                  <span className="text-[10px] font-black uppercase leading-tight text-white/90 drop-shadow-sm sm:text-xs">
                    {t(DAY_INDEX_KEYS[i])}
                  </span>
                  <span className="mt-1.5 font-headline text-lg font-black tabular-nums text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.2)] sm:text-xl">
                    {key.slice(8, 10)}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-black text-[#FFE58A] sm:text-[11px]">
                    <Coins className="size-3" strokeWidth={2.3} />
                    {getDailyMissionBaseCoins(monday, key, rewarded)}
                  </span>
                  {done ? (
                    <span className="mt-1.5 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-white sm:text-[10px]">
                      {t('dailyMissionCompleted')}
                    </span>
                  ) : isToday ? (
                    <span className="mt-1.5 rounded-full bg-[#4A90E2] px-1.5 py-0.5 text-[9px] font-black uppercase text-white sm:text-[10px]">
                      {t('dailyMissionToday')}
                    </span>
                  ) : (
                    <span className="mt-1 text-[10px] font-bold text-white/50">·</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-6 rounded-2xl border-2 border-white/10 bg-[#1A1A30]/50 px-4 py-3 text-center text-sm font-semibold leading-snug text-white/85">
            {t('dailyMissionStreakExplain')}
          </p>
        </section>

        {/* Acciones */}
        <section className="flex flex-col gap-5 sm:gap-6">
          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              onPlayDaily();
            }}
            className="group flex w-full items-center justify-center gap-4 rounded-[1.5rem] border-4 border-[#FFF3A0]/80 bg-gradient-to-b from-[#FFF4B8] via-[#FFD93D] to-[#E6A800] py-5 pl-4 pr-5 font-headline text-xl font-black uppercase tracking-wide text-[#4a3200] shadow-[0_10px_0_0_#B88600,0_0_32px_rgba(255,217,61,0.45),inset_0_2px_0_rgba(255,255,255,0.5)] transition active:translate-y-1 active:shadow-[0_6px_0_0_#B88600] sm:text-2xl sm:py-6"
          >
            <Sparkles className="size-9 shrink-0 text-[#C77DFF] drop-shadow-md transition group-hover:scale-110 sm:size-10" />
            {t('dailyMissionPlayToday')}
          </button>
          {!todayAlreadyRewarded && (
            <p className="-mt-2 text-center font-headline text-lg font-black text-[#FFD93D] drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
              {t('dailyMissionNextReward', { coins: nextDailyBase })}
            </p>
          )}
          {todayAlreadyRewarded && (
            <p className="-mt-2 text-center font-headline text-base font-bold text-[#A0A0BE]">
              {t('dailyMissionAlreadyClaimed')}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              onPractice();
            }}
            className="flex w-full items-center justify-center gap-4 rounded-[1.35rem] border-4 border-teal-300/40 bg-gradient-to-r from-teal-500/90 via-emerald-500/85 to-cyan-600/90 py-4 font-headline text-lg font-black uppercase tracking-wide text-white shadow-[0_8px_0_0_rgba(15,118,110,0.85),0_0_24px_rgba(45,212,191,0.35)] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_0_rgba(15,118,110,0.85)] sm:py-5 sm:text-xl"
          >
            <Gamepad2 className="size-8 shrink-0 text-white drop-shadow-md sm:size-9" strokeWidth={2.5} />
            {t('dailyMissionPractice')}
          </button>

          <button
            type="button"
            onClick={() => {
              audio.playSfx('click');
              setBonusOpen(true);
            }}
            className="flex w-full items-center justify-center gap-4 rounded-[1.35rem] border-4 border-[#E9A8FF]/50 bg-gradient-to-r from-[#9D4EDD] via-[#C77DFF] to-[#6BB5FF] py-4 font-headline text-lg font-black uppercase tracking-wide text-white shadow-[0_8px_0_0_#5b21a6,0_0_28px_rgba(199,125,255,0.45)] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_0_#5b21a6] sm:py-5 sm:text-xl"
          >
            <Tv className="size-8 shrink-0 text-white drop-shadow-md sm:size-9" strokeWidth={2.5} />
            {t('dailyMissionBonusButton')}
          </button>
        </section>
      </div>

      {bonusOpen && (
        <div className="fixed inset-0 z-[190] flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-md rounded-[2rem] border-4 border-[#FFD93D]/35 bg-gradient-to-b from-[#353060] to-[#252540] p-7 shadow-[0_16px_0_0_rgba(0,0,0,0.35)] sm:max-w-lg sm:p-8"
          >
            <div className="mb-4 flex justify-center">
              <div className="rounded-full border-2 border-[#FFD93D]/45 bg-[#FFD93D]/20 p-3 shadow-[0_0_20px_rgba(255,217,61,0.35)]">
                <Coins className="size-10 text-[#FFD93D]" strokeWidth={2.5} />
              </div>
            </div>
            <h2
              className="text-center font-headline text-3xl font-black uppercase tracking-wide text-transparent bg-gradient-to-b from-[#FFF7BF] via-[#FFD93D] to-[#E6A800] bg-clip-text drop-shadow-[0_0_12px_rgba(255,217,61,0.6)] animate-pulse sm:text-4xl"
              style={{ animationDuration: '2.8s' }}
            >
              {t('dailyMissionBonusTitle', { defaultValue: 'Consigue Maticoins Extra' })}
            </h2>
            <p className="mt-3 text-center text-base font-medium leading-relaxed text-white/85">
              {adsRemoved
                ? t('dailyMissionBonusNoAdsHint', { defaultValue: 'Sin anuncios: resuelve una multiplicación para conseguir el bonus.' })
                : t('dailyMissionBonusHint')}
            </p>
            <p className="mt-5 text-center font-headline text-xl font-black text-[#FFD93D]">
              {t('dailyMissionAdsToday', { n: bonusCount, max: DAILY_BONUS_AD_MAX_PER_DAY })}
            </p>
            {!bonusCap && nextBonusBase !== null && (
              <p className="mt-2 text-center font-headline text-lg font-bold text-white">
                {t('dailyMissionBonusNext', { coins: nextBonusBase })}
              </p>
            )}
            <div className="mt-8 flex flex-col gap-4">
              <button
                type="button"
                disabled={bonusBusy || bonusCap}
                onClick={async () => {
                  audio.playSfx('click');
                  const countBefore = bonusCount;
                  const ok = await handleBonusWatch();
                  if (ok && countBefore >= DAILY_BONUS_AD_MAX_PER_DAY - 1) {
                    setBonusOpen(false);
                  }
                }}
                className="rounded-2xl bg-gradient-to-b from-[#6BB5FF] to-[#3570B8] py-4 font-headline text-lg font-black uppercase text-white shadow-[0_8px_0_#2A5090] disabled:opacity-40 sm:text-xl"
              >
                {bonusBusy
                  ? '…'
                  : adsRemoved
                    ? t('dailyMissionBonusSolve', { defaultValue: 'Resolver multiplicación' })
                    : t('dailyMissionBonusWatch')}
              </button>
              <button
                type="button"
                onClick={() => {
                  audio.playSfx('click');
                  setBonusOpen(false);
                }}
                className="rounded-2xl border-2 border-white/25 bg-white/5 py-3.5 font-headline text-base font-bold text-white/90"
              >
                {t('back')}
              </button>
            </div>
            {bonusCap && (
              <p className="mt-5 text-center font-headline text-sm font-bold text-[#A0A0BE]">{t('dailyMissionBonusDone')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
