import { useTranslations } from 'next-intl';
import { MAKER } from '@/lib/maker';
import { MakerLinks, SiteFooter, SiteHeader, WRAP } from './SiteChrome';

const H2 = 'text-3xl font-bold tracking-tight text-balance';
const STACK = ['Next.js', 'NestJS', 'PostgreSQL', 'Prisma', 'TypeScript'] as const;

/**
 * About us (/about): who built Job Search Hunter and why, what the app stands for, the
 * technology, and how to get in touch. Open to everyone, logged in or not.
 */
export function AboutPage({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations('Site.about');
  const nums = [1, 2, 3] as const;
  const values = [1, 2, 3, 4] as const;
  return (
    <div className="bg-white text-slate-900">
      <SiteHeader loggedIn={loggedIn} current="about" />
      <main id="main">
        <section className="py-14">
          <div className={`${WRAP} grid items-center gap-8 md:grid-cols-[6fr_5fr] md:gap-12`}>
            <div>
              <p className="text-sm font-bold tracking-wide text-slate-500 uppercase">
                {t('eyebrow')}
              </p>
              <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
                {t('title')}
              </h1>
              <p className="mt-4 max-w-prose text-lg text-slate-700">{t('lead')}</p>
            </div>
            <img
              src={MAKER.photo}
              alt={MAKER.name}
              width={1000}
              height={839}
              className="h-auto w-full rounded-2xl border-b-[6px] border-brand-400 shadow-xl"
            />
          </div>
        </section>

        <section aria-labelledby="story-title" className="bg-slate-100 py-14">
          <div className={WRAP}>
            <h2 id="story-title" className={H2}>
              {t('storyTitle')}
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {nums.map((n) => (
                <div key={n} className="border-t-[3px] border-black pt-3">
                  <h3 className="text-lg font-bold">{t(`s${n}Title`)}</h3>
                  <p className="mt-1 text-slate-700">{t(`s${n}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="values-title" className="py-14">
          <div className={WRAP}>
            <h2 id="values-title" className={H2}>
              {t('valuesTitle')}
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((n) => (
                <div key={n} className="rounded-lg border-l-4 border-brand-400 bg-slate-100 p-4">
                  <h3 className="font-bold">{t(`v${n}Title`)}</h3>
                  <p className="mt-1 text-sm text-slate-700">{t(`v${n}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="built-title" className="bg-slate-100 py-12">
          <div className={WRAP}>
            <h2 id="built-title" className={H2}>
              {t('builtTitle')}
            </h2>
            <p className="mt-2 text-slate-600">{t('builtSub')}</p>
            <ul className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-white">
              {[...STACK, t('phoneApp'), t('tests')].map((item) => (
                <li key={item} className="rounded-md bg-black px-3 py-1.5">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="contact"
          aria-labelledby="contact-title"
          className="scroll-mt-4 bg-brand-400 py-14"
        >
          <div className={`${WRAP} flex flex-col items-start gap-6 sm:flex-row sm:items-center`}>
            <img
              src={MAKER.face}
              alt=""
              width={120}
              height={120}
              className="h-28 w-28 shrink-0 rounded-full border-4 border-black"
            />
            <div>
              <h2 id="contact-title" className={H2}>
                {t('contactTitle')}
              </h2>
              <p className="mt-2">{t('contactText')}</p>
              <MakerLinks loggedIn={loggedIn} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter loggedIn={loggedIn} />
    </div>
  );
}
