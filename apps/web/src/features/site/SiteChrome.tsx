import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { FlagStripe } from '@/components/FlagStripe';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { MakerLine } from '@/components/MakerLine';
import { APP_NAME } from '@/lib/app-name';
import { MAKER } from '@/lib/maker';

/*
 * The pieces the public pages share: the black header, the footer, and the small parts the
 * intro and About us pages repeat (a screenshot in a browser frame, a gold-ticked list).
 */

export const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-10';
const GOLD =
  'inline-flex items-center justify-center rounded-lg bg-brand-400 font-bold whitespace-nowrap text-black hover:bg-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black';
export const GOLD_BUTTON = `${GOLD} px-5 py-3`;
/** The smaller gold button in the header. */
const GOLD_SMALL = `${GOLD} px-2.5 py-1.5 text-sm sm:px-3`;
const LINE_BUTTON =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-50';

/**
 * The black bar with the logo, the page links, EN | DE and Log in / Sign up. When you are
 * already logged in, one button takes you to My Jobs instead.
 */
export function SiteHeader({ loggedIn, current }: { loggedIn: boolean; current?: 'about' }) {
  const t = useTranslations('Site.nav');
  return (
    <>
      <header className="bg-flag-black text-white">
        <div className={`${WRAP} flex h-16 items-center gap-2 sm:gap-3`}>
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-md font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            <Logo onDark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span className="truncate text-sm sm:text-base">{APP_NAME}</span>
          </Link>
          <nav aria-label={t('main')} className="ml-6 hidden lg:block">
            <ul className="flex gap-6 text-sm text-neutral-300">
              <li>
                <Link href="/#how" className="hover:text-white">
                  {t('how')}
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-white">
                  {t('features')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  aria-current={current === 'about' ? 'page' : undefined}
                  className="hover:text-white aria-[current=page]:border-b-2 aria-[current=page]:border-brand-400 aria-[current=page]:text-white"
                >
                  {t('about')}
                </Link>
              </li>
            </ul>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageSwitch onDark />
            {loggedIn ? (
              <Link href="/jobs" className={GOLD_SMALL}>
                {t('openApp')}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-lg border border-neutral-600 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-800 sm:inline-flex"
                >
                  {t('logIn')}
                </Link>
                <Link href="/signup" className={GOLD_SMALL}>
                  {t('signUp')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <FlagStripe afterBlack />
    </>
  );
}

/** The bottom of the public pages: the maker line, About us and GitHub. */
export function SiteFooter() {
  const t = useTranslations('Site.nav');
  return (
    <footer className="border-t border-slate-200 bg-white py-6">
      <div className={`${WRAP} flex flex-wrap items-center gap-x-6 gap-y-3`}>
        <span className="text-sm text-slate-600">© 2026 {APP_NAME}</span>
        <MakerLine />
        <span className="flex-1" />
        <Link href="/about" className="text-sm text-slate-600 hover:text-black">
          {t('about')}
        </Link>
        <a
          href={MAKER.github}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-slate-600 hover:text-black"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}

/** A screenshot in a light browser frame. */
export function Shot({ src, alt, width, height }: ShotProps) {
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xl">
      <div
        aria-hidden="true"
        className="flex gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
      </div>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className="block h-auto w-full"
      />
    </figure>
  );
}

interface ShotProps {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** A list with a gold tick in front of each line. */
export function TickList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 grid gap-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-slate-700">
          <span
            aria-hidden="true"
            className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-brand-400 text-[10px] font-black text-black"
          >
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** A small black label with gold text above a heading ("JOB MARKET"). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded bg-black px-2 py-0.5 text-xs font-bold tracking-wide text-brand-400 uppercase">
      {children}
    </span>
  );
}

/** LinkedIn and GitHub buttons. LinkedIn only shows when its address is set. */
export function MakerLinks() {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {MAKER.linkedin && (
        <a href={MAKER.linkedin} target="_blank" rel="noreferrer" className={LINE_BUTTON}>
          LinkedIn
        </a>
      )}
      <a href={MAKER.github} target="_blank" rel="noreferrer" className={LINE_BUTTON}>
        GitHub
      </a>
    </div>
  );
}
