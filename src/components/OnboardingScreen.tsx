import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, User, Rocket, FileText } from 'lucide-react';
import { UserState } from '../types';
import { cn } from '../lib/utils';
import { AVATARS } from '../constants';
import { LegalDocumentsModal } from './LegalDocumentsModal';

interface Props {
  user: UserState;
  onComplete: (name: string) => void;
}

export const OnboardingScreen = ({ user, onComplete }: Props) => {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState('');
  const [legalOpen, setLegalOpen] = useState(false);

  const mascot = AVATARS.find((a) => a.id === user.selectedAvatar) || AVATARS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accepted && name.trim().length > 0) {
      onComplete(name.trim());
    }
  };

  return (
    <>
      <LegalDocumentsModal open={legalOpen} onClose={() => setLegalOpen(false)} />

      <div className="min-h-screen bg-[#1E1E2F] flex flex-col items-center justify-center p-6 relative overflow-hidden z-[300]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(157,78,221,0.15)_0%,transparent_60%)] pointer-events-none"></div>

        <div className="w-full max-w-md bg-gradient-to-br from-[#2A2A45] to-[#222238] p-8 md:p-10 rounded-[2.5rem] shadow-[0_0_40px_rgba(74,144,226,0.15)] border-2 border-[#9D4EDD]/30 relative z-10 flex flex-col items-center max-h-[min(100vh-2rem,900px)] overflow-y-auto">
          <div className="w-32 h-32 mb-6 floating-character shadow-[0_0_20px_rgba(255,217,61,0.5)] rounded-full border-4 border-[#FFD93D] overflow-hidden bg-[#1A1A30] shrink-0">
            <img src={mascot.image} className="w-full h-full object-cover scale-125 pt-2" alt="Mascot" />
          </div>

          <h1 className="font-headline text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6BB5FF] via-[#C77DFF] to-[#FFD93D] text-center mb-6 drop-shadow-md shrink-0">
            {t('welcomeOnboarding')}
          </h1>

          <form onSubmit={handleSubmit} className="w-full flex flex-col space-y-5">
            <div className="bg-[#1A1A30] p-4 rounded-2xl border border-[#6BCB77]/25 space-y-3">
              <h3 className="font-headline font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                <ShieldCheck className="text-[#6BCB77]" size={18} />
                {t('legalNoticeTitle')}
              </h3>
              <p className="text-sm text-[#D4D4E8] leading-relaxed">{t('legalCriticalNotice')}</p>
            </div>

            <div className="bg-[#1A1A30] p-4 rounded-2xl border border-white/5 space-y-3">
              <h3 className="font-headline font-bold text-white flex items-center gap-2">
                <FileText className="text-[#6BB5FF]" size={20} />
                {t('termsTitle')}
              </h3>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-1 shrink-0">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="peer appearance-none w-6 h-6 border-2 border-[#6BB5FF] rounded-md checked:bg-[#6BB5FF] transition-all cursor-pointer"
                  />
                  <ShieldCheck size={16} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                <span className="text-sm text-[#A0A0BE] group-hover:text-white transition-colors select-none leading-relaxed">
                  {t('legalAcceptCheckbox')}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setLegalOpen(true)}
                className="w-full text-left text-sm font-bold text-[#6BB5FF] hover:text-[#93c5fd] underline underline-offset-2 decoration-[#6BB5FF]/50 transition-colors"
              >
                {t('legalViewFull')}
              </button>
            </div>

            <div
              className={cn(
                'transition-all duration-500 overflow-hidden space-y-4',
                accepted ? 'opacity-100 max-h-48' : 'opacity-30 max-h-0 pointer-events-none'
              )}
            >
              <h3 className="font-headline font-bold text-white flex items-center gap-2">
                <User className="text-[#FFD93D]" size={20} />
                {t('whatsYourName')}
              </h3>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('inputName')}
                maxLength={15}
                className="w-full bg-[#1A1A30] border-2 border-[#C77DFF]/50 rounded-2xl px-5 py-4 text-white font-headline text-2xl font-black placeholder:text-[#5A5A78] focus:outline-none focus:border-[#C77DFF] focus:shadow-[0_0_15px_rgba(199,125,255,0.4)] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={!accepted || name.trim().length === 0}
              className="mt-2 w-full bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] text-white font-black text-2xl py-4 rounded-2xl shadow-[0_6px_0_0_#2A5090,0_0_20px_rgba(74,144,226,0.3)] disabled:opacity-50 disabled:grayscale disabled:shadow-none hover:brightness-110 active:translate-y-1 active:shadow-[0_2px_0_0_#2A5090] transition-all flex items-center justify-center gap-2 uppercase shrink-0"
            >
              {t('playLetGo')} <Rocket size={24} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
