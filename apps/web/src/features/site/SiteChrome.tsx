import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { FlagStripe } from '@/components/FlagStripe';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { MessageOpener } from '@/features/messages/MessageOpener';
import { APP_NAME } from '@/lib/app-name';
import { MAKER } from '@/lib/maker';
import { DemoButton } from './DemoButton';

/*
 * The pieces the public pages share: the black header, and the small parts the
 * intro and About us pages repeat (a screenshot in a browser frame, a gold-ticked list).
 */

export const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-10';
const GOLD =
  'inline-flex items-center justify-center rounded-lg bg-brand-400 font-bold whitespace-nowrap text-black hover:bg-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black';
/** The smaller gold button in the header. */
const GOLD_SMALL = `${GOLD} px-2.5 py-1.5 text-sm sm:px-3`;
/** On the gold contact band: black with gold text. */
const BLACK_BUTTON =
  'inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-bold whitespace-nowrap text-brand-400 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black';
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

/**
 * Message Mohamed (when `loggedIn` is given; a visitor logs in first), then LinkedIn and GitHub.
 * LinkedIn only shows when its address is set.
 */
export function MakerLinks({ loggedIn }: { loggedIn?: boolean | undefined }) {
  const t = useTranslations('Site.about');
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <DemoButton url={MAKER.demoVideo} />
      {loggedIn !== undefined && (
        <MessageOpener loggedIn={loggedIn} className={BLACK_BUTTON}>
          {t('messageButton', { name: MAKER.name })}
        </MessageOpener>
      )}
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

/**
 * The maker's welcome: the big desk photo on the left, then a title, two short paragraphs,
 * the sign-off and the buttons. The intro page opens with it, and so does About us.
 */
export function MakerWelcome({
  title,
  eyebrow,
  page = false,
  loggedIn,
}: {
  title: string;
  /** A small black label above the title (the intro page). */
  eyebrow?: string;
  /** On About us the title is the page's h1. */
  page?: boolean;
  /** Given: show the Message button (a visitor logs in first). */
  loggedIn?: boolean | undefined;
}) {
  const t = useTranslations('Site.message');
  const Heading = page ? 'h1' : 'h2';
  return (
    <section
      id="contact"
      aria-labelledby="maker-title"
      className="scroll-mt-4 border-b border-slate-200 bg-slate-100 py-12"
    >
      <div className={`${WRAP} grid items-center gap-8 md:grid-cols-[5fr_6fr] md:gap-12`}>
        <img
          src={MAKER.photo}
          alt={t('photoAlt')}
          width={1000}
          height={839}
          className="h-auto w-full rounded-2xl border-b-[6px] border-brand-400 shadow-xl"
        />
        <div>
          {eyebrow && <Tag>{eyebrow}</Tag>}
          <Heading
            id="maker-title"
            className={`${eyebrow ? 'mt-3 ' : ''}text-3xl font-bold tracking-tight text-balance sm:text-4xl`}
          >
            {title}
          </Heading>
          <p className="mt-3 max-w-prose text-slate-700">{t('p1')}</p>
          <p className="mt-3 max-w-prose text-slate-700">{t('p2')}</p>
          <p className="mt-3 font-bold italic">{t('sign')}</p>
          <MakerLinks loggedIn={loggedIn} />
        </div>
      </div>
    </section>
  );
}
