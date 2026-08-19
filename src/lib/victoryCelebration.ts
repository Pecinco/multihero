import confetti from 'canvas-confetti';
import { audio } from './audio';
import { isAndroidWebViewRuntime } from './runtime';

export const VICTORY_CONFETTI_COLORS = [
  '#4A90E2',
  '#FFD93D',
  '#6BCB77',
  '#9D4EDD',
  '#FF6B6B',
  '#FFE066',
  '#4ECDC4',
] as const;

type SafeBurstOptions = {
  pieces?: number;
  originX?: number;
  originY?: number;
};

function launchDomConfetti({ pieces = 24, originX = 0.5, originY = 0.58 }: SafeBurstOptions = {}) {
  if (typeof document === 'undefined') return;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  const colors = [...VICTORY_CONFETTI_COLORS];
  for (let i = 0; i < pieces; i++) {
    const el = document.createElement('span');
    const size = 6 + Math.random() * 8;
    const angle = (-80 + Math.random() * 160) * (Math.PI / 180);
    const distance = 80 + Math.random() * 170;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - (40 + Math.random() * 80);
    const rot = (Math.random() - 0.5) * 640;
    const dur = 700 + Math.random() * 450;
    const delay = Math.random() * 90;

    el.style.position = 'absolute';
    el.style.left = `${originX * 100}%`;
    el.style.top = `${originY * 100}%`;
    el.style.width = `${size}px`;
    el.style.height = `${size * 0.7}px`;
    el.style.borderRadius = '2px';
    el.style.background = colors[i % colors.length];
    el.style.opacity = '0.95';
    el.style.transform = 'translate(-50%, -50%)';
    container.appendChild(el);

    el.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.55}px)) rotate(${rot * 0.55}deg)`, opacity: 0.95, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 120}px)) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: dur, delay, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards' }
    );
  }

  window.setTimeout(() => container.remove(), 1600);
}

export function launchSafeConfetti(opts?: SafeBurstOptions) {
  if (isAndroidWebViewRuntime()) {
    launchDomConfetti(opts);
    return;
  }
  launchVictoryConfetti();
}

/** Confeti “grande” desde los lados y el centro (acompaña trompetas / fanfarria). */
export function launchVictoryConfetti() {
  const base = {
    colors: [...VICTORY_CONFETTI_COLORS],
    startVelocity: 38,
    gravity: 0.92,
    ticks: 220,
    scalar: 1.08,
  };
  confetti({ ...base, particleCount: 90, spread: 58, origin: { x: 0.12, y: 0.62 } });
  confetti({ ...base, particleCount: 90, spread: 58, origin: { x: 0.88, y: 0.62 } });
  confetti({ ...base, particleCount: 110, spread: 72, origin: { x: 0.5, y: 0.52 } });
  window.setTimeout(() => {
    confetti({ ...base, particleCount: 85, spread: 100, origin: { x: 0.5, y: 0.28 } });
  }, 280);
}

export function runVictoryCelebration() {
  launchSafeConfetti();
  audio.playVictoryFanfare();
}
