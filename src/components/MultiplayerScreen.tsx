import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Copy,
  Plus,
  Swords,
  Trash2,
  Rocket,
  Combine,
  Zap,
  Shield,
  Star,
  Share2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Clock,
} from 'lucide-react';
import { UserState } from '../types';
import { BattleMode, KidConnectionHint, ConnectionErrorCode } from '../hooks/useMultiplayer';
import { AVATARS } from '../constants';
import { cn } from '../lib/utils';
import { audio } from '../lib/audio';
import { isFriendOnline } from '../lib/multiplayerUtils';
import { MultiplayerConnection } from '../hooks/useMultiplayer';

interface Props {
  user: UserState;
  /** Código corto para compartir (RTDB friendCodes). */
  myFriendCode?: string;
  /** Estado de generación del código (para no mostrar solo "..."). */
  friendCodeStatus?: 'idle' | 'loading' | 'ready' | 'failed';
  connections: MultiplayerConnection[];
  connectToFriend: (id: string) => void;
  onRefreshConnections?: () => void;
  /** Reset hints / errors when the user taps retry. */
  onRetryConnection?: () => void;
  kidConnectionHint?: KidConnectionHint;
  onBattleFriend: (friendId: string, mode: BattleMode) => void;
  errorCode?: ConnectionErrorCode;
  isReady?: boolean;
  waitingAccept?: string | null;
  onRemoveFriend?: (id: string) => void;
  onAcceptFriendRequest?: (fromId: string) => void;
  onRejectFriendRequest?: (fromId: string) => void;
  onCancelOutgoingFriendRequest?: (toId: string) => void;
}

