import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UserState } from '../types';
import { ArrowLeft, Frown, Crown, Combine } from 'lucide-react';
import { AVATARS } from '../constants';
import { generateAdaptiveProblem, Problem } from '../lib/engine';
import { cn } from '../lib/utils';
import { audio } from '../lib/audio';
import { VictoryTrumpets } from './VictoryTrumpets';
import { runVictoryCelebration } from '../lib/victoryCelebration';
import { findFriendByOpponentId, sendQuitAndLeave } from '../lib/multiplayerUtils';
import { onChildAdded, push, ref } from 'firebase/database';
import { db } from '../lib/firebase';

interface Props {
  user: UserState;
  uid: string;
  opponentId: string | null;
  battleId: string | null;
  onQuit: () => void;
}

export const PvpTugWarScreen = ({ user, uid, opponentId, battleId, onQuit }: Props) => {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER'>('WAITING');
  const [countdown, setCountdown] = useState(3);
  const [bombPosition, setBombPosition] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [flashColor, setFlashColor] = useState<'red' | 'green' | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [opponentAvatar, setOpponentAvatar] = useState(AVATARS[0].image);
  const [finalOutcome, setFinalOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const matchFinishedRef = useRef(false);

  const endGame = useCallback((result: 'VICTORY' | 'DEFEAT', options?: { opponentSurrender?: boolean }) => {
    if (result === 'VICTORY' && options?.opponentSurrender) {
      matchFinishedRef.current = false;
    } else if (matchFinishedRef.current) {
      return;
    }
    matchFinishedRef.current = true;
    setFinalOutcome(result);
    setGameState('GAME_OVER');
    if (result === 'VICTORY') {
      runVictoryCelebration();
    } else {
      audio.playSfx('lose');
    }
  }, []);

  const endGameRef = useRef(endGame);
  endGameRef.current = endGame;
  const actionsSessionStartRef = useRef(Date.now());

  useEffect(() => {
    if (!battleId || !uid) return;
    actionsSessionStartRef.current = Date.now();
    const opp = findFriendByOpponentId(user.friends, opponentId);
    if (opp) {
      const raw = opp.name?.trim();
      setOpponentName(raw && raw.length > 0 ? raw : `#${opp.id.slice(0, 4)}`);
      setOpponentAvatar(AVATARS.find((a) => a.id === opp.avatar)?.image || AVATARS[0].image);
    }
    const handleData = (data: any) => {
      if (!data || data.from === uid) return;
      const ts = Number(data.timestamp || 0);
      if (ts && ts < actionsSessionStartRef.current - 500) return;
      if (data.action === 'SURRENDER') {
        endGameRef.current('VICTORY', { opponentSurrender: true });
        return;
      }
      if (matchFinishedRef.current) return;
      if (gameStateRef.current !== 'PLAYING') return;
      if (data.action === 'TUG_PUSH') {
        setBombPosition((prev) => {
          const next = prev - Number(data.amount || 0);
          if (next <= -100 && gameStateRef.current === 'PLAYING') {
            queueMicrotask(() => endGameRef.current('DEFEAT'));
          }
          return next;
        });
        setFlashColor('red');
        setTimeout(() => setFlashColor(null), 300);
      }
    };
    const unsubscribe = onChildAdded(ref(db, `battles/${battleId}/actions`), (snap) => {
      handleData(snap.val());
    });
    setGameState('COUNTDOWN');
    return () => {
      unsubscribe();
    };
  }, [battleId, opponentId, user.friends, uid]);

  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
      }
      setGameState('PLAYING');
      setProblem(generateAdaptiveProblem(user, 'BATTLE'));
    }
  }, [gameState, countdown, user]);

  const handleAnswer = (option: number) => {
    if (!problem || isLocked || gameState !== 'PLAYING') return;
    if (option === problem.answer) {
      audio.playSfx('correct');
      setErrorCount(0);
      const pushAmount = 15;
      setBombPosition((prev) => {
        const next = prev + pushAmount;
        if (next >= 100) {
          queueMicrotask(() => endGameRef.current('VICTORY'));
        }
        return next;
      });
      setFlashColor('green');
      if (battleId) {
        push(ref(db, `battles/${battleId}/actions`), {
          from: uid,
          action: 'TUG_PUSH',
          amount: pushAmount,
          timestamp: Date.now(),
        });
      }
      setProblem(generateAdaptiveProblem(user, 'BATTLE'));
      setTimeout(() => setFlashColor(null), 300);
    } else {
      audio.playSfx('wrong');
      const nextError = errorCount + 1;
      const penaltyTimeMs = Math.min(nextError, 3) * 1000;
      setErrorCount(nextError);
      setIsLocked(true);
      setFlashColor('red');
      setTimeout(() => {
        setIsLocked(false);
        setFlashColor(null);
      }, penaltyTimeMs);
    }
  };

  const getMyAvatar = () => AVATARS.find((a) => a.id === user.selectedAvatar)?.image || AVATARS[0].image;
  const bombVisPercent = ((bombPosition + 100) / 200) * 100;

  /** Balloon: very wide scale range; mild curve — each tug step reads clearly, extra punch near edges. */
  const tugDistance01 = Math.min(1, Math.abs(bombPosition) / 100);
  const balloonScale = 0.34 + 1.42 * Math.pow(tugDistance01, 1.15);

  const isDangerMe = bombPosition < -50;
  const isDangerOpp = bombPosition > 50;

  const btnColors = [
    { bg: 'linear-gradient(180deg, #6BB5FF, #4A90E2)', shadow: '0 5px 0 0 #2A5090, 0 0 12px rgba(74,144,226,0.3)' },
    { bg: 'linear-gradient(180deg, #FFE066, #FFD93D)', shadow: '0 5px 0 0 #B88600, 0 0 12px rgba(255,217,61,0.3)', text: '#3D2E00' },
    { bg: 'linear-gradient(180deg, #FF9E9E, #FF6B6B)', shadow: '0 5px 0 0 #A03030, 0 0 12px rgba(255,107,107,0.3)' },
    { bg: 'linear-gradient(180deg, #C77DFF, #9D4EDD)', shadow: '0 5px 0 0 #5A1F8A, 0 0 12px rgba(157,78,221,0.3)' },
  ];

  const quit = () =>
    sendQuitAndLeave(
      () => {
        if (!battleId) return;
        push(ref(db, `battles/${battleId}/actions`), {
          from: uid,
          action: 'SURRENDER',
          timestamp: Date.now(),
        });
      },
      onQuit
    );

  return (
    <div
      className={cn(
        'absolute inset-0 z-[100] bg-[#1A1A30] flex flex-col items-center',
        gameState === 'GAME_OVER' && finalOutcome === 'VICTORY' ? 'overflow-visible' : 'overflow-hidden'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 z-0 transition-colors duration-200 pointer-events-none',
          flashColor === 'red' ? 'bg-[#FF6B6B]/10' : flashColor === 'green' ? 'bg-[#6BCB77]/10' : 'bg-transparent'
        )}
      ></div>
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,217,61,0.06)_0%,transparent_60%)] pointer-events-none"></div>
      {gameState === 'GAME_OVER' && finalOutcome === 'VICTORY' && <VictoryTrumpets className="z-[5]" />}

      <div
        className="w-full h-24 border-b-2 border-white/5 flex items-center justify-between px-5 z-10 shrink-0"
        style={{ background: 'linear-gradient(180deg, #111122E0, #1A1A30)' }}
      >
        <div className="flex items-center gap-3 w-1/3">
          <button
            onClick={quit}
            className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-[#A0A0BE] backdrop-blur-md border border-white/10 active:scale-90 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <img
            src={getMyAvatar()}
            className="w-14 h-14 rounded-2xl border-2 border-[#6BB5FF]/40 object-cover"
            style={{ boxShadow: '0 0 15px rgba(107,181,255,0.25)' }}
          />
          <div>
            <p className="text-white font-black text-base tracking-wider">{user.playerName || t('multiplayer.me')}</p>
            <p className="text-[#6BB5FF] font-bold text-xs">LVL {user.currentLevel}</p>
          </div>
        </div>
        <div className="w-1/3 flex justify-center">
          <div
            className="px-4 py-1.5 rounded-full font-black tracking-[0.15em] text-xs flex items-center gap-2 border-2 border-[#FFD93D]/30"
            style={{
              background: 'linear-gradient(135deg, #FFD93D15, #1A1A30)',
              color: '#FFD93D',
              boxShadow: '0 0 15px rgba(255,217,61,0.1)',
            }}
          >
            <Combine size={14} />
            {t('multiplayer.modes.tug')}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 w-1/3">
          <div className="text-right">
            <p className="text-white font-black text-base tracking-wider">{opponentName}</p>
            <p className="text-[#FF6B6B] font-bold text-xs">{t('multiplayer.rival')}</p>
          </div>
          <img
            src={opponentAvatar}
            className="w-14 h-14 rounded-2xl border-2 border-[#FF6B6B]/40 object-cover"
            style={{ boxShadow: '0 0 15px rgba(255,107,107,0.25)' }}
          />
        </div>
      </div>

      {/* Tug field: bar stays clipped; balloon sits above in overflow-visible wrapper */}
      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center px-6 relative mt-4 shrink-0 min-h-[140px]">
        <div className="relative w-full py-10">
          <div className="relative w-full h-7 rounded-full overflow-hidden border-2 border-white/10" style={{ background: '#111122' }}>
            <div className="absolute top-0 bottom-0 left-0 w-1/4 bg-gradient-to-r from-[#6BB5FF]/15 to-transparent pointer-events-none" />
            <div className="absolute top-0 bottom-0 right-0 w-1/4 bg-gradient-to-l from-[#FF6B6B]/15 to-transparent pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-full pointer-events-none" />
            <div
              className="absolute top-0 bottom-0 left-0 rounded-l-full transition-all duration-300 pointer-events-none"
              style={{
                width: `${bombVisPercent}%`,
                background: `linear-gradient(90deg, #6BB5FF40, ${isDangerOpp ? '#6BCB7740' : '#A0A0BE20'})`,
              }}
            />
          </div>
          {/* Balloon — outside clipped bar */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-[60%] h-24 pointer-events-none overflow-visible z-20">
            <div
              className="absolute top-0 transition-all duration-300 ease-out flex flex-col items-center origin-bottom"
              style={{
                left: `${bombVisPercent}%`,
                transform: `translateX(-50%) scale(${balloonScale})`,
              }}
            >
              <div className="relative animate-bounce drop-shadow-lg">
                <div
                  className="text-5xl md:text-6xl leading-none"
                  style={{
                    filter: `drop-shadow(0 6px 18px ${
                      isDangerMe ? 'rgba(255,107,107,0.75)' : isDangerOpp ? 'rgba(107,203,119,0.75)' : 'rgba(255,217,61,0.55)'
                    })`,
                  }}
                  role="img"
                  aria-label="tug marker"
                >
                  {bombVisPercent <= 0 || bombVisPercent >= 100 ? '💥' : '🎈'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between px-4 -mt-4">
          <span className="text-[#6BB5FF]/50 font-black text-xs tracking-wider uppercase">{t('multiplayer.base')}</span>
          <span className="text-[#FF6B6B]/50 font-black text-xs tracking-wider uppercase">{t('multiplayer.rival_base')}</span>
        </div>
      </div>

      <div
        className="w-full flex-1 flex flex-col items-center justify-center pb-8 pt-4 border-t-2 border-white/5 min-h-0"
        style={{ background: 'linear-gradient(180deg, #111122B0, #1A1A30)' }}
      >
        {gameState === 'COUNTDOWN' && (
          <div
            className="text-[10rem] font-black font-headline text-transparent bg-clip-text bg-gradient-to-b from-[#FFD93D] to-[#FF6B6B] animate-bounce leading-none"
            style={{ filter: 'drop-shadow(0 0 40px rgba(255,217,61,0.5))' }}
          >
            {countdown}
          </div>
        )}

        {gameState === 'PLAYING' && problem && (
          <div className="w-full max-w-md flex flex-col items-center gap-4 py-2 relative px-4">
            {isLocked && (
              <div
                className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-[#FF6B6B]/30"
                style={{ background: '#1A1A30E8', backdropFilter: 'blur(4px)' }}
              >
                <div className="flex flex-col items-center gap-2">
                  <Frown size={40} className="text-[#FF6B6B] animate-bounce" style={{ filter: 'drop-shadow(0 0 15px rgba(255,107,107,0.6))' }} />
                  <span className="font-black text-[#FF6B6B] tracking-widest text-lg bg-[#FF6B6B]/10 px-4 py-1 rounded-full border border-[#FF6B6B]/20">
                    {Math.min(errorCount, 3)}
                    {t('multiplayer.penalty')}
                  </span>
                </div>
              </div>
            )}
            <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD93D] via-white to-[#C77DFF] text-center tracking-wider mb-2">
              {problem.a} x {problem.b} = ?
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              {problem.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  disabled={isLocked}
                  className="rounded-2xl text-center text-4xl font-black py-5 transition-all active:scale-95 active:translate-y-1 border-2 border-white/10"
                  style={{ background: btnColors[i].bg, boxShadow: btnColors[i].shadow, color: btnColors[i].text || 'white' }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && finalOutcome && (
          <div className="relative z-10 flex flex-col items-center gap-6 min-h-[280px] w-full">
            {finalOutcome === 'VICTORY' ? (
              <Crown size={100} className="relative z-10 text-[#FFD93D]" style={{ filter: 'drop-shadow(0 0 40px rgba(255,217,61,0.7))' }} />
            ) : (
              <Frown size={90} className="text-[#5A5A78]" style={{ filter: 'drop-shadow(0 0 20px rgba(90,90,120,0.5))' }} />
            )}
            <h2
              className={cn(
                'relative z-10 text-5xl font-black tracking-widest font-headline',
                finalOutcome === 'VICTORY' ? 'shimmer-text' : 'text-[#5A5A78]'
              )}
            >
              {finalOutcome === 'VICTORY' ? t('multiplayer.victory') : t('multiplayer.defeat')}
            </h2>
            <button
              onClick={onQuit}
              className="relative z-10 mt-2 px-8 py-3 rounded-xl font-bold transition-all border-2 border-white/10 text-white bg-white/5 hover:bg-white/10 active:scale-95"
            >
              {t('multiplayer.backToMap')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
