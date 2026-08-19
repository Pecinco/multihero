import React from 'react';
import { cn } from '../lib/utils';

/** Misma ilustración plana que enviaste (PNG en /public). */
const TRUMPET_SRC = '/img/victory-trumpet-flat.png';

function TrumpetSprite({ animationDelay }: { animationDelay: string }) {
  return (
    <div
      className="victory-trumpet-sprite-wrap inline-flex overflow-visible"
      style={{ animationDelay }}
    >
      <img
        src={TRUMPET_SRC}
        alt=""
        className={cn(
          'block w-auto select-none pointer-events-none',
          'h-[4.75rem] md:h-[6.25rem]',
          'max-w-[min(100%,15rem)] md:max-w-[min(100%,19rem)]'
        )}
        draggable={false}
      />
    </div>
  );
}

function TrumpetRow({ side }: { side: 'left' | 'right' }) {
  const flip = side === 'right';
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col justify-center gap-6 md:gap-9 py-6 md:py-8 bg-transparent',
        flip && 'scale-x-[-1]',
        side === 'left' ? 'items-start pl-3 md:pl-6' : 'items-end pr-3 md:pr-6'
      )}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'flex items-center justify-start overflow-visible min-h-[5rem] md:min-h-[6.5rem]',
            'w-[11rem] min-w-[11rem] md:w-[14rem] md:min-w-[14rem]',
            i === 1 && 'md:translate-x-1',
            i === 2 && 'md:translate-x-0.5'
          )}
        >
          <TrumpetSprite animationDelay={`${i * 0.12}s`} />
        </div>
      ))}
    </div>
  );
}

/**
 * Trompetas de victoria: recurso gráfico idéntico a tu referencia (flat, dorado).
 */
export function VictoryTrumpets({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-[8] flex justify-between items-stretch overflow-visible bg-transparent px-3 sm:px-5 md:px-10 py-4 md:py-6',
        className
      )}
      aria-hidden
    >
      <TrumpetRow side="left" />
      <TrumpetRow side="right" />
    </div>
  );
}