export const MultiplayerScreen = ({
  user,
  myFriendCode,
  friendCodeStatus = 'idle',
  connections,
  connectToFriend,
  onRefreshConnections,
  onRetryConnection,
  kidConnectionHint,
  onBattleFriend,
  errorCode,
  isReady,
  waitingAccept,
  onRemoveFriend,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onCancelOutgoingFriendRequest,
}: Props) => {
  const { t } = useTranslation();
  const [friendCode, setFriendCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeMode, setActiveMode] = useState<BattleMode>('RPG');
  const [refreshSpin, setRefreshSpin] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showResyncToast, setShowResyncToast] = useState(false);
  const resyncToastTimerRef = useRef<number | null>(null);
  const refreshRef = useRef(onRefreshConnections);
  refreshRef.current = onRefreshConnections;

  useEffect(() => {
    if (!isReady) return;
    const tmr = window.setTimeout(() => refreshRef.current?.(), 0);
    return () => clearTimeout(tmr);
  }, [isReady]);

  const handleRefresh = () => {
    audio.playSfx('click');
    if (kidConnectionHint === 'tapRetry' && onRetryConnection) {
      setRefreshSpin(true);
      onRetryConnection();
      window.setTimeout(() => setRefreshSpin(false), 800);
      return;
    }
    if (!onRefreshConnections) return;
    setRefreshSpin(true);
    onRefreshConnections();
    if (resyncToastTimerRef.current) {
      window.clearTimeout(resyncToastTimerRef.current);
    }
    setShowResyncToast(true);
    resyncToastTimerRef.current = window.setTimeout(() => {
      setShowResyncToast(false);
      resyncToastTimerRef.current = null;
    }, 1800);
    window.setTimeout(() => setRefreshSpin(false), 800);
  };

  useEffect(() => {
    return () => {
      if (resyncToastTimerRef.current) {
        window.clearTimeout(resyncToastTimerRef.current);
      }
    };
  }, []);

  const friends = user.friends || [];
  const incoming = user.friendRequestsIncoming || [];
  const outgoing = user.friendRequestsOutgoing || [];

  const heroCode =
    [myFriendCode, user.friendCode]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .find((s) => s.length > 0) || '';

  const handleCopy = () => {
    if (heroCode) {
      navigator.clipboard.writeText(heroCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const buildShareText = () =>
    t('multiplayer.shareMessage', {
      code: heroCode,
      defaultValue: `¡Agrégame en Multihero! Mi código de héroe es: ${heroCode}`,
    });

  const handleShare = async () => {
    if (!heroCode) return;
    const text = buildShareText();
    const shareData = { title: 'Multihero', text, url: typeof window !== 'undefined' ? window.location.href : '' };
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      /* cancelled or failed */
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  const connectionErrorText =
    errorCode === 'notReady'
      ? t('multiplayer.connectionErrors.notReady')
      : errorCode === 'connectSelf'
        ? t('multiplayer.connectionErrors.connectSelf')
        : errorCode === 'invalidFriendCode'
          ? t('multiplayer.connectionErrors.invalidFriendCode')
          : null;

  return (
    <div className="flex-1 w-full flex flex-col p-4 pt-6 overflow-y-auto pb-32 bg-[#1E1E2F]">
      <div className="relative flex items-center gap-4 mb-5">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #9D4EDD, #4A90E2)', boxShadow: '0 0 25px rgba(157,78,221,0.4)' }}
        >
          <Users className="text-white" size={26} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-headline text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-[#C77DFF] to-[#FFD93D] shimmer-text leading-tight">
            {t('multiplayer.screenTitle')}
          </h2>
          <p className="text-[#A0A0BE] text-xs font-bold mt-0.5">{t('multiplayer.subtitle')}</p>
        </div>
        {(onRefreshConnections || (kidConnectionHint === 'tapRetry' && onRetryConnection)) && (
          <button
            type="button"
            title={
              kidConnectionHint === 'tapRetry'
                ? t('multiplayer.kids.tryAgainButton')
                : t('multiplayer.refreshConnections')
            }
            onClick={handleRefresh}
            disabled={!isReady && kidConnectionHint !== 'tapRetry'}
            className="shrink-0 p-3 rounded-2xl border-2 border-[#6BCB77]/25 bg-[#6BCB77]/10 text-[#6BCB77] hover:bg-[#6BCB77]/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={22} className={cn(refreshSpin && 'animate-spin')} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setHelpOpen((o) => !o);
          audio.playSfx('click');
        }}
        className="w-full flex items-center justify-between gap-2 p-3 mb-3 rounded-2xl border-2 border-[#4A90E2]/25 bg-[#1A1A30]/80 text-left"
      >
        <span className="text-[#6BB5FF] font-black text-xs uppercase tracking-wider">{t('multiplayer.connectionHelpTitle')}</span>
        {helpOpen ? <ChevronUp className="text-[#6BB5FF] shrink-0" size={20} /> : <ChevronDown className="text-[#6BB5FF] shrink-0" size={20} />}
      </button>
      {helpOpen && (
        <div className="mb-4 p-4 rounded-2xl border border-white/10 bg-[#1A1A30]/60 space-y-3 text-[#A0A0BE] text-xs font-bold leading-relaxed">
          <p>{t('multiplayer.connectionHelpStep1')}</p>
          <p>{t('multiplayer.connectionHelpStep2')}</p>
          <p>{t('multiplayer.connectionHelpStep3')}</p>
          <p>{t('multiplayer.connectionHelpStep4')}</p>
        </div>
      )}

      {kidConnectionHint && (
        <div
          className={cn(
            'mb-4 p-4 rounded-2xl border-2 text-center space-y-3',
            kidConnectionHint === 'tapRetry'
              ? 'border-[#FFD93D]/35 bg-[#FFD93D]/10'
              : 'border-[#6BB5FF]/30 bg-[#6BB5FF]/10'
          )}
        >
          <p className="text-white text-sm font-black leading-snug px-1">
            {kidConnectionHint === 'slow' && t('multiplayer.kids.slow')}
            {kidConnectionHint === 'tapRetry' && t('multiplayer.kids.tapRetry')}
          </p>
          {kidConnectionHint === 'tapRetry' && onRetryConnection && (
            <button
              type="button"
              onClick={() => {
                audio.playSfx('click');
                onRetryConnection();
              }}
              className="w-full py-3.5 rounded-xl font-black text-base text-[#1E1E2F] bg-gradient-to-b from-[#FFD93D] to-[#E6A800] border-2 border-[#FFF5]/20 shadow-[0_4px_0_0_#B8860B] active:translate-y-0.5 active:shadow-none transition-all"
            >
              {t('multiplayer.kids.tryAgainButton')}
            </button>
          )}
        </div>
      )}

      <div
        className="relative p-4 rounded-2xl mb-4 border-2 border-[#4A90E2]/30"
        style={{ background: 'linear-gradient(145deg, #2A2A4590, #1A1A3090)', boxShadow: '0 0 20px rgba(74,144,226,0.08)' }}
      >
        {connectionErrorText && (
          <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-[#FF6B6B] to-[#D94545] text-white text-xs py-1.5 px-2 font-bold z-10">
            {connectionErrorText}
          </div>
        )}

        <div className={cn('flex items-center justify-between gap-2', connectionErrorText && 'mt-6')}>
          <div className="flex items-start gap-2 min-w-0">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full shrink-0 mt-0.5',
                isReady ? 'bg-[#6BCB77] shadow-[0_0_8px_#6BCB77]' : 'bg-[#FF6B6B] animate-pulse'
              )}
            />
            <div className="flex flex-col min-w-0">
              <p className="text-[#A0A0BE] font-bold text-[10px] uppercase tracking-[0.15em]">
                {isReady ? t('multiplayer.serverConnected') : t('multiplayer.connecting')}
              </p>
              {!isReady && (
                <p className="text-[#5A5A78] font-bold text-[9px] mt-0.5 normal-case tracking-normal leading-snug">
                  {t('multiplayer.kids.connectingSub')}
                </p>
              )}
            </div>
          </div>
          <p className="text-[#C77DFF] font-black text-[10px] uppercase tracking-[0.2em]">{t('multiplayer.myHeroCode')}</p>
        </div>

        <div className="flex items-center justify-center gap-3 mt-3">
          <div
            className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border-2 border-white/10 px-3 py-2 text-center"
            style={{ background: 'linear-gradient(135deg, #1A1A30, #252540)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}
          >
            <code
              className={cn(
                'max-w-full break-all text-center',
                heroCode || friendCodeStatus === 'loading'
                  ? 'font-mono text-xl font-black uppercase tracking-[0.12em] sm:text-2xl'
                  : 'font-sans text-xs font-bold leading-snug normal-case tracking-normal sm:text-sm',
                friendCodeStatus === 'failed' ? 'text-[#FF9E9E]' : ''
              )}
              style={
                heroCode || friendCodeStatus === 'loading'
                  ? { color: '#6BB5FF', WebkitTextFillColor: '#6BB5FF' }
                  : undefined
              }
            >
              {heroCode ||
                (friendCodeStatus === 'failed'
                  ? t('multiplayer.friendCodeFailed')
                  : friendCodeStatus === 'loading'
                    ? t('multiplayer.friendCodeLoading')
                    : '…')}
            </code>
          </div>
          <button
            type="button"
            title={t('copyCode')}
            onClick={() => {
              handleCopy();
              audio.playSfx('click');
            }}
            className="p-3 rounded-xl transition-all active:scale-95 border-2 border-[#9D4EDD]/30 hover:border-[#9D4EDD] group shrink-0"
            style={{ background: 'linear-gradient(135deg, #9D4EDD20, #4A90E220)' }}
          >
            <Copy size={20} className="text-[#C77DFF] group-hover:text-white transition-colors" />
          </button>
          <button
            type="button"
            title={t('multiplayer.shareViaWhatsApp', { defaultValue: 'WhatsApp' })}
            onClick={() => {
              handleShare();
              audio.playSfx('click');
            }}
            className="p-3 rounded-xl transition-all active:scale-95 border-2 border-[#6BCB77]/30 hover:border-[#6BCB77] group shrink-0"
            style={{ background: 'linear-gradient(135deg, #6BCB7720, #4A90E220)' }}
          >
            <Share2 size={20} className="text-[#6BCB77] group-hover:text-white transition-colors" />
          </button>
        </div>
        {copied && (
          <span className="text-[#6BCB77] text-xs font-black animate-pulse uppercase mt-2 block text-center tracking-widest">{t('copied')}</span>
        )}
      </div>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="space-y-4 mb-5">
          {incoming.length > 0 && (
            <div>
              <p className="text-[#A0A0BE] font-black text-xs uppercase tracking-[0.25em] pl-2 mb-2 flex items-center gap-2">
                <UserPlus size={14} className="text-[#6BCB77]" />
                {t('multiplayer.requestsIncomingTitle')}
              </p>
              <div className="space-y-2">
                {incoming.map((req) => {
                  const online = isFriendOnline(connections, req.fromId);
                  const avatarSrc = AVATARS.find((a) => a.id === req.avatar)?.image || AVATARS[0].image;
                  return (
                    <div
                      key={req.fromId}
                      className="p-3 rounded-2xl border-2 border-[#6BCB77]/25 bg-[#1A1A30]/90 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={avatarSrc} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-[#6BCB77]/30 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-headline font-black text-white truncate">{req.name?.trim() || req.fromId}</p>
                          <p className="text-[10px] text-[#5A5A78] font-bold uppercase tracking-wider">{req.fromId}</p>
                          {!online && (
                            <p className="text-[10px] text-[#FFD93D]/90 font-bold mt-1">{t('multiplayer.acceptNeedsOnline')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            audio.playSfx('click');
                            onRejectFriendRequest?.(req.fromId);
                          }}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-white/15 text-white font-bold text-sm hover:bg-white/10"
                        >
                          {t('multiplayer.decline')}
                        </button>
                        <button
                          type="button"
                          disabled={!online}
                          onClick={() => {
                            audio.playSfx('click');
                            onAcceptFriendRequest?.(req.fromId);
                          }}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl font-black text-sm bg-gradient-to-t from-[#6BCB77] to-[#4DA85A] text-white disabled:opacity-40 disabled:grayscale"
                        >
                          {t('multiplayer.accept')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {outgoing.length > 0 && (
            <div>
              <p className="text-[#A0A0BE] font-black text-xs uppercase tracking-[0.25em] pl-2 mb-2 flex items-center gap-2">
                <Clock size={14} className="text-[#FFD93D]" />
                {t('multiplayer.requestsOutgoingTitle')}
              </p>
              <div className="space-y-2">
                {outgoing.map((o) => (
                  <div
                    key={o.toId}
                    className="flex items-center justify-between gap-2 p-3 rounded-2xl border-2 border-[#FFD93D]/20 bg-[#1A1A30]/80"
                  >
                    <p className="text-white font-bold text-sm truncate">
                      {t('multiplayer.waitingForAccept', {
                        code: o.toId.length > 8 ? `#${o.toId.slice(0, 4)}` : o.toId,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        audio.playSfx('click');
                        onCancelOutgoingFriendRequest?.(o.toId);
                      }}
                      className="shrink-0 px-3 py-2 rounded-xl text-xs font-black uppercase text-[#FF6B6B] border border-[#FF6B6B]/30 hover:bg-[#FF6B6B]/10"
                    >
                      {t('multiplayer.cancelPendingRequest')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[#5A5A78] text-[10px] font-bold text-center px-2 leading-snug">{t('multiplayer.requestsSavedHint')}</p>
        </div>
      )}

      <div className="flex gap-2 mb-5 items-center bg-[#1A1A30]/60 p-2 rounded-2xl border border-white/5">
        <div className="flex-1 relative">
          <input
            type="text"
            value={friendCode}
            onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
            placeholder={t('multiplayer.enterFriendCode')}
            maxLength={9}
            className="w-full bg-[#1A1A30] border-2 border-[#9D4EDD]/20 rounded-xl pl-4 pr-10 py-4 text-white font-headline text-xl font-bold placeholder:text-[#3A3A58] focus:outline-none focus:border-[#9D4EDD] focus:shadow-[0_0_20px_rgba(157,78,221,0.3)] transition-all uppercase tracking-wider"
          />
          {friendCode.length > 0 && (
            <button
              type="button"
              onClick={() => setFriendCode('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A78] hover:text-white transition-colors"
            >
              x
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            audio.playSfx('click');
            connectToFriend(friendCode);
            setFriendCode('');
          }}
          disabled={friendCode.length < 9}
          className="w-16 h-16 rounded-xl font-black text-xl active:scale-90 disabled:opacity-30 transition-all flex items-center justify-center border-2 border-[#6BCB77]/30"
          style={{ background: 'linear-gradient(180deg, #6BCB77, #4DA85A)', boxShadow: '0 6px 0 0 #3A8A45, 0 0 20px rgba(107,203,119,0.3)' }}
        >
          <Plus size={30} className="text-white" />
        </button>
      </div>
      {onRefreshConnections && (
        <button
          type="button"
          onClick={handleRefresh}
          className="mb-5 w-full rounded-xl border-2 border-[#6BB5FF]/35 bg-[#6BB5FF]/10 py-2.5 text-sm font-black uppercase tracking-wide text-[#6BB5FF] transition hover:bg-[#6BB5FF]/20 active:scale-[0.99]"
        >
          {t('multiplayer.resyncNow', { defaultValue: 'Resincronizar ahora' })}
        </button>
      )}
      {showResyncToast && (
        <div className="mb-4 rounded-xl border border-[#6BCB77]/40 bg-[#6BCB77]/15 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-[#6BCB77]">
          {t('multiplayer.resyncDone', { defaultValue: 'Amigos resincronizados' })}
        </div>
      )}

      <div className="mb-8">
        <p className="text-[#A0A0BE] font-black text-xs uppercase tracking-[0.25em] pl-2 mb-3 flex items-center gap-2">
          <Zap size={14} className="text-[#FFD93D]" />
          {t('multiplayer.battleMode')}
        </p>
        <div className="flex gap-4 overflow-x-auto snap-x hide-scrollbar py-4 -my-2 px-2">
          {[
            { id: 'RPG', icon: Swords, label: t('multiplayer.modes.rpg'), desc: t('multiplayer.modes.rpgDesc'), color: '#FF6B6B', glow: 'rgba(255,107,107,0.3)' },
            { id: 'TUG', icon: Combine, label: t('multiplayer.modes.tug'), desc: t('multiplayer.modes.tugDesc'), color: '#FFD93D', glow: 'rgba(255,217,61,0.3)' },
            { id: 'SPRINT', icon: Rocket, label: t('multiplayer.modes.sprint'), desc: t('multiplayer.modes.sprintDesc'), color: '#6BCB77', glow: 'rgba(107,203,119,0.3)' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setActiveMode(m.id as BattleMode);
                audio.playSfx('click');
              }}
              className={cn(
                'snap-center shrink-0 w-[7.5rem] h-32 rounded-2xl flex flex-col items-center justify-center transition-all p-3 gap-1.5 border-2 relative overflow-hidden',
                activeMode === m.id ? 'border-white/20 scale-105' : 'border-white/5 opacity-50 hover:opacity-80'
              )}
              style={
                activeMode === m.id
                  ? {
                      background: `linear-gradient(145deg, ${m.color}15, #1A1A30)`,
                      boxShadow: `0 0 25px ${m.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
                    }
                  : { background: 'linear-gradient(145deg, #2A2A45, #1A1A30)' }
              }
            >
              {activeMode === m.id && (
                <>
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full star-twinkle" style={{ backgroundColor: m.color, animationDelay: '0.3s' }} />
                  <div className="absolute bottom-3 left-3 w-1 h-1 rounded-full star-twinkle" style={{ backgroundColor: m.color, animationDelay: '0.8s' }} />
                </>
              )}
              <m.icon
                size={28}
                style={{
                  color: activeMode === m.id ? m.color : '#5A5A78',
                  filter: activeMode === m.id ? `drop-shadow(0 0 8px ${m.glow})` : 'none',
                }}
              />
              <span className={cn('font-black tracking-wider text-xs', activeMode === m.id ? 'text-white' : 'text-[#A0A0BE]')}>{m.label}</span>
              <span className="text-[9px] text-[#A0A0BE] font-bold text-center leading-tight">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <p className="text-[#A0A0BE] font-black text-xs uppercase tracking-[0.25em] pl-2 flex items-center gap-2">
          <Shield size={14} className="text-[#6BB5FF]" />
          {t('multiplayer.friendList')}
        </p>
        {friends.length === 0 ? (
          <div
            className="text-center py-12 rounded-[2rem] border-2 border-dashed border-white/10 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #2A2A4540, #1A1A3040)' }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(157,78,221,0.05)_0%,transparent_70%)] pointer-events-none" />
            <Users size={48} className="text-[#3A3A58] mx-auto mb-3" />
            <p className="text-[#A0A0BE] font-bold text-lg">{t('multiplayer.noHeroesFound')}</p>
            <p className="text-[#5A5A78] text-sm mt-1">{t('multiplayer.addFriendPrompt')}</p>
          </div>
        ) : (
          friends.map((f) => {
            const isOnline = isFriendOnline(connections, f.id);
            const avatarSrc = AVATARS.find((a) => a.id === f.avatar)?.image || AVATARS[0].image;

            return (
              <div
                key={f.id}
                className="flex items-center justify-between p-4 rounded-[1.5rem] border-2 relative overflow-hidden group transition-all hover:border-white/15"
                style={{
                  background: 'linear-gradient(145deg, #2A2A45, #1A1A30)',
                  borderColor: isOnline ? 'rgba(107,203,119,0.2)' : 'rgba(255,255,255,0.05)',
                  boxShadow: isOnline ? '0 0 20px rgba(107,203,119,0.08)' : 'none',
                }}
              >
                {isOnline && (
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#6BCB77] to-transparent" />
                )}

                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-2xl overflow-hidden border-2 p-[2px]"
                      style={{
                        borderColor: isOnline ? 'rgba(107,203,119,0.4)' : 'rgba(255,255,255,0.1)',
                        background: isOnline ? 'linear-gradient(135deg, #6BCB7730, #4A90E230)' : 'linear-gradient(135deg, #2A2A45, #1A1A30)',
                      }}
                    >
                      <img src={avatarSrc} className="w-full h-full object-cover rounded-xl" alt="" />
                    </div>
                    <div
                      className={cn(
                        'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-[#1A1A30] z-10',
                        isOnline ? 'bg-[#6BCB77] shadow-[0_0_8px_#6BCB77]' : 'bg-[#3A3A58]'
                      )}
                    />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-headline font-black text-white text-lg leading-none mb-1.5">{f.name?.trim() || `#${f.id.slice(0, 4)}`}</p>
                    <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg self-start">
                      <Star size={10} className="text-[#FFD93D]" fill="currentColor" />
                      <span className="text-[10px] text-[#A0A0BE] font-black uppercase tracking-wider">LVL {f.level}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {onRemoveFriend && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('multiplayer.removeFriendPrompt'))) onRemoveFriend(f.id);
                      }}
                      className="px-3 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 bg-white/5 text-[#5A5A78] hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 border border-transparent hover:border-[#FF6B6B]/20"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onBattleFriend(f.id, activeMode)}
                    disabled={!isOnline || waitingAccept === f.id}
                    className={cn(
                      'px-5 h-12 rounded-xl flex items-center justify-center font-black gap-2 transition-all active:scale-95 border-2',
                      waitingAccept === f.id
                        ? 'border-[#FFD93D]/30 text-[#FFD93D] animate-pulse'
                        : isOnline
                          ? 'border-[#FF6B6B]/30 text-white hover:brightness-110'
                          : 'border-white/5 text-[#3A3A58] opacity-50'
                    )}
                    style={
                      waitingAccept === f.id
                        ? {
                            background: 'linear-gradient(180deg, #FFD93D20, #E6A80010)',
                            boxShadow: '0 0 20px rgba(255,217,61,0.15)',
                          }
                        : isOnline
                          ? {
                              background: 'linear-gradient(180deg, #FF6B6B, #D94545)',
                              boxShadow: '0 4px 0 0 #A03030, 0 0 20px rgba(255,107,107,0.25)',
                            }
                          : { background: '#1A1A30' }
                    }
                  >
                    <Swords size={18} className={cn(waitingAccept === f.id && 'animate-spin')} />
                    <span className="text-sm tracking-wider">
                      {waitingAccept === f.id ? t('multiplayer.waiting') : isOnline ? t('multiplayer.duel') : t('multiplayer.offline')}
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
