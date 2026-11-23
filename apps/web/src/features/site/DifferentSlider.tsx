'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

const SLIDES = [
  { img: '/site/missing-skills.jpg', w: 760, h: 263 },
  { img: '/site/scam-check.jpg', w: 760, h: 297 },
  { img: '/site/alerts.jpg', w: 760, h: 560 },
  { img: '/site/salary.jpg', w: 760, h: 396 },
] as const;

/** How long each picture shows before the next one, until someone clicks. */
export const SLIDE_MS = 5000;

const ARROW =
  'absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black text-xl text-brand-400 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:flex';

/**
 * "What makes it different" as a slider: the four titles are tabs above one big, clear
 * picture (arrows on wider screens; on a phone the tabs are enough). It moves on by itself every 5 s and stops for good once you click a tab or an
 * arrow (and never moves for people who asked for less motion). ← and → move between tabs.
 */
export function DifferentSlider() {
  const t = useTranslations('Site.unique');
  const id = useId();
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const still =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!auto || still) return;
    const timer = window.setInterval(() => {
      setAt((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [auto]);

  const pick = (index: number, focus = false) => {
    const next = (index + SLIDES.length) % SLIDES.length;
    setAuto(false);
    setAt(next);
    if (focus) tabs.current[next]?.focus();
  };
  const onKey = (event: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const by = step[event.key];
    if (by === undefined) return;
    event.preventDefault();
    pick(at + by, true);
  };

  const slide = SLIDES[at] ?? SLIDES[0];
  const n = at + 1;
  return (
    <div>
      <div
        role="tablist"
        aria-label={t('title')}
        className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
      >
        {SLIDES.map((_, i) => (
          <button
            key={i}
            ref={(element) => {
              tabs.current[i] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === at}
            aria-controls={`${id}-panel`}
            tabIndex={i === at ? 0 : -1}
            onClick={() => {
              pick(i);
            }}
            onKeyDown={onKey}
            className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-bold hover:border-slate-400 aria-selected:border-black aria-selected:bg-black aria-selected:text-white sm:px-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-xs font-black text-brand-400 group-aria-selected:bg-brand-400 group-aria-selected:text-black">
              {i + 1}
            </span>
            {t(`u${i + 1}Title`)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${at}`}
        className="relative mt-4 flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 sm:h-[28rem] sm:px-20 sm:py-6"
      >
        <button
          type="button"
          aria-label={t('previous')}
          onClick={() => {
            pick(at - 1);
          }}
          className={`${ARROW} left-2 sm:left-4`}
        >
          ‹
        </button>
        <img
          key={slide.img}
          src={slide.img}
          alt={t(`u${n}Alt`)}
          width={slide.w}
          height={slide.h}
          className="max-h-full max-w-full rounded-lg object-contain shadow-xl"
        />
        <button
          type="button"
          aria-label={t('next')}
          onClick={() => {
            pick(at + 1);
          }}
          className={`${ARROW} right-2 sm:right-4`}
        >
          ›
        </button>
      </div>
      <div aria-hidden="true" className="mt-3 flex justify-center gap-2">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full ${i === at ? 'w-6 bg-black' : 'w-2 bg-slate-300'}`}
          />
        ))}
      </div>
    </div>
  );
}
