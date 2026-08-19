import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UserState } from '../types';
import { Rocket, Crown, ArrowLeft, Frown } from 'lucide-react';
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

const MAX_SCORE = 10;

export const PvpSprintScreen = ({ user, uid, opponentId, battleId, onQuit }: Props) => {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER'>('WAITING');
  const [countdown, setCountdown] = useState(3);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [flashColor, setFlashColor] = useState<'red' | 'green' | null>(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [opponentAvatar, setOpponentAvatar] = useState(AVATARS[0].image);
  /** Victoria/derrota real; no usar solo el marcador (un rival puede rendirse sin llegar a 10). */
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
      if (data.action === 'SPRINT_STEP') {
        setOppScore((prev) => {
          const next = prev + 1;
          if (next >= MAX_SCORE) {
            queueMicrotask(() => endGameRef.current('DEFEAT'));
          }
          return next;
        });
      } else if (data.action === 'SPRINT_PENALTY') {
        setOppScore((prev) => Math.max(0, prev - 1));
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
    if (!problem || gameState !== 'PLAYING') return;
    if (option === problem.answer) {
      audio.playSfx('correct');
      setMyScore((prev) => {
        const next = prev + 1;
        if (next >= MAX_SCORE) {
          queueMicrotask(() => endGameRef.current('VICTORY'));
        }
        return next;
      });
      setFlashColor('green');
      if (battleId) {
        push(ref(db, `battles/${battleId}/actions`), {
          from: uid,
          action: 'SPRINT_STEP',
          timestamp: Date.now(),
        });
      }
      setProblem(generateAdaptiveProblem(user, 'BATTLE'));
      setTimeout(() => setFlashColor(null), 300);
    } else {
      audio.playSfx('wrong');
      setMyScore((prev) => Math.max(0, prev - 1));
      setFlashColor('red');
      if (battleId) {
        push(ref(db, `battles/${battleId}/actions`), {
          from: uid,
          action: 'SPRINT_PENALTY',
          timestamp: Date.now(),
        });
      }
      setTimeout(() => setFlashColor(null), 300);
    }
  };

  const getMyAvatar = () => AVATARS.find((a) => a.id === user.selectedAvatar)?.image || AVATARS[0].image;

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

  const won = finalOutcome === 'VICTORY';

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
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(107,203,119,0.06)_0%,transparent_60%)] pointer-events-none"></div>
      {won && gameState === 'GAME_OVER' && <VictoryTrumpets className="z-[5]" />}

      <div
        className="w-full h-24 border-b-2 border-white/5 flex items-center justify-between px-5 z-10 shrink-0"
        style={{ background: 'linear-gradient(180deg, #111122E0, #1A1A30)', boxShadow: '0 4px 30px rgba(0,0,0,0.4)' }}
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
            className="px-4 py-1.5 rounded-full font-black tracking-[0.15em] text-xs flex items-center gap-2 border-2 border-[#6BCB77]/30"
            style={{
              background: 'linear-gradient(135deg, #6BCB7715, #1A1A30)',
              color: '#6BCB77',
              boxShadow: '0 0 15px rgba(107,203,119,0.1)',
            }}
          >
            <Rocket size={14} />
            {t('multiplayer.modes.sprint')}
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

      <div className="w-full flex-1 max-w-5xl mx-auto flex flex-col justify-center px-6 gap-8 relative mt-4">
        <div className="relative">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[#FF6B6B] font-black text-sm tracking-wider">{opponentName}</span>
            <span className="text-[#A0A0BE] font-bold text-xs">
              {oppScore}/{MAX_SCORE}
            </span>
          </div>
          <div className="relative w-full h-10 rounded-full border-2 border-white/5 overflow-hidden" style={{ background: '#111122' }}>
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#FF6B6B]/20 to-[#FF6B6B]/40 transition-all duration-300 rounded-full"
              style={{ width: `${(oppScore / MAX_SCORE) * 100}%` }}
            ></div>
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#FFD93D]/50 via-white/30 to-[#FFD93D]/50"></div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-3xl drop-shadow-lg z-10">🏁</span>
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-10"
              style={{ left: `calc(${(oppScore / MAX_SCORE) * 90}% + 4px)` }}
            >
              <img
                src={opponentAvatar}
                className="w-12 h-12 rounded-full border-3 border-[#FF6B6B] object-cover"
                style={{ boxShadow: '0 0 12px rgba(255,107,107,0.4)' }}
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[#6BB5FF] font-black text-sm tracking-wider">{user.playerName || t('multiplayer.me')}</span>
            <span className="text-[#A0A0BE] font-bold text-xs">
              {myScore}/{MAX_SCORE}
            </span>
          </div>
          <div
            className="relative w-full h-14 rounded-full border-2 border-[#6BB5FF]/15 overflow-hidden"
            style={{ background: '#111122', boxShadow: '0 0 20px rgba(107,181,255,0.08)' }}
          >
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#6BB5FF]/20 to-[#6BB5FF]/40 transition-all duration-300 rounded-full"
              style={{ width: `${(myScore / MAX_SCORE) * 100}%` }}
            ></div>
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#FFD93D]/50 via-white/30 to-[#FFD93D]/50"></div>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-4xl drop-shadow-lg z-10">🏁</span>
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 z-10"
              style={{ left: `calc(${(myScore / MAX_SCORE) * 90}% + 4px)` }}
            >
              <img
                src={getMyAvatar()}
                className="w-16 h-16 rounded-full border-3 border-[#6BB5FF] object-cover"
                style={{ boxShadow: '0 0 20px rgba(107,181,255,0.5)' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="w-full shrink-0 flex flex-col items-center justify-center pb-6 pt-6 border-t-2 border-white/5"
        style={{ background: 'linear-gradient(180deg, #111122B0, #1A1A30)', minHeight: '16rem' }}
      >
        {gameState === 'COUNTDOWN' && (
          <div
            className="text-8xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-b from-[#6BCB77] to-[#4A90E2] animate-pulse leading-none"
            style={{ filter: 'drop-shadow(0 0 30px rgba(107,203,119,0.5))' }}
          >
            {countdown}
          </div>
        )}

        {gameState === 'PLAYING' && problem && (
          <div className="w-full max-w-md flex flex-col items-center gap-4 px-4">
            <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BCB77] via-white to-[#FFD93D] text-center tracking-wider">
              {problem.a} x {problem.b} = ?
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              {problem.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
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
          <div className="relative z-10 flex flex-col items-center gap-4 px-4 text-center min-h-[260px] w-full">
            {won ? (
              <Crown size={80} className="relative z-10 text-[#FFD93D]" style={{ filter: 'drop-shadow(0 0 30px rgba(255,217,61,0.6))' }} />
            ) : (
              <Frown size={70} className="text-[#5A5A78]" style={{ filter: 'drop-shadow(0 0 15px rgba(90,90,120,0.4))' }} />
            )}
            <h2
              className={cn(
                'relative z-10 text-4xl md:text-5xl font-black tracking-widest font-headline',
                won ? 'shimmer-text' : 'text-[#5A5A78]'
              )}
            >
              {won ? t('multiplayer.victory') : t('multiplayer.defeat')}
            </h2>
            <button
              onClick={onQuit}
              className="relative z-10 mt-2 px-8 py-3 rounded-xl font-bold transition-all border-2 border-white/10 text-white bg-white/5 hover:bg-white/10 active:scale-95"
            >
              {t('multiplayer.exitSprint')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
