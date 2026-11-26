'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

/** A YouTube watch or short link becomes its embed link; any other link plays as a video file. */
export function embedUrl(url: string): string | null {
  const match = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(
    url,
  );
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1` : null;
}

/** A video file's captions sit next to it with the same name: demo.mp4 → demo.vtt. */
export function captionsUrl(url: string): string {
  return url.replace(/\.\w+(\?.*)?$/, '.vtt');
}

/**
 * The gold "Watch the 2-min demo" button in the maker's welcome. It opens the demo in a
 * pop-up player (YouTube or a plain video file). With no video link set, nothing shows.
 */
export function DemoButton({ url }: { url: string }) {
  const t = useTranslations('Site.demo');
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!url) return null;
  const embed = embedUrl(url);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold whitespace-nowrap text-black hover:bg-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      >
        <span aria-hidden="true">▶</span>
        {t('button')}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('close')}
            onClick={close}
            className="absolute inset-0 cursor-default bg-black/80"
          />
          <div className="relative w-full max-w-4xl">
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              className="absolute -top-10 right-0 rounded-lg bg-black px-3 py-1 text-sm font-bold text-brand-400 hover:bg-neutral-800"
            >
              {t('close')}
            </button>
            {embed ? (
              <iframe
                src={embed}
                title={t('title')}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full rounded-xl bg-black"
              />
            ) : (
              <video
                src={url}
                controls
                autoPlay
                aria-label={t('title')}
                className="aspect-video w-full rounded-xl bg-black"
              >
                <track
                  kind="captions"
                  src={captionsUrl(url)}
                  srcLang="en"
                  label="English"
                  default
                />
              </video>
            )}
          </div>
        </div>
      )}
    </>
  );
}
