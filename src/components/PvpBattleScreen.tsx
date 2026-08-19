import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UserState } from '../types';
import { AVATARS } from '../constants';
import { generateAdaptiveProblem, Problem } from '../lib/engine';
import { Swords, ArrowLeft, Zap, Crown, Frown } from 'lucide-react';
import { cn } from '../lib/utils';
import { audio } from '../lib/audio';
import { VictoryTrumpets } from './VictoryTrumpets';
import { runVictoryCelebration } from '../lib/victoryCelebration';
import { findFriendByOpponentId, sendQuitAndLeave } from '../lib/multiplayerUtils';
import { onChildAdded, push, ref } from 'firebase/database';
import { db } from '../lib/firebase';

interface Props {
  user: UserState;
  /** Firebase Auth uid — identidad en batallas RTDB. */
  uid: string;
  opponentId: string | null;
  battleId: string | null;
  onQuit: () => void;
}

export const PvpBattleScreen = ({ user, uid, opponentId, battleId, onQuit }: Props) => {
  const { t } = useTranslation();
  const [myHp, setMyHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [flashColor, setFlashColor] = useState<'red' | 'green' | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [gameState, setGameState] = useState<'STARTING' | 'PLAYING' | 'WIN' | 'LOSE'>('STARTING');
  const [countdown, setCountdown] = useState(3);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  /** Firebase onChildAdded re-emite hijos existentes al suscribirse; ignorar acciones de partidas anteriores. */
  const actionsSessionStartRef = useRef(Date.now());

  const oppFriend = findFriendByOpponentId(user.friends, opponentId);
  const oppLabel = oppFriend
    ? (oppFriend.name?.trim() ? oppFriend.name : `#${oppFriend.id.slice(0, 4)}`)
    : t('multiplayer.rival');
  const myAvatarSrc = AVATARS.find(a => a.id === user.selectedAvatar)?.image || AVATARS[0].image;
  const oppAvatarSrc = AVATARS.find(a => a.id === oppFriend?.avatar)?.image || AVATARS[0].image;

  useEffect(() => {
     if (!battleId || !uid) return;
     actionsSessionStartRef.current = Date.now();
     const actionsRef = ref(db, `battles/${battleId}/actions`);
     const unsubscribe = onChildAdded(actionsRef, (snap) => {
        const data = snap.val();
        if (!data || data.from === uid) return;
        const ts = Number(data.timestamp || 0);
        if (ts && ts < actionsSessionStartRef.current - 500) return;
        if (data.action === 'SURRENDER') {
           setGameState('WIN');
           runVictoryCelebration();
           return;
        }
        if (gameStateRef.current !== 'PLAYING') return;
        if (data.action === 'ATTACK') {
           setMyHp(prev => {
              const next = Math.max(0, prev - Number(data.value || 0));
              if (next <= 0) setGameState('LOSE');
              return next;
           });
        }
     });
     return () => unsubscribe();
  }, [battleId, uid]);

  useEffect(() => {
     if (countdown > 0) {
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
     } else if (countdown === 0 && gameState === 'STARTING') {
        setGameState('PLAYING');
        setProblem(generateAdaptiveProblem(user, 'BATTLE'));
     }
  }, [countdown, gameState, user]);

  const handleAnswer = (option: number) => {
     if (!problem || isLocked || gameState !== 'PLAYING') return;
     if (option === problem.answer) {
        audio.playSfx('correct');
        const damage = Math.floor(Math.random() * 5) + 15;
        setErrorCount(0);
        if (battleId) {
          push(ref(db, `battles/${battleId}/actions`), {
            from: uid,
            action: 'ATTACK',
            value: damage,
            timestamp: Date.now(),
          });
        }
        setFlashColor('green');
        setEnemyHp(prev => {
           const next = Math.max(0, prev - damage);
           const endGame = (result: 'VICTORY' | 'DEFEAT') => {
              setGameState(result === 'VICTORY' ? 'WIN' : 'LOSE');
              if (result === 'VICTORY') {
                 runVictoryCelebration();
              } else {
                 audio.playSfx('lose');
              }
           };
           if (next === 0) endGame('VICTORY');
           return next;
        });
        setProblem(generateAdaptiveProblem(user, 'BATTLE'));
        setTimeout(() => setFlashColor(null), 300);
     } else {
        audio.playSfx('wrong');
        const nextError = errorCount + 1;
        const penaltyTimeMs = Math.min(nextError, 3) * 1000;
        setErrorCount(nextError);
        setIsLocked(true);
        setFlashColor('red');
        setTimeout(() => { setIsLocked(false); setFlashColor(null); }, penaltyTimeMs);
     }
  };

  const btnColors = [
    { bg: 'linear-gradient(180deg, #6BB5FF, #4A90E2)', shadow: '0 5px 0 0 #2A5090, 0 0 15px rgba(74,144,226,0.3)' },
    { bg: 'linear-gradient(180deg, #FFE066, #FFD93D)', shadow: '0 5px 0 0 #B88600, 0 0 15px rgba(255,217,61,0.3)', text: '#3D2E00' },
    { bg: 'linear-gradient(180deg, #FF9E9E, #FF6B6B)', shadow: '0 5px 0 0 #A03030, 0 0 15px rgba(255,107,107,0.3)' },
    { bg: 'linear-gradient(180deg, #C77DFF, #9D4EDD)', shadow: '0 5px 0 0 #5A1F8A, 0 0 15px rgba(157,78,221,0.3)' },
  ];

  return (
    <div
      className={cn(
        'flex-1 w-full bg-[#1E1E2F] flex flex-col relative transition-colors duration-200',
        gameState === 'WIN' ? 'overflow-visible' : 'overflow-hidden',
        flashColor === 'red' ? 'bg-[#3A1020]' : flashColor === 'green' ? 'bg-[#102A20]' : ''
      )}
    >
       {/* Background Effects */}
       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(157,78,221,0.12)_0%,transparent_60%)] pointer-events-none"></div>
       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(74,144,226,0.08)_0%,transparent_50%)] pointer-events-none"></div>

       {/* Top Bar */}
       <div className="z-10 p-4 flex items-center justify-between" style={{ background: 'linear-gradient(180deg, #1A1A30E0, transparent)' }}>
          <button onClick={() => sendQuitAndLeave(() => {
            if (!battleId) return;
            push(ref(db, `battles/${battleId}/actions`), {
              from: uid,
              action: 'SURRENDER',
              timestamp: Date.now(),
            });
          }, onQuit)} className="w-11 h-11 bg-white/5 rounded-full flex items-center justify-center text-[#A0A0BE] backdrop-blur-md border border-white/10 active:scale-90 transition-all">
             <ArrowLeft size={22} />
          </button>
          <div className="px-5 py-2 rounded-full border-2 border-[#FF6B6B]/30 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #FF6B6B15, #9D4EDD15)', boxShadow: '0 0 20px rgba(255,107,107,0.1)' }}>
             <Swords size={16} className="text-[#FF6B6B]" />
             <p className="text-white font-black tracking-[0.15em] text-sm">{t('multiplayer.pvpDuel')}</p>
          </div>
          <div className="w-11 h-11"></div>
       </div>

       {/* VS Arena */}
       <div className="flex-1 flex flex-col justify-center px-4 z-10 gap-6">

          {/* Enemy */}
          <div className="flex flex-col items-center gap-3">
             <div className="flex w-full max-w-sm justify-between items-end mb-1 px-2">
                <span className="text-[#FF6B6B] font-black text-lg drop-shadow-md">{oppLabel}</span>
                <span className="text-[#A0A0BE] font-bold text-sm">{enemyHp} HP</span>
             </div>
             <div className="w-full max-w-sm h-5 bg-[#1A1A30] rounded-full border border-[#FF6B6B]/20 overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-[#FF6B6B] to-[#D94545] transition-all duration-300 rounded-full" style={{ width: `${enemyHp}%`, boxShadow: '0 0 12px rgba(255,107,107,0.4)' }}></div>
             </div>
             <div className="relative">
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 40px rgba(255,107,107,0.3)', filter: 'blur(10px)' }}></div>
                <img src={oppAvatarSrc} className={cn("w-28 h-28 object-cover rounded-2xl border-3 border-[#FF6B6B]/30 relative z-10 transition-all duration-300", enemyHp <= 0 ? "grayscale opacity-40 rotate-12 scale-75" : "hover:scale-105" )} style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.4)' }} />
             </div>
          </div>

          {/* VS Divider */}
          <div className="flex justify-center">
             <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #9D4EDD, #4A90E2)', boxShadow: '0 0 30px rgba(157,78,221,0.5), inset 0 2px 4px rgba(255,255,255,0.2)' }}>
                <Swords size={26} className="text-white" />
             </div>
          </div>

          {/* Player */}
          <div className="flex flex-col items-center gap-3">
             <div className="relative">
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 40px rgba(74,144,226,0.3)', filter: 'blur(10px)' }}></div>
                <img src={myAvatarSrc} className={cn("w-28 h-28 object-cover rounded-2xl border-3 border-[#4A90E2]/30 relative z-10 transition-all duration-300", myHp <= 0 ? "grayscale opacity-40 -rotate-12 scale-75" : "hover:scale-105" )} style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.4)' }} />
             </div>
             <div className="w-full max-w-sm h-5 bg-[#1A1A30] rounded-full border border-[#6BCB77]/20 overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-[#6BCB77] to-[#4DA85A] transition-all duration-300 rounded-full" style={{ width: `${myHp}%`, boxShadow: '0 0 12px rgba(107,203,119,0.4)' }}></div>
             </div>
             <div className="flex w-full max-w-sm justify-between items-start px-2">
                <span className="text-[#6BB5FF] font-black text-lg drop-shadow-md">{user.playerName || t('multiplayer.me')}</span>
                <span className="text-[#A0A0BE] font-bold text-sm">{myHp} HP</span>
             </div>
          </div>
       </div>

       {/* Interaction UI */}
       <div className="z-10 p-5 rounded-t-[2rem] border-t-2 border-[#9D4EDD]/20 flex flex-col items-center" style={{ background: 'linear-gradient(180deg, #1A1A30F0, #1A1A30)', boxShadow: '0 -10px 40px rgba(0,0,0,0.4)' }}>

          {gameState === 'STARTING' && (
             <div className="text-center py-8">
                <h3 className="text-8xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-b from-[#FFD93D] to-[#FF6B6B] animate-pulse" style={{ filter: 'drop-shadow(0 0 30px rgba(255,217,61,0.5))' }}>{countdown}</h3>
             </div>
          )}

          {gameState === 'PLAYING' && problem && (
             <div className="w-full max-w-md flex flex-col items-center gap-4 py-2 relative">
                {isLocked && (
                   <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-[#FF6B6B]/30" style={{ background: '#1A1A30E0', backdropFilter: 'blur(4px)' }}>
                      <div className="flex flex-col items-center gap-2">
                         <Frown size={40} className="text-[#FF6B6B] animate-bounce" style={{ filter: 'drop-shadow(0 0 15px rgba(255,107,107,0.6))' }} />
                         <span className="font-black text-[#FF6B6B] tracking-widest text-lg bg-[#FF6B6B]/10 px-4 py-1 rounded-full border border-[#FF6B6B]/20">{Math.min(errorCount, 3)}{t('multiplayer.penalty')}</span>
                      </div>
                   </div>
                )}

                <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-white to-[#FFD93D] text-center tracking-wider mb-2">
                   {problem.a} x {problem.b} = ?
                </div>

                <div className="grid grid-cols-2 gap-3 w-full px-2">
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

          {gameState === 'WIN' && (
             <div
               className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-visible"
               style={{ background: '#1E1E2FE8', backdropFilter: 'blur(8px)' }}
             >
                <VictoryTrumpets className="z-[5]" />
                <Crown size={100} className="relative z-10 text-[#FFD93D] mb-6" style={{ filter: 'drop-shadow(0 0 40px rgba(255,217,61,0.7))' }} />
                <h1 className="relative z-10 text-6xl font-black font-headline shimmer-text mb-10 tracking-widest">{t('multiplayer.victory')}</h1>
                <button onClick={onQuit} className="relative z-10 px-8 py-4 rounded-2xl font-black text-xl tracking-wider text-white border-2 border-[#FFD93D]/30 transition-all active:scale-95" style={{ background: 'linear-gradient(180deg, #FFD93D20, #1A1A30)', boxShadow: '0 0 25px rgba(255,217,61,0.15)' }}>
                   {t('multiplayer.backToMap')}
                </button>
             </div>
          )}

          {gameState === 'LOSE' && (
             <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: '#1E1E2FF0', backdropFilter: 'blur(8px)' }}>
                <Frown size={90} className="text-[#5A5A78] mb-6" style={{ filter: 'drop-shadow(0 0 20px rgba(90,90,120,0.5))' }} />
                <h1 className="text-6xl font-black font-headline text-[#5A5A78] mb-10 tracking-widest">{t('multiplayer.defeat')}</h1>
                <button onClick={onQuit} className="px-8 py-4 rounded-2xl font-black text-xl tracking-wider text-white border-2 border-white/10 transition-all active:scale-95 bg-white/5 hover:bg-white/10">
                   {t('multiplayer.backToMap')}
                </button>
             </div>
          )}
       </div>
    </div>
  );
};
