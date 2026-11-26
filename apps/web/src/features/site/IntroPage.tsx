import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DifferentSlider } from './DifferentSlider';
import { LegalLinks } from './LegalLinks';
import { MakerWelcome, Shot, SiteHeader, Tag, TickList, WRAP } from './SiteChrome';
import { JOB_HUNTER_SOURCES } from './sources';

const H2 = 'text-3xl font-bold tracking-tight text-balance sm:text-4xl';

/**
 * The intro page, open to everyone at / and at /about (the i in the app's header). Top to
 * bottom: the maker's welcome (big desk photo, who built the app and why, Message / LinkedIn /
 * GitHub), the Job Market with its 40+ live sources and Apply, Autopilot, what makes it
 * different (a slider), Resume and Tracker, privacy, a last call to action, then Impressum ·
 * Privacy policy.
 */
export function IntroPage({ loggedIn, current }: { loggedIn: boolean; current?: 'about' }) {
  return (
    <div className="bg-white text-slate-900">
      <SiteHeader loggedIn={loggedIn} {...(current ? { current } : {})} />
      <main id="main">
        <IntroContent loggedIn={loggedIn} />
      </main>
    </div>
  );
}

/** The page's sections without a header, so the app can show them inside its own frame. */
export function IntroContent({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations('Site.about');
  return (
    <>
      <MakerWelcome title={t('title')} page loggedIn={loggedIn} />
      <div id="features" className="scroll-mt-4">
        <LiveSources />
        <Features keys={['apply']} />
      </div>
      <Autopilot />
      <WhatIsDifferent />
      <Features keys={['resume', 'tracker']} />
      <Trust />
      <FinalCall loggedIn={loggedIn} />
      <LegalLinks className={`${WRAP} py-6 text-center`} />
    </>
  );
}

const AUTOPILOT = [
  { key: 'kits', img: '/site/autopilot-kits.jpg', w: 704, h: 820 },
  { key: 'mail', img: '/site/autopilot-mail.jpg', w: 700, h: 262 },
  { key: 'calendar', img: null, w: 0, h: 0 },
  { key: 'weekly', img: '/site/autopilot-weekly.jpg', w: 700, h: 466 },
] as const;

/**
 * Autopilot, on black: four picture cards for what happens by itself once a saved search has
 * Autopilot on (ready kits, Gmail moving jobs, interviews in the calendar, briefing and weekly
 * report), and the promise that it never applies or sends anything.
 */
function Autopilot() {
  const t = useTranslations('Site.autopilot');
  return (
    <section aria-labelledby="autopilot-title" className="bg-black py-16 text-neutral-200">
      <div className={WRAP}>
        <span className="inline-block rounded bg-brand-400 px-2 py-0.5 text-xs font-bold tracking-wide text-black uppercase">
          {t('tag')}
        </span>
        <h2 id="autopilot-title" className={`mt-3 ${H2} text-white`}>
          {t('title')}
        </h2>
        <p className="mt-2 mb-8 max-w-prose text-neutral-300">{t('sub')}</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUTOPILOT.map(({ key, img, w, h }) => (
            <li
              key={key}
              className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
            >
              <div className="h-40 overflow-hidden bg-white text-slate-900">
                {img ? (
                  <img
                    src={img}
                    alt={t(`${key}Alt`)}
                    width={w}
                    height={h}
                    loading="lazy"
                    className="h-auto w-full"
                  />
                ) : (
                  <CalendarPicture />
                )}
              </div>
              <div className="p-3">
                <h3 className="font-bold text-brand-400">{t(`${key}Title`)}</h3>
                <p className="mt-1 text-sm text-neutral-300">{t(key)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-l-4 border-brand-400 pl-3 font-semibold text-white">
          {t('never')}
        </p>
      </div>
    </section>
  );
}

/** A small drawn calendar day with the interview on it. */
function CalendarPicture() {
  const t = useTranslations('Site.autopilot');
  return (
    <div
      className="p-3 text-xs"
      role="img"
      aria-label={`${t('calendarEvent')}, ${t('calendarWhen')}`}
    >
      <p className="mb-2 font-bold">{t('calendarDay')}</p>
      <p className="border-t border-slate-200 py-1.5 text-slate-500">09:00</p>
      <p className="rounded border-l-4 border-brand-400 bg-amber-50 px-2 py-1.5">
        <b>{t('calendarEvent')}</b>
        <br />
        {t('calendarWhen')}
      </p>
      <p className="mt-1.5 border-t border-slate-200 py-1.5 text-slate-500">12:00</p>
    </div>
  );
}

function WhatIsDifferent() {
  const t = useTranslations('Site.unique');
  return (
    <section aria-labelledby="unique-title" className="py-16">
      <div className={WRAP}>
        <h2 id="unique-title" className={H2}>
          {t('title')}
        </h2>
        <p className="mt-2 mb-8 max-w-prose text-slate-600">{t('sub')}</p>
        <DifferentSlider />
      </div>
    </section>
  );
}

/**
 * The Job Market and the 40+ live sources, in one section: the text and the form side by side,
 * then the three lists of sources under both.
 */
function LiveSources() {
  const t = useTranslations('Site.sourceList');
  const tf = useTranslations('Site.features');
  const groups = [
    { key: 'boards', names: JOB_HUNTER_SOURCES.boards },
    { key: 'public', names: JOB_HUNTER_SOURCES.public },
    { key: 'ats', names: JOB_HUNTER_SOURCES.ats },
  ] as const;
  return (
    <section aria-labelledby="sources-title" className="py-16">
      <div className={WRAP}>
        <div className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-5">
            <Tag>{tf('marketTag')}</Tag>
            <h2 id="sources-title" className={`mt-3 ${H2}`}>
              {t('title')}
            </h2>
            <p className="mt-2 max-w-prose text-slate-600">{t('sub')}</p>
            <TickList items={[tf('market1'), tf('market2'), tf('market3')]} />
          </div>
          <div className="md:col-span-7">
            <Shot src="/site/job-market.jpg" alt={tf('marketAlt')} width={1100} height={548} />
          </div>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {groups.map(({ key, names }) => (
            <div key={key} className="border-t-[3px] border-brand-400 pt-3">
              <h3 className="flex items-baseline gap-2 font-bold">
                {t(key)}
                <span className="rounded-full bg-black px-2 text-xs text-brand-400">
                  {names.length}
                </span>
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-700">{names.join(' · ')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { key: 'apply', img: '/site/apply.jpg', h: 773 },
  { key: 'resume', img: '/site/resume-designs.jpg', h: 247 },
  { key: 'tracker', img: '/site/tracker.jpg', h: 773 },
] as const;

type FeatureKey = (typeof FEATURES)[number]['key'];

/** Feature blocks, grey and white in turn, the picture switching sides. */
function Features({ keys }: { keys: readonly FeatureKey[] }) {
  const t = useTranslations('Site.features');
  return (
    <>
      {FEATURES.filter(({ key }) => keys.includes(key)).map(({ key, img, h }, i) => {
        const flip = i % 2 === 1;
        return (
          <section
            key={key}
            aria-labelledby={`${key}-title`}
            className={`py-16 ${flip ? 'bg-white' : 'bg-slate-100'}`}
          >
            <div className={`${WRAP} grid items-center gap-8 md:grid-cols-12 md:gap-12`}>
              <div className={`md:col-span-5 ${flip ? 'md:order-2' : ''}`}>
                <Tag>{t(`${key}Tag`)}</Tag>
                <h2
                  id={`${key}-title`}
                  className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl"
                >
                  {t(`${key}Title`)}
                </h2>
                <TickList items={[t(`${key}1`), t(`${key}2`), t(`${key}3`)]} />
              </div>
              <div className="md:col-span-7">
                {key === 'resume' ? (
                  <img
                    src={img}
                    alt={t(`${key}Alt`)}
                    width={1400}
                    height={h}
                    loading="lazy"
                    className="h-auto w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <Shot src={img} alt={t(`${key}Alt`)} width={1100} height={h} />
                )}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}

function Trust() {
  const t = useTranslations('Site.trust');
  const items = [1, 2, 3, 4] as const;
  return (
    <section aria-labelledby="trust-title" className="bg-black py-16 text-neutral-200">
      <div className={`${WRAP} grid items-center gap-10 md:grid-cols-[1fr_260px]`}>
        <div>
          <h2 id="trust-title" className={`${H2} text-white`}>
            {t('title')}
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {items.map((n) => (
              <div key={n}>
                <h3 className="font-bold text-brand-400">{t(`t${n}Title`)}</h3>
                <p className="mt-1 text-neutral-300">{t(`t${n}`)}</p>
              </div>
            ))}
          </div>
        </div>
        <img
          src="/site/phone-app.jpg"
          alt={t('phoneAlt')}
          width={520}
          height={885}
          loading="lazy"
          className="mx-auto w-56 rounded-[1.8rem] border-8 border-neutral-800 md:w-full"
        />
      </div>
    </section>
  );
}

/** Visitors are asked to sign up; someone logged in goes back to My Jobs. */
function FinalCall({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations('Site');
  return (
    <section className="bg-brand-400 py-14 text-center">
      <div className={WRAP}>
        <h2 className={H2}>{t('final.title')}</h2>
        <p className="mx-auto mt-3 max-w-prose">{t('final.text')}</p>
        <Link
          href={loggedIn ? '/jobs' : '/signup'}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-black px-6 py-3 font-bold text-brand-400 hover:bg-neutral-800 sm:w-auto"
        >
          {loggedIn ? t('nav.openApp') : t('hero.cta')}
        </Link>
      </div>
    </section>
  );
}
