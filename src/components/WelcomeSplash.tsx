import { Capacitor } from '@capacitor/core';
import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Recursos en `public/branding/` (servidos como /branding/...) */
export const BRANDING = {
  logoCaiman: '/branding/logocaiman.svg',
  welcomeVideo: '/branding/welcome.mp4',
  portada: '/branding/portada.png',
  /** PC / navegador, pantalla ancha y apaisada (16:9) */
  welcomeVideo169: '/branding/welcome169.mp4',
  portada169: '/branding/portada169.png',
  icon: '/branding/icon.png',
} as const;

const PC_LANDSCAPE_MQ = '(orientation: landscape) and (min-width: 1024px)';

/**
 * App nativa (Android/iOS) siempre usa portada / welcome verticales.
 * En el navegador, si la ventana es ancha y apaisada, versiones 16:9.
 */
function useWebWideLandscapeBranding(): boolean {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return false;
    return window.matchMedia(PC_LANDSCAPE_MQ).matches;
  });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setActive(false);
      return;
    }
    const mq = window.matchMedia(PC_LANDSCAPE_MQ);
    const onChange = () => setActive(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return active;
}

const LOGO_MS = 3000;
const COVER_MS = 4000;
/** Si el vídeo no termina (autoplay bloqueado, bucle, carga…), no bloquear toda la app. */
const MAX_VIDEO_WAIT_MS = 10000;

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

type Props = { onComplete: () => void };
type SplashPhase = 'logo' | 'cover' | 'video';

export function WelcomeSplash({ onComplete }: Props) {
  const [phase, setPhase] = useState<SplashPhase>('logo');
  const [videoDone, setVideoDone] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const finishedRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const use169 = useWebWideLandscapeBranding();
  const portadaSrc = use169 ? BRANDING.portada169 : BRANDING.portada;
  const welcomeVideoSrc = use169 ? BRANDING.welcomeVideo169 : BRANDING.welcomeVideo;

  useEffect(() => {
    setVideoReady(false);
  }, [use169]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    void Promise.all([
      preloadImage(BRANDING.logoCaiman),
      preloadImage(BRANDING.portada),
      preloadImage(BRANDING.portada169),
      preloadImage(BRANDING.icon),
    ]).then(() => setAssetsReady(true));
  }, []);

  useEffect(() => {
    if (!assetsReady) return;
    const t1 = window.setTimeout(() => setPhase('cover'), LOGO_MS);
    const t2 = window.setTimeout(() => setPhase('video'), LOGO_MS + COVER_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [assetsReady]);

  useEffect(() => {
    if (phase !== 'video') return;
    const forceVideo = window.setTimeout(() => {
      setVideoDone(true);
    }, MAX_VIDEO_WAIT_MS);
    return () => window.clearTimeout(forceVideo);
  }, [phase]);

  useEffect(() => {
    if (phase === 'video' && videoDone) {
      setFadeOut(true);
    }
  }, [phase, videoDone]);

  useEffect(() => {
    if (!fadeOut) return;
    const id = window.setTimeout(finish, 900);
    return () => clearTimeout(id);
  }, [fadeOut, finish]);

  return (
    <div
      className={`fixed inset-0 z-[500] bg-black transition-opacity duration-[380ms] ease-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden
      onTransitionEnd={(e) => {
        if (e.propertyName === 'opacity' && fadeOut) {
          finish();
        }
      }}
    >
      {phase === 'logo' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black p-8">
          <img
            src={BRANDING.logoCaiman}
            alt="Logo Caiman"
            className="h-auto w-full max-w-[22rem] object-contain"
            draggable={false}
          />
        </div>
      )}

      {phase === 'cover' && (
        <img
          src={portadaSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-contain bg-black"
          draggable={false}
        />
      )}

      {phase === 'video' && (
        <>
          <video
            key={use169 ? '169' : 'portrait'}
            className="absolute inset-0 h-full w-full object-contain bg-black"
            src={welcomeVideoSrc}
            poster={portadaSrc}
            autoPlay
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              setVideoReady(true);
              const v = e.currentTarget;
              v.muted = true;
              v.volume = 0.85;
              void v
                .play()
                .then(() => {
                  window.setTimeout(() => {
                    try {
                      v.muted = false;
                    } catch {
                      /* ignore */
                    }
                  }, 120);
                })
                .catch(() => {
                  setVideoDone(true);
                });
            }}
            onEnded={() => setVideoDone(true)}
            onError={() => setVideoDone(true)}
          />
          {!videoReady && (
            <img
              src={portadaSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-contain bg-black"
              draggable={false}
            />
          )}
        </>
      )}
    </div>
  );
}
