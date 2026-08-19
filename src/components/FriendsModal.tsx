import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Copy, Plus, X, Swords } from 'lucide-react';
import { UserState } from '../types';
import { cn } from '../lib/utils';
import { AVATARS } from '../constants';
import { isFriendOnline } from '../lib/multiplayerUtils';
import type { MultiplayerConnection, ConnectionErrorCode } from '../hooks/useMultiplayer';

interface Props {
  user: UserState;
  myFriendCode?: string;
  connections: MultiplayerConnection[];
  connectToFriend: (id: string) => void;
  onClose: () => void;
  onBattleFriend: (friendId: string) => void;
  errorCode?: ConnectionErrorCode | null;
}

export const FriendsModal = ({ user, myFriendCode, connections, connectToFriend, onClose, onBattleFriend, errorCode }: Props) => {
  const { t } = useTranslation();
  const [friendCode, setFriendCode] = useState('');
  const [copied, setCopied] = useState(false);

  const displayCode = [myFriendCode, user.friendCode].map((s) => (typeof s === 'string' ? s.trim() : '')).find((s) => s.length > 0) || '';

  const handleCopy = () => {
    if (displayCode) {
      navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const friends = user.friends || [];

  return (
    <div className="fixed inset-0 z-[200] bg-[#1E1E2F]/90 backdrop-blur-md flex flex-col items-center justify-center p-6">
      
      <div className="w-full max-w-lg bg-gradient-to-br from-[#2A2A45] to-[#222238] p-8 rounded-[2rem] shadow-[0_0_40px_rgba(74,144,226,0.15)] border-2 border-[#4A90E2]/30 relative flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors">
           <X size={24} />
        </button>

        <h2 className="font-headline text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] to-[#C77DFF] text-center mb-4 drop-shadow-md flex items-center justify-center gap-3">
          <Users className="text-[#6BB5FF]" size={36} />
          {t('multiplayer.screenTitle')}
        </h2>
        <p className="text-[#A0A0BE] text-xs font-bold text-center mb-4 px-2 leading-relaxed">{t('multiplayer.friendRequestsHint')}</p>

        {errorCode === 'notReady' && (
          <p className="text-[#FF6B6B] text-xs font-bold text-center mb-3">{t('multiplayer.connectionErrors.notReady')}</p>
        )}
        {errorCode === 'connectSelf' && (
          <p className="text-[#FF6B6B] text-xs font-bold text-center mb-3">{t('multiplayer.connectionErrors.connectSelf')}</p>
        )}
        {errorCode === 'invalidFriendCode' && (
          <p className="text-[#FF6B6B] text-xs font-bold text-center mb-3">{t('multiplayer.connectionErrors.invalidFriendCode')}</p>
        )}

        {/* My Code */}
        <div className="bg-[#1A1A30] p-4 rounded-xl border border-white/5 mb-6 text-center space-y-2">
           <p className="text-[#A0A0BE] font-bold text-sm uppercase tracking-widest">{t('multiplayer.myHeroCode')}</p>
           <div className="flex items-center justify-center gap-3">
              <span className="font-headline font-black text-3xl text-white tracking-widest bg-white/5 px-4 py-2 rounded-lg border-2 border-white/10">
                 {displayCode || '...'}
              </span>
              <button 
                onClick={handleCopy}
                className="p-3 bg-[#4A90E2]/20 text-[#6BB5FF] rounded-lg hover:bg-[#4A90E2] hover:text-white transition-colors border border-[#4A90E2]/30"
              >
                <Copy size={24} />
              </button>
           </div>
           {copied && <span className="text-[#6BCB77] text-xs font-black animate-pulse uppercase">{t('copied')}</span>}
        </div>

        {/* Add Friend */}
        <div className="flex gap-2 mb-8">
           <input 
              type="text" 
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
              placeholder={t('multiplayer.enterFriendCode')}
              maxLength={9}
              className="flex-1 bg-[#1A1A30] border-2 border-[#C77DFF]/30 rounded-xl px-4 py-3 text-white font-headline text-xl font-bold placeholder:text-[#5A5A78] focus:outline-none focus:border-[#C77DFF] transition-all uppercase"
           />
           <button 
              onClick={() => {
                 connectToFriend(friendCode);
                 setFriendCode('');
              }}
              disabled={friendCode.length < 9}
              className="bg-gradient-to-br from-[#C77DFF] to-[#9D4EDD] text-white px-6 rounded-xl font-black text-xl hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center shadow-lg"
           >
              <Plus size={28} />
           </button>
        </div>

        {/* Friend List */}
        <div className="flex-1 overflow-y-auto max-h-64 space-y-3 pr-2">
           <p className="text-[#A0A0BE] font-bold text-sm uppercase tracking-widest">{t('multiplayer.friendList')}</p>
           {friends.length === 0 ? (
              <div className="text-center bg-white/5 p-6 rounded-2xl border border-white/5 border-dashed">
                 <p className="text-[#5A5A78] font-bold">{t('multiplayer.noHeroesFound')}</p>
              </div>
           ) : (
              friends.map(f => {
                 const isOnline = isFriendOnline(connections, f.id);
                 const avatarSrc = AVATARS.find(a => a.id === f.avatar)?.image || AVATARS[0].image;

                 return (
                    <div key={f.id} className="flex items-center justify-between bg-[#1A1A30] p-3 rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                       <div className="flex items-center gap-3">
                          <div className="relative">
                             <img src={avatarSrc} className="w-12 h-12 object-cover rounded-xl bg-white/5 border-2 border-white/10" />
                             <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1A1A30] z-10", isOnline ? "bg-[#6BCB77]" : "bg-[#5A5A78]")}></div>
                          </div>
                          <div>
                             <p className="font-headline font-black text-white text-lg leading-tight">{f.name}</p>
                             <p className="text-xs text-[#A0A0BE] font-bold uppercase tracking-widest">{t('mapLevelShort')} {f.level}</p>
                          </div>
                       </div>
                       
                       <button 
                          onClick={() => onBattleFriend(f.id)}
                          disabled={!isOnline}
                          className="w-10 h-10 bg-gradient-to-br from-[#FF6B6B] to-[#D94545] text-white rounded-xl flex items-center justify-center hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-md active:scale-90"
                          title={isOnline ? t('multiplayer.duel') : t('multiplayer.offline')}
                       >
                          <Swords size={20} />
                       </button>
                    </div>
                 );
              })
           )}
        </div>

      </div>
    </div>
  );
};
