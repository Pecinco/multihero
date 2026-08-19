import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { getLegalDocuments } from '../legal/legalContent';

type Tab = 'terms' | 'privacy';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Si se indica, abre directamente esa pestaña */
  initialTab?: Tab;
};

export const LegalDocumentsModal = ({ open, onClose, initialTab = 'terms' }: Props) => {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { terms, privacy } = getLegalDocuments(i18n.language);
  const body = tab === 'terms' ? terms : privacy;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-gradient-to-br from-[#2A2A45] to-[#222238] rounded-[2rem] border-2 border-[#9D4EDD]/40 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 id="legal-modal-title" className="font-headline text-lg font-black text-white pr-2">
            {t('legalModalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1A1A30] border border-white/10 text-[#A0A0BE] hover:text-white hover:border-[#9D4EDD]/40 transition-colors"
            aria-label={t('legalClose')}
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex gap-2 px-4 pt-3 shrink-0">
          {(['terms', 'privacy'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 py-3 rounded-xl font-headline font-black text-sm transition-all',
                tab === id
                  ? 'bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] text-white shadow-[0_4px_0_0_#2A5090]'
                  : 'bg-[#1A1A30] text-[#A0A0BE] border border-white/10 hover:border-[#9D4EDD]/30'
              )}
            >
              {id === 'terms' ? t('legalTermsTab') : t('legalPrivacyTab')}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 text-[#D4D4E8] text-sm leading-relaxed whitespace-pre-wrap font-medium">
          {body}
        </div>

        <div className="p-4 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 rounded-2xl font-headline font-black text-white bg-gradient-to-b from-[#6BB5FF] to-[#4A90E2] shadow-[0_4px_0_0_#2A5090] active:translate-y-0.5 transition-transform"
          >
            {t('legalClose')}
          </button>
        </div>
      </div>
    </div>
  );
};
