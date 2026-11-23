import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DEMO_VIDEO_URL } from '@/lib/maker';
import { DifferentSlider } from './DifferentSlider';
import { GOLD_BUTTON, MakerWelcome, Shot, SiteHeader, Tag, TickList, WRAP } from './SiteChrome';
import { JOB_HUNTER_SOURCES } from './sources';

const H2 = 'text-3xl font-bold tracking-tight text-balance sm:text-4xl';

/**
 * The page people see before they log in (/). Top to bottom: a message from the maker, what
 * the app does with a big screenshot, the job sources, how it works, what makes it different
 * (a slider), the Job Market with its 40+ live sources, three features, privacy, and a last
 * Sign up button.
 */
export function IntroPage({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="bg-white text-slate-900">
      <SiteHeader loggedIn={loggedIn} />
      <main id="main">
        <MakerMessage />
        <Hero />
        <SourceChips />
        <HowItWorks />
        <WhatIsDifferent />
        <LiveSources />
        <Features />
        <Trust />
        <FinalCall />
      </main>
    </div>
  );
}

function MakerMessage() {
  const t = useTranslations('Site.message');
  return <MakerWelcome eyebrow={t('eyebrow')} title={t('title')} />;
}

function Hero() {
  const t = useTranslations('Site.hero');
  return (
    <section className="pt-14">
      <div className={WRAP}>
        <p className="text-sm font-bold tracking-wide text-slate-500 uppercase">{t('eyebrow')}</p>
        <h1 className="mt-3 max-w-[16ch] text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
          {t('titleStart')}{' '}
          <span className="bg-[linear-gradient(transparent_62%,var(--color-brand-400)_62%_92%,transparent_92%)]">
            {t('titleMark')}
          </span>{' '}
          {t('titleEnd')}
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg text-slate-700">{t('lead')}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className={`${GOLD_BUTTON} w-full sm:w-auto`}>
            {t('cta')}
          </Link>
          {DEMO_VIDEO_URL && (
            <a
              href={DEMO_VIDEO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50 sm:w-auto"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[10px] text-brand-400"
              >
                ▶
              </span>
              {t('watch')}
            </a>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-500">{t('fine')}</p>
        <div className="relative z-10 mt-10 -mb-16 sm:-mb-28">
          <Shot src="/site/my-jobs.jpg" alt={t('shotAlt')} width={1280} height={900} />
        </div>
      </div>
    </section>
  );
}

function SourceChips() {
  const t = useTranslations('Site.sources');
  const chip =
    'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold';
  return (
    <div className="border-b border-slate-200 bg-slate-100 pt-24 pb-8 sm:pt-36">
      <ul className={`${WRAP} flex flex-wrap items-center gap-3`} aria-label={t('label')}>
        <li
          className="mr-1 text-sm font-bold tracking-wide text-slate-500 uppercase"
          aria-hidden="true"
        >
          {t('label')}
        </li>
        <li className={chip}>
          Arbeitsagentur <small className="font-normal text-slate-500">{t('germany')}</small>
        </li>
        <li className={chip}>
          {t('careers')}{' '}
          <small className="font-normal text-slate-500">Greenhouse · Lever · Ashby</small>
        </li>
        <li className={chip}>
          JobHunter <small className="font-normal text-slate-500">{t('jobHunter')}</small>
        </li>
        <li className={chip}>{t('byHand')}</li>
      </ul>
    </div>
  );
}

function HowItWorks() {
  const t = useTranslations('Site.how');
  const steps = [1, 2, 3] as const;
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-4 py-16">
      <div className={WRAP}>
        <h2 id="how-title" className={H2}>
          {t('title')}
        </h2>
        <p className="mt-2 mb-8 text-slate-600">{t('sub')}</p>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((n) => (
            <li key={n} className="border-t-[3px] border-black pt-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400 text-sm font-black">
                {n}
              </span>
              <h3 className="mt-3 text-lg font-bold">{t(`s${n}Title`)}</h3>
              <p className="mt-1 text-slate-700">{t(`s${n}`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function WhatIsDifferent() {
  const t = useTranslations('Site.unique');
  return (
    <section aria-labelledby="unique-title" className="bg-slate-100 py-16">
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

function Features() {
  const t = useTranslations('Site.features');
  return (
    <div id="features" className="scroll-mt-4">
      {FEATURES.map(({ key, img, h }, i) => {
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
    </div>
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

function FinalCall() {
  const t = useTranslations('Site');
  return (
    <section className="bg-brand-400 py-14 text-center">
      <div className={WRAP}>
        <h2 className={H2}>{t('final.title')}</h2>
        <p className="mx-auto mt-3 max-w-prose">{t('final.text')}</p>
        <Link
          href="/signup"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-black px-6 py-3 font-bold text-brand-400 hover:bg-neutral-800 sm:w-auto"
        >
          {t('hero.cta')}
        </Link>
      </div>
    </section>
  );
}
