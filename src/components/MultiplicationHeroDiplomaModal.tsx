import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type DiplomaModalProps = {
  initialName?: string;
  onClose: () => void;
};

const DIPLOMA_TEMPLATE_PATH = '/DIPLOMA.png';
const DIPLOMA_WIDTH = 1376;
const DIPLOMA_HEIGHT = 768;
const NAME_X = DIPLOMA_WIDTH / 2;
const NAME_Y = 360;
const DATE_X = DIPLOMA_WIDTH / 2;
const DATE_Y = 515;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen base'));
    img.src = src;
  });
}

async function drawDiplomaCanvas(childName: string, templateSrc: string, locale: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = DIPLOMA_WIDTH;
  canvas.height = DIPLOMA_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const safeName = childName.trim() || 'Peque Heroe';
  const today = new Date().toLocaleDateString(locale);

  const template = await loadImage(templateSrc);
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  // Solo texto dinámico: nombre + fecha (sin sobreponer titulares del diploma base)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Nombre
  ctx.font = '900 55px Arial';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 14;
  ctx.strokeText(safeName.toUpperCase(), NAME_X, NAME_Y);
  ctx.fillStyle = '#243b8f';
  ctx.fillText(safeName.toUpperCase(), NAME_X, NAME_Y);

  // Fecha
  ctx.font = '700 42px Arial';
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 10;
  ctx.strokeText(today, DATE_X, DATE_Y);
  ctx.fillStyle = '#7a3a17';
  ctx.fillText(today, DATE_X, DATE_Y);

  return canvas;
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar el diploma'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export function MultiplicationHeroDiplomaModal({ initialName, onClose }: DiplomaModalProps) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(initialName?.trim() || '');
  const [busy, setBusy] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');

  const fileName = `diploma-heroe-multiplicaciones-${(name.trim() || 'nino').replace(/\s+/g, '-').toLowerCase()}.png`;
  const localeMap: Record<string, string> = {
    Spanish: 'es-ES',
    Catalan: 'ca-ES',
    English: 'en-US',
    French: 'fr-FR',
  };
  const dateLocale = localeMap[i18n.language] || 'es-ES';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = await drawDiplomaCanvas(name, DIPLOMA_TEMPLATE_PATH, dateLocale);
        if (!cancelled) {
          setPreviewDataUrl(canvas.toDataURL('image/png'));
        }
      } catch {
        if (!cancelled) {
          setPreviewDataUrl('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateLocale, name]);

  const buildBlob = async () => {
    const canvas = await drawDiplomaCanvas(name, DIPLOMA_TEMPLATE_PATH, dateLocale);
    return canvasToPngBlob(canvas);
  };

  const downloadDiploma = async () => {
    setBusy(true);
    try {
      const blob = await buildBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const shareDiploma = async () => {
    setBusy(true);
    try {
      const blob = await buildBlob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const shareText = t('diplomaShareText', {
        name: name.trim() || t('diplomaShareTextFallbackName'),
      });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (navigator.share && nav.canShare?.({ files: [file] })) {
        await navigator.share({
          title: t('diplomaTitle'),
          text: shareText,
          files: [file],
        });
        return;
      }

      const waText = encodeURIComponent(`${shareText} ${t('diplomaShareAfterDownload')}`);
      window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener,noreferrer');
      window.location.href = `mailto:?subject=${encodeURIComponent(t('diplomaMailSubject'))}&body=${encodeURIComponent(t('diplomaMailBody'))}`;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-3xl rounded-3xl border-2 border-[#fbbf24]/60 bg-[#1A1A30] p-5 shadow-2xl">
        <h2 className="text-center font-headline text-2xl font-black uppercase text-[#fde047] sm:text-3xl">
          {t('diplomaTitle')}
        </h2>

        <label className="mt-4 block text-sm font-bold text-white/85">
          {t('diplomaNameLabel')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('diplomaNamePlaceholder')}
            className="mt-2 w-full rounded-xl border border-white/20 bg-[#0f0f20] px-4 py-2.5 text-white outline-none focus:border-[#fbbf24]"
          />
        </label>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-white">
          {previewDataUrl ? (
            <img src={previewDataUrl} alt="Vista previa del diploma" className="h-auto w-full" />
          ) : (
            <div className="flex h-52 items-center justify-center text-sm font-bold text-[#1A1A30]/70">{t('diplomaPreviewLoading')}</div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              void downloadDiploma();
            }}
            disabled={busy}
            className="flex-1 rounded-2xl bg-gradient-to-b from-[#FFD93D] to-[#E6A800] py-3 font-headline text-base font-black uppercase text-[#3D2E00] shadow-[0_6px_0_#B88600] disabled:opacity-60"
          >
            {t('diplomaDownload')}
          </button>
          <button
            type="button"
            onClick={() => {
              void shareDiploma();
            }}
            disabled={busy}
            className="flex-1 rounded-2xl border-2 border-[#6BCB77]/50 bg-[#12301f] py-3 font-headline text-base font-black uppercase text-[#86efac] disabled:opacity-60"
          >
            {t('diplomaShare')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border-2 border-white/20 px-5 py-3 font-bold text-white/80"
          >
            {t('diplomaClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
