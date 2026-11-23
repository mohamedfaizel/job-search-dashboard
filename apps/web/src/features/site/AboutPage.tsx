import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { MakerWelcome, SiteHeader, WRAP } from './SiteChrome';

const STACK = ['Next.js', 'NestJS', 'PostgreSQL', 'Prisma', 'TypeScript'] as const;
const CARD = 'rounded-2xl border border-slate-200 bg-white p-5';

/** A card's heading, with a short gold bar in front. */
function CardTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 font-bold">
      <span aria-hidden="true" className="h-4 w-1 rounded-sm bg-brand-400" />
      {children}
    </h2>
  );
}

/**
 * About us: the maker's welcome on top (the big desk photo, who built the app and why, and the
 * Message / LinkedIn / GitHub buttons, as on the intro page), then the story, the values and
 * the technology side by side in three cards. Logged in, the page sits inside the app's own header (see
 * app/about/page.tsx); a visitor sees the public header.
 */
export function AboutContent({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations('Site.about');
  const steps = [1, 2, 3] as const;
  const values = [1, 2, 3, 4] as const;
  return (
    <>
      <MakerWelcome title={t('title')} page loggedIn={loggedIn} />
      <div className={`${WRAP} py-8`}>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1.3fr_0.9fr]">
          <section aria-labelledby="story-title" className={CARD}>
            <CardTitle id="story-title">{t('storyTitle')}</CardTitle>
            <ol className="mt-3 space-y-3 text-sm text-slate-700">
              {steps.map((n) => (
                <li key={n} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-xs font-black text-brand-400">
                    {n}
                  </span>
                  <span>
                    <strong className="text-slate-900">{t(`s${n}Title`)}</strong> · {t(`s${n}`)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="values-title" className={CARD}>
            <CardTitle id="values-title">{t('valuesTitle')}</CardTitle>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
              {values.map((n) => (
                <li key={n} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-brand-400 text-[11px] font-black text-black"
                  >
                    ✓
                  </span>
                  <span>
                    <strong className="text-slate-900">{t(`v${n}Title`)}</strong> · {t(`v${n}`)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="built-title" className={CARD}>
            <CardTitle id="built-title">{t('builtTitle')}</CardTitle>
            <p className="mt-2 text-sm text-slate-600">{t('builtSub')}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold text-white">
              {[...STACK, t('phoneApp'), t('tests')].map((item) => (
                <li key={item} className="rounded-md bg-black px-2.5 py-1">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

/** About us for a visitor: the public header over the same compact page. No footer. */
export function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <SiteHeader loggedIn={false} current="about" />
      <main id="main">
        <AboutContent loggedIn={false} />
      </main>
    </div>
  );
}
